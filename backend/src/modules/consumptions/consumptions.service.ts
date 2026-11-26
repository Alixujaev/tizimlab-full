import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { convertUnit, roundQty } from '../../utils/units.js';
import type { Role } from '../auth/auth.types.js';
import { writeAudit } from '../audit/audit.service.js';
import { aggregateReagentRequirements } from '../nd/nd.feasibility.js';
import { loadRequirements } from '../nd/nd.service.js';
import { NOTIFICATION_TITLES } from '../notifications/notifications.events.js';
import { createNotification } from '../notifications/notifications.service.js';

/**
 * D-177 (TZ §3.2): ND normasi bo'yicha avtomatik reaktiv sarfi.
 * - Protokol yuborilganda (submit) har reaktiv talabi uchun `required = norma × tahlillar soni`.
 * - FEFO: tasdiqlangan, muddati o'tmagan (bugun tugaydigani — yaroqli), qoldig'i bor lotlar
 *   `expires_at ASC NULLS LAST, created_at, id` tartibida `FOR UPDATE` bilan qulflanib ayiriladi.
 * - Idempotent: `UNIQUE(protocol_id, reagent_item_id)` + `ON CONFLICT DO NOTHING` — qayta yuborishda,
 *   parallel yuborishda ham sarf bir marta.
 * - Manfiy qoldiq yo'q: yetmasa mavjudi ayiriladi, qolgani `shortfall_qty`, lab_head ga xabar;
 *   protokol yuborilishi BLOKLANMAYDI.
 */

type Meta = { ip?: string; userAgent?: string };

interface LotRow {
  id: string;
  name: string;
  unit: string;
  quantity: string;
  low_stock_threshold: string;
}

export interface ConsumptionRow {
  id: string;
  company_id: string;
  protocol_id: string;
  nd_id: string | null;
  reagent_item_id: string;
  reagent_item_name?: string;
  unit: string;
  required_qty: string;
  consumed_qty: string;
  shortfall_qty: string;
  status: 'auto' | 'confirmed' | 'corrected';
  correction_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConsumptionLotDto {
  reagentId: string;
  reagentName: string;
  quantity: number;
  unit: string;
  expiresAt: string | null;
}

export interface ConsumptionDto {
  id: string;
  protocolId: string;
  ndId: string | null;
  reagentItemId: string;
  reagentItemName: string;
  unit: string;
  requiredQty: number;
  consumedQty: number;
  shortfallQty: number;
  status: 'auto' | 'confirmed' | 'corrected';
  correctionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  lots: ConsumptionLotDto[];
  createdAt: string;
}

const today = (tx: pg.PoolClient) =>
  tx
    .query<{ d: string }>(`SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date::text AS d`)
    .then((r) => r.rows[0]!.d);

/** Bitta lot o'zgarishi: tranzaksiya yozuvi, qoldiq, sarf-lot izi va low_stock (D-132) chegarasi. */
async function moveLot(
  tx: pg.PoolClient,
  ctx: {
    companyId: string;
    userId: string;
    consumptionId: string;
    protocolId: string;
    purpose: string;
  },
  lot: LotRow,
  lotQty: number,
  direction: 'out' | 'in',
): Promise<void> {
  const before = Number(lot.quantity);
  const after = roundQty(direction === 'out' ? before - lotQty : before + lotQty);
  await tx.query(
    `UPDATE reagents SET quantity = $1, updated_at = now() WHERE id = $2 AND company_id = $3`,
    [after, lot.id, ctx.companyId],
  );
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO reagent_transactions (company_id, reagent_id, user_id, type, quantity, quantity_before, quantity_after,
                                       note, protocol_id, analysis_purpose, recorded_date)
     VALUES ($1, $2, $3, $4::reagent_transaction_type, $5, $6, $7, $8, $9, $10, (now() AT TIME ZONE 'Asia/Tashkent')::date)
     RETURNING id`,
    [
      ctx.companyId,
      lot.id,
      ctx.userId,
      direction,
      lotQty,
      before,
      after,
      direction === 'out' ? 'Avto-sarf (ND normasi)' : 'Sarf tuzatish: omborga qaytarildi',
      ctx.protocolId,
      ctx.purpose,
    ],
  );
  await tx.query(
    `INSERT INTO reagent_consumption_lots (company_id, consumption_id, reagent_id, quantity, transaction_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [ctx.companyId, ctx.consumptionId, lot.id, direction === 'out' ? lotQty : -lotQty, rows[0]!.id],
  );
  lot.quantity = String(after);
  const threshold = Number(lot.low_stock_threshold);
  if (direction === 'out' && threshold > 0 && before >= threshold && after < threshold) {
    await createNotification(tx, {
      companyId: ctx.companyId,
      actorId: ctx.userId,
      type: 'low_stock',
      title: NOTIFICATION_TITLES.low_stock,
      message: `${lot.name} — qoldiq: ${after} ${lot.unit}`,
      referenceId: lot.id,
    });
  }
}

/**
 * FEFO bo'yicha `amount` (talab birligida) ni ayiradi; ayirilgan miqdorni qaytaradi.
 * Birligi konvertatsiya qilinmaydigan lot o'tkazib yuboriladi (D-174 bo'yicha bunday lot bo'lmasligi kerak).
 */
async function deductFefo(
  tx: pg.PoolClient,
  ctx: {
    companyId: string;
    userId: string;
    consumptionId: string;
    protocolId: string;
    purpose: string;
  },
  itemId: string,
  unit: string,
  amount: number,
): Promise<number> {
  const { rows: lots } = await tx.query<LotRow>(
    `SELECT id, name, unit, quantity::text, low_stock_threshold::text FROM reagents
     WHERE company_id = $1 AND reagent_item_id = $2 AND approval_status = 'approved' AND quantity > 0
       AND (expires_at IS NULL OR expires_at >= $3::date)
     ORDER BY expires_at ASC NULLS LAST, created_at, id
     FOR UPDATE`,
    [ctx.companyId, itemId, await today(tx)],
  );
  let remaining = roundQty(amount);
  for (const lot of lots) {
    if (remaining <= 0) break;
    const avail = convertUnit(Number(lot.quantity), lot.unit, unit);
    if (avail === null || avail <= 0) continue;
    const take = Math.min(remaining, avail);
    // Lot to'liq olinsa — aynan lot qoldig'i (konvertatsiya yaxlitlashi qoldiq qoldirmasin)
    const lotQty = take === avail ? Number(lot.quantity) : convertUnit(take, unit, lot.unit)!;
    if (lotQty <= 0) continue;
    await moveLot(tx, ctx, lot, lotQty, 'out');
    remaining = roundQty(remaining - take);
  }
  return roundQty(amount - remaining);
}

async function notifyShortfall(
  tx: pg.PoolClient,
  companyId: string,
  actorId: string | null,
  sampleId: string,
  label: string,
): Promise<void> {
  await createNotification(tx, {
    companyId,
    actorId,
    type: 'reagent_shortfall',
    title: NOTIFICATION_TITLES.reagent_shortfall,
    message: label,
    referenceId: sampleId,
  });
}

/**
 * Protokol yuborish tranzaksiyasi ichida chaqiriladi. ND tasdiqlangan bo'lishi shart (tekshiruv chaqiruvchida).
 * Qaytaradi: yaratilgan (yangi) sarf yozuvlari soni.
 */
export async function applyNdConsumption(
  tx: pg.PoolClient,
  input: {
    companyId: string;
    userId: string;
    protocolId: string;
    sampleId: string;
    substanceName: string;
    ndId: string;
    ndCode: string;
    nAnalyses: number;
  },
): Promise<number> {
  const reqs = await loadRequirements(tx, input.companyId, input.ndId);
  let created = 0;
  for (const need of aggregateReagentRequirements(reqs)) {
    const required = roundQty(need.perAnalysis * input.nAnalyses);
    const ins = await tx.query<{ id: string }>(
      `INSERT INTO reagent_consumptions (company_id, protocol_id, nd_id, reagent_item_id, unit, required_qty, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (protocol_id, reagent_item_id) DO NOTHING
       RETURNING id`,
      [
        input.companyId,
        input.protocolId,
        input.ndId,
        need.itemId,
        need.unit,
        required,
        input.userId,
      ],
    );
    const consumptionId = ins.rows[0]?.id;
    if (!consumptionId) continue; // allaqachon sarflangan — idempotent
    created++;

    const ctx = {
      companyId: input.companyId,
      userId: input.userId,
      consumptionId,
      protocolId: input.protocolId,
      purpose: `ND ${input.ndCode}: ${input.substanceName}`.slice(0, 500),
    };
    const consumed = await deductFefo(tx, ctx, need.itemId, need.unit, required);
    const shortfall = roundQty(required - consumed);
    await tx.query(
      `UPDATE reagent_consumptions SET consumed_qty = $2, shortfall_qty = $3 WHERE id = $1`,
      [consumptionId, consumed, shortfall],
    );
    await writeAudit(tx, {
      userId: input.userId,
      companyId: input.companyId,
      action: 'create',
      tableName: 'reagent_consumptions',
      recordId: consumptionId,
      newValues: {
        protocol_id: input.protocolId,
        nd_id: input.ndId,
        reagent_item_id: need.itemId,
        required,
        consumed,
        shortfall,
        unit: need.unit,
      },
    });
    if (shortfall > 0) {
      await notifyShortfall(
        tx,
        input.companyId,
        input.userId,
        input.sampleId,
        `${need.name}: kerak ${required} ${need.unit}, ayirildi ${consumed} ${need.unit}, yetmadi ${shortfall} ${need.unit} — ${input.substanceName}`,
      );
    }
  }
  return created;
}

function toDto(row: ConsumptionRow, lots: ConsumptionLotDto[]): ConsumptionDto {
  return {
    id: row.id,
    protocolId: row.protocol_id,
    ndId: row.nd_id,
    reagentItemId: row.reagent_item_id,
    reagentItemName: row.reagent_item_name ?? '',
    unit: row.unit,
    requiredQty: Number(row.required_qty),
    consumedQty: Number(row.consumed_qty),
    shortfallQty: Number(row.shortfall_qty),
    status: row.status,
    correctionReason: row.correction_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    lots,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function lotsOf(
  db: pg.PoolClient | null,
  consumptionIds: string[],
): Promise<Map<string, ConsumptionLotDto[]>> {
  const sql = `SELECT l.consumption_id, l.reagent_id, r.name, r.unit, r.expires_at::text AS expires_at,
                      sum(l.quantity)::text AS quantity
               FROM reagent_consumption_lots l JOIN reagents r ON r.id = l.reagent_id
               WHERE l.consumption_id = ANY($1::uuid[])
               GROUP BY l.consumption_id, l.reagent_id, r.name, r.unit, r.expires_at
               HAVING sum(l.quantity) <> 0
               ORDER BY r.expires_at NULLS LAST, r.name`;
  type Row = {
    consumption_id: string;
    reagent_id: string;
    name: string;
    unit: string;
    expires_at: string | null;
    quantity: string;
  };
  const res = db
    ? await db.query<Row>(sql, [consumptionIds])
    : await query<Row>(sql, [consumptionIds]);
  const map = new Map<string, ConsumptionLotDto[]>();
  for (const r of res.rows) {
    const list = map.get(r.consumption_id) ?? [];
    list.push({
      reagentId: r.reagent_id,
      reagentName: r.name,
      quantity: Number(r.quantity),
      unit: r.unit,
      expiresAt: r.expires_at,
    });
    map.set(r.consumption_id, list);
  }
  return map;
}

const SELECT = `SELECT c.*, i.name AS reagent_item_name FROM reagent_consumptions c
  JOIN reagent_items i ON i.id = c.reagent_item_id`;

export async function listProtocolConsumptions(
  companyId: string,
  protocolId: string,
): Promise<ConsumptionDto[]> {
  const { rows } = await query<ConsumptionRow>(
    `${SELECT} WHERE c.protocol_id = $1 AND c.company_id = $2 ORDER BY i.name_key`,
    [protocolId, companyId],
  );
  const lots = await lotsOf(
    null,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toDto(r, lots.get(r.id) ?? []));
}

/** Kimyogar — faqat o'ziga biriktirilgan namuna sarfini; lab_head — kompaniyadagi barchasini (D-177). */
async function loadForReview(
  tx: pg.PoolClient,
  companyId: string,
  user: { id: string; role: Role },
  id: string,
): Promise<ConsumptionRow & { sample_id: string; substance_name: string }> {
  const { rows } = await tx.query<
    ConsumptionRow & { sample_id: string; substance_name: string; assigned_to: string | null }
  >(
    `SELECT c.*, i.name AS reagent_item_name, s.id AS sample_id, s.substance_name, s.assigned_to
     FROM reagent_consumptions c
     JOIN reagent_items i ON i.id = c.reagent_item_id
     JOIN protocols p ON p.id = c.protocol_id
     JOIN samples s ON s.id = p.sample_id
     WHERE c.id = $1 AND c.company_id = $2
     FOR UPDATE OF c`,
    [id, companyId],
  );
  const row = rows[0];
  if (!row) throw new NotFoundError('Sarf yozuvi topilmadi');
  if (user.role === 'chemist' && row.assigned_to !== user.id) {
    throw new ForbiddenError('Faqat o‘zingizga biriktirilgan tahlil sarfini tasdiqlay olasiz');
  }
  return row;
}

export async function confirmConsumption(
  companyId: string,
  user: { id: string; role: Role },
  id: string,
  meta: Meta = {},
): Promise<ConsumptionDto> {
  return withTransaction(async (tx) => {
    const row = await loadForReview(tx, companyId, user, id);
    if (row.status !== 'auto') {
      throw new AppError(
        409,
        'CONSUMPTION_ALREADY_REVIEWED',
        'Sarf allaqachon tasdiqlangan yoki tuzatilgan',
        {
          status: row.status,
        },
      );
    }
    const { rows } = await tx.query<ConsumptionRow>(
      `UPDATE reagent_consumptions SET status = 'confirmed', reviewed_by = $2, reviewed_at = now()
       WHERE id = $1 RETURNING *`,
      [id, user.id],
    );
    await writeAudit(tx, {
      userId: user.id,
      companyId,
      action: 'status_change',
      tableName: 'reagent_consumptions',
      recordId: id,
      oldValues: { status: row.status },
      newValues: { status: 'confirmed' },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const lots = await lotsOf(tx, [id]);
    return toDto({ ...rows[0]!, reagent_item_name: row.reagent_item_name }, lots.get(id) ?? []);
  });
}

/**
 * Miqdorni tuzatish (sabab ≥5 belgi): kamaysa farq oxirgi ayirilgan lotlardan boshlab o'sha lotlarga qaytariladi,
 * ko'paysa FEFO bo'yicha qo'shimcha ayiriladi (yetmasa — shortfall va xabar). `required_qty` yangi miqdorga teng bo'ladi.
 */
export async function correctConsumption(
  companyId: string,
  user: { id: string; role: Role },
  id: string,
  input: { quantity: number; reason: string },
  meta: Meta = {},
): Promise<ConsumptionDto> {
  return withTransaction(async (tx) => {
    const row = await loadForReview(tx, companyId, user, id);
    const target = roundQty(input.quantity);
    const consumedBefore = Number(row.consumed_qty);
    const ctx = {
      companyId,
      userId: user.id,
      consumptionId: id,
      protocolId: row.protocol_id,
      purpose: `Sarf tuzatish: ${row.substance_name}`.slice(0, 500),
    };
    let consumed = consumedBefore;

    if (target < consumedBefore) {
      let toReturn = roundQty(consumedBefore - target);
      // Har lot bo'yicha sof olingan miqdor; oxirgi olinganidan boshlab qaytariladi
      const { rows: taken } = await tx.query<LotRow & { net: string }>(
        `SELECT r.id, r.name, r.unit, r.quantity::text, r.low_stock_threshold::text, sum(l.quantity)::text AS net
         FROM reagent_consumption_lots l JOIN reagents r ON r.id = l.reagent_id
         WHERE l.consumption_id = $1
         GROUP BY r.id
         HAVING sum(l.quantity) > 0
         ORDER BY max(l.created_at) DESC, r.expires_at DESC NULLS FIRST, r.id`,
        [id],
      );
      await tx.query(`SELECT 1 FROM reagents WHERE id = ANY($1::uuid[]) FOR UPDATE`, [
        taken.map((t) => t.id),
      ]);
      for (const lot of taken) {
        if (toReturn <= 0) break;
        const fresh = await tx.query<{ quantity: string }>(
          `SELECT quantity::text FROM reagents WHERE id = $1`,
          [lot.id],
        );
        lot.quantity = fresh.rows[0]!.quantity;
        const netInUnit = convertUnit(Number(lot.net), lot.unit, row.unit) ?? 0;
        const give = Math.min(toReturn, netInUnit);
        const lotQty =
          give === netInUnit ? Number(lot.net) : convertUnit(give, row.unit, lot.unit)!;
        if (lotQty <= 0) continue;
        await moveLot(tx, ctx, lot, lotQty, 'in');
        toReturn = roundQty(toReturn - give);
      }
      consumed = roundQty(target + toReturn); // toReturn qoldig'i bo'lmasligi kerak
    } else if (target > consumedBefore) {
      const extra = await deductFefo(
        tx,
        ctx,
        row.reagent_item_id,
        row.unit,
        roundQty(target - consumedBefore),
      );
      consumed = roundQty(consumedBefore + extra);
    }
    const shortfall = roundQty(Math.max(0, target - consumed));

    const { rows } = await tx.query<ConsumptionRow>(
      `UPDATE reagent_consumptions
         SET required_qty = $2, consumed_qty = $3, shortfall_qty = $4, status = 'corrected',
             correction_reason = $5, reviewed_by = $6, reviewed_at = now()
       WHERE id = $1 RETURNING *`,
      [id, target, consumed, shortfall, input.reason.trim(), user.id],
    );
    await writeAudit(tx, {
      userId: user.id,
      companyId,
      action: 'update',
      tableName: 'reagent_consumptions',
      recordId: id,
      oldValues: {
        status: row.status,
        consumed_qty: consumedBefore,
        shortfall_qty: Number(row.shortfall_qty),
      },
      newValues: {
        status: 'corrected',
        consumed_qty: consumed,
        shortfall_qty: shortfall,
        reason: input.reason.trim(),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    if (shortfall > Number(row.shortfall_qty)) {
      await notifyShortfall(
        tx,
        companyId,
        user.id,
        row.sample_id,
        `${row.reagent_item_name}: tuzatishdan keyin yetmadi ${shortfall} ${row.unit} — ${row.substance_name}`,
      );
    }
    const lots = await lotsOf(tx, [id]);
    return toDto({ ...rows[0]!, reagent_item_name: row.reagent_item_name }, lots.get(id) ?? []);
  });
}
