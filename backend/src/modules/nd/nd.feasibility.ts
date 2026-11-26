import { query } from '../../config/database.js';
import { toIsoDay } from '../../utils/dates.js';
import { NotFoundError } from '../../utils/errors.js';
import { convertUnit, roundQty } from '../../utils/units.js';
import { loadRequirements, type NdRequirementRow } from './nd.service.js';

/**
 * D-176 (TZ §3.3): ND bo'yicha tahlilni bajarish mumkinmi — laboratoriya resurslari bilan solishtirish.
 * Sof funksiyalar (`checkEquipment`, `checkReagent`) DB siz testlanadi; `runFeasibility` ma'lumotni yuklaydi.
 * Faqat tasdiqlangan (D-169), muddati o'tmagan (bugun tugaydigani hali yaroqli), qoldig'i bor lotlar sanaladi.
 */

export type ReasonType =
  | 'no_requirements'
  | 'equipment_missing'
  | 'equipment_unavailable'
  | 'equipment_calibration_expired'
  | 'reagent_missing'
  | 'reagent_insufficient'
  | 'reagent_all_expired';

export interface FeasibilityReason {
  type: ReasonType;
  /** O'zbekcha tushuntirish (UI tur bo'yicha o'z tilida ham chiqaradi) */
  detail: string;
  data: Record<string, string | number | null>;
}

export interface EquipmentLite {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'out_of_service';
  calibrationDue: string | null;
}

export interface LotLite {
  id: string;
  quantity: number;
  unit: string;
  expiresAt: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export interface EquipmentCheck {
  category: string;
  ok: boolean;
  usable: number;
  total: number;
  reasons: FeasibilityReason[];
}

export interface ReagentCheck {
  reagentItemId: string;
  reagentName: string;
  unit: string;
  required: number;
  available: number;
  ok: boolean;
  reasons: FeasibilityReason[];
}

const STATUS_UZ = { maintenance: 'texnik xizmatda', out_of_service: 'ishlamaydi' } as const;

export function checkEquipment(
  category: string,
  items: EquipmentLite[],
  today: string,
): EquipmentCheck {
  const reasons: FeasibilityReason[] = [];
  if (items.length === 0) {
    reasons.push({
      type: 'equipment_missing',
      detail: `"${category}" turidagi apparat laboratoriyada yo‘q`,
      data: { category },
    });
    return { category, ok: false, usable: 0, total: 0, reasons };
  }
  const usable = items.filter(
    (e) => e.status === 'active' && (e.calibrationDue === null || e.calibrationDue >= today),
  );
  if (usable.length === 0) {
    for (const e of items) {
      if (e.status !== 'active') {
        reasons.push({
          type: 'equipment_unavailable',
          detail: `"${e.name}" (${category}) ${STATUS_UZ[e.status]}`,
          data: { category, equipment: e.name, equipmentId: e.id, status: e.status },
        });
      } else {
        reasons.push({
          type: 'equipment_calibration_expired',
          detail: `"${e.name}" (${category}) kalibrlash muddati o‘tgan: ${e.calibrationDue}`,
          data: {
            category,
            equipment: e.name,
            equipmentId: e.id,
            calibrationDue: e.calibrationDue,
          },
        });
      }
    }
  }
  return { category, ok: usable.length > 0, usable: usable.length, total: items.length, reasons };
}

/** Lot qoldig'ini talab birligida (konvertatsiya qilinmaydigani — 0). */
function availableIn(lot: LotLite, unit: string): number {
  return convertUnit(lot.quantity, lot.unit, unit) ?? 0;
}

export function checkReagent(
  item: { id: string; name: string },
  unit: string,
  perAnalysis: number,
  nAnalyses: number,
  lots: LotLite[],
  today: string,
): ReagentCheck {
  const required = roundQty(perAnalysis * nAnalyses);
  const base = { reagentItemId: item.id, reagentName: item.name, unit, required };
  const approved = lots.filter((l) => l.approvalStatus === 'approved' && l.quantity > 0);
  const usable = approved.filter((l) => l.expiresAt === null || l.expiresAt >= today);
  const available = roundQty(usable.reduce((s, l) => s + availableIn(l, unit), 0));

  if (lots.length === 0) {
    return {
      ...base,
      available: 0,
      ok: false,
      reasons: [
        {
          type: 'reagent_missing',
          detail: `"${item.name}" reaktivi omborda yo‘q`,
          data: { reagent: item.name },
        },
      ],
    };
  }
  if (available >= required) return { ...base, available, ok: true, reasons: [] };
  if (usable.length === 0 && approved.length > 0) {
    return {
      ...base,
      available: 0,
      ok: false,
      reasons: [
        {
          type: 'reagent_all_expired',
          detail: `"${item.name}" reaktivining barcha lotlari muddati o‘tgan`,
          data: { reagent: item.name, lots: approved.length },
        },
      ],
    };
  }
  const missing = roundQty(required - available);
  return {
    ...base,
    available,
    ok: false,
    reasons: [
      {
        type: 'reagent_insufficient',
        detail: `"${item.name}" yetarli emas: kerak ${required} ${unit}, mavjud ${available} ${unit}, yetishmaydi ${missing} ${unit}`,
        data: { reagent: item.name, required, available, missing, unit },
      },
    ],
  };
}

export interface FeasibilityResult {
  ndId: string;
  ndStatus: string;
  nAnalyses: number;
  canRun: boolean;
  reasons: FeasibilityReason[];
  equipment: EquipmentCheck[];
  reagents: ReagentCheck[];
}

/** Reaktiv talablari element bo'yicha yig'iladi (bir ND da bitta reaktiv bir necha metodikada bo'lishi mumkin). */
export function aggregateReagentRequirements(
  reqs: NdRequirementRow[],
): { itemId: string; name: string; unit: string; perAnalysis: number }[] {
  const map = new Map<
    string,
    { itemId: string; name: string; unit: string; perAnalysis: number }
  >();
  for (const r of reqs) {
    if (r.kind !== 'reagent' || !r.reagent_item_id || !r.unit || r.quantity_per_analysis === null)
      continue;
    const qty = Number(r.quantity_per_analysis);
    const cur = map.get(r.reagent_item_id);
    if (!cur) {
      map.set(r.reagent_item_id, {
        itemId: r.reagent_item_id,
        name: r.reagent_item_name ?? '',
        unit: r.unit,
        perAnalysis: qty,
      });
    } else {
      // Birlik oilasi talab saqlanganda tekshirilgan (D-176) — konvertatsiya har doim mumkin
      cur.perAnalysis = roundQty(cur.perAnalysis + (convertUnit(qty, r.unit, cur.unit) ?? 0));
    }
  }
  return [...map.values()];
}

export async function runFeasibility(
  companyId: string,
  ndId: string,
  nAnalyses: number,
): Promise<FeasibilityResult> {
  const nd = await query<{ status: string; today: string }>(
    `SELECT status::text, (now() AT TIME ZONE 'Asia/Tashkent')::date::text AS today
     FROM normative_documents WHERE id = $1 AND company_id = $2`,
    [ndId, companyId],
  );
  if (!nd.rows[0]) throw new NotFoundError('Normativ hujjat (ND) topilmadi');
  const today = nd.rows[0].today;
  const reqs = await loadRequirements(null, companyId, ndId);

  const categories = new Map<string, string>();
  for (const r of reqs) {
    if (r.kind === 'equipment' && r.equipment_category_key && r.equipment_category) {
      if (!categories.has(r.equipment_category_key))
        categories.set(r.equipment_category_key, r.equipment_category);
    }
  }
  const equipment: EquipmentCheck[] = [];
  for (const [key, label] of categories) {
    const { rows } = await query<{
      id: string;
      name: string;
      status: EquipmentLite['status'];
      calibration_due: unknown;
    }>(
      `SELECT id, name, status::text AS status, calibration_due FROM equipment
       WHERE company_id = $1 AND category_key = $2 ORDER BY name, id`,
      [companyId, key],
    );
    equipment.push(
      checkEquipment(
        label,
        rows.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          calibrationDue: toIsoDay(e.calibration_due as string | Date | null),
        })),
        today,
      ),
    );
  }

  const reagents: ReagentCheck[] = [];
  for (const need of aggregateReagentRequirements(reqs)) {
    const { rows } = await query<{
      id: string;
      quantity: string;
      unit: string;
      expires_at: unknown;
      approval_status: LotLite['approvalStatus'];
    }>(
      `SELECT id, quantity::text, unit, expires_at, approval_status::text AS approval_status
       FROM reagents WHERE company_id = $1 AND reagent_item_id = $2`,
      [companyId, need.itemId],
    );
    reagents.push(
      checkReagent(
        { id: need.itemId, name: need.name },
        need.unit,
        need.perAnalysis,
        nAnalyses,
        rows.map((l) => ({
          id: l.id,
          quantity: Number(l.quantity),
          unit: l.unit,
          expiresAt: toIsoDay(l.expires_at as string | Date | null),
          approvalStatus: l.approval_status,
        })),
        today,
      ),
    );
  }

  const reasons: FeasibilityReason[] = [];
  if (reqs.length === 0) {
    reasons.push({ type: 'no_requirements', detail: 'ND uchun talablar kiritilmagan', data: {} });
  }
  for (const c of [...equipment, ...reagents]) reasons.push(...c.reasons);

  return {
    ndId,
    ndStatus: nd.rows[0].status,
    nAnalyses,
    canRun: reqs.length > 0 && equipment.every((e) => e.ok) && reagents.every((r) => r.ok),
    reasons,
    equipment,
    reagents,
  };
}
