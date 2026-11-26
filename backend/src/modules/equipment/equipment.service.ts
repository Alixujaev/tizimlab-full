import { query, withTransaction } from '../../config/database.js';
import { toIsoDay } from '../../utils/dates.js';
import { NotFoundError } from '../../utils/errors.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import type {
  CreateEquipmentInput,
  ListEquipmentQuery,
  UpdateEquipmentInput,
} from './equipment.schemas.js';

export type EquipmentStatus = 'active' | 'maintenance' | 'out_of_service';

export interface EquipmentRow {
  id: string;
  company_id: string;
  name: string;
  category: string;
  category_key: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  status: EquipmentStatus;
  calibration_due: string | Date | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  /** SELECT da hisoblanadi: laboratoriya kunidan qolgan kunlar */
  days_to_calibration?: number | null;
}

export interface EquipmentDto {
  id: string;
  companyId: string;
  name: string;
  category: string;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  status: EquipmentStatus;
  calibrationDue: string | null;
  /** Kalibrlash muddati o'tgan (bugun hali yaroqli) */
  isCalibrationExpired: boolean;
  /** 30 kun ichida tugaydi */
  isCalibrationDueSoon: boolean;
  /** Tahlilda ishlatish mumkin: faol va kalibrlash o'tmagan (D-175) */
  isUsable: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CALIBRATION_SOON_DAYS = 30;

/** Laboratoriya kuni (Asia/Tashkent, D-161 bilan bir xil literal) bo'yicha kalibrlashgacha qolgan kunlar. */
const SELECT_COLS = `e.*, (e.calibration_due - (now() AT TIME ZONE 'Asia/Tashkent')::date) AS days_to_calibration`;

export function toEquipmentDto(row: EquipmentRow): EquipmentDto {
  const days = row.days_to_calibration ?? null;
  const expired = days !== null && days < 0;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    category: row.category,
    model: row.model,
    serialNumber: row.serial_number,
    location: row.location,
    status: row.status,
    calibrationDue: toIsoDay(row.calibration_due),
    isCalibrationExpired: expired,
    isCalibrationDueSoon: days !== null && days >= 0 && days <= CALIBRATION_SOON_DAYS,
    isUsable: row.status === 'active' && !expired,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

type Meta = { ip?: string; userAgent?: string };

export async function listEquipment(
  companyId: string,
  q: ListEquipmentQuery,
): Promise<PaginatedResult<EquipmentDto>> {
  const where = ['e.company_id = $1'];
  const params: unknown[] = [companyId];
  const add = (sql: (i: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (q.search) {
    add(
      (i) =>
        `(e.name ILIKE $${i} OR e.model ILIKE $${i} OR e.serial_number ILIKE $${i} OR e.location ILIKE $${i})`,
      `%${q.search}%`,
    );
  }
  if (q.category) add((i) => `e.category_key = reagent_name_key($${i})`, q.category);
  if (q.status) add((i) => `e.status = $${i}::equipment_status`, q.status);
  if (q.calibrationDueWithinDays !== undefined) {
    add(
      (i) =>
        `e.calibration_due IS NOT NULL AND e.calibration_due <= (now() AT TIME ZONE 'Asia/Tashkent')::date + $${i}::int`,
      q.calibrationDueWithinDays,
    );
  }
  const whereSql = where.join(' AND ');
  const [list, count] = await Promise.all([
    query<EquipmentRow>(
      `SELECT ${SELECT_COLS} FROM equipment e WHERE ${whereSql}
       ORDER BY e.category_key, e.name, e.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, toOffset(q)],
    ),
    query<{ total: string }>(`SELECT count(*) AS total FROM equipment e WHERE ${whereSql}`, params),
  ]);
  return {
    items: list.rows.map(toEquipmentDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getEquipment(companyId: string, id: string): Promise<EquipmentDto> {
  const { rows } = await query<EquipmentRow>(
    `SELECT ${SELECT_COLS} FROM equipment e WHERE e.id = $1 AND e.company_id = $2`,
    [id, companyId],
  );
  if (!rows[0]) throw new NotFoundError('Apparat topilmadi');
  return toEquipmentDto(rows[0]);
}

/** ND talablari formasi uchun kompaniyadagi kategoriyalar (birinchi yozilgan ko'rinishi bilan). */
export async function listCategories(companyId: string): Promise<string[]> {
  const { rows } = await query<{ category: string }>(
    `SELECT DISTINCT ON (category_key) category FROM equipment
     WHERE company_id = $1 ORDER BY category_key, created_at`,
    [companyId],
  );
  return rows.map((r) => r.category);
}

export async function createEquipment(
  companyId: string,
  userId: string,
  input: CreateEquipmentInput,
  meta: Meta = {},
): Promise<EquipmentDto> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO equipment (company_id, name, category, model, serial_number, location, status, calibration_due, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::equipment_status, $8, $9, $10) RETURNING id`,
      [
        companyId,
        input.name,
        input.category,
        input.model ?? null,
        input.serialNumber ?? null,
        input.location ?? null,
        input.status,
        input.calibrationDue ?? null,
        input.notes ?? null,
        userId,
      ],
    );
    const id = rows[0]!.id;
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'create',
      tableName: 'equipment',
      recordId: id,
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const created = await tx.query<EquipmentRow>(
      `SELECT ${SELECT_COLS} FROM equipment e WHERE e.id = $1`,
      [id],
    );
    return toEquipmentDto(created.rows[0]!);
  });
}

const COLUMN: Record<keyof UpdateEquipmentInput, string> = {
  name: 'name',
  category: 'category',
  model: 'model',
  serialNumber: 'serial_number',
  location: 'location',
  status: 'status',
  calibrationDue: 'calibration_due',
  notes: 'notes',
};

export async function updateEquipment(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateEquipmentInput,
  meta: Meta = {},
): Promise<EquipmentDto> {
  return withTransaction(async (tx) => {
    const prev = await tx.query<EquipmentRow>(
      `SELECT * FROM equipment WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId],
    );
    if (!prev.rows[0]) throw new NotFoundError('Apparat topilmadi');

    // Ustun nomlari faqat oq ro'yxatdan (COLUMN) — foydalanuvchi matni SQL'ga kirmaydi
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [key, value] of Object.entries(input) as [keyof UpdateEquipmentInput, unknown][]) {
      if (value === undefined) continue;
      params.push(value);
      const cast = key === 'status' ? '::equipment_status' : '';
      sets.push(`${COLUMN[key]} = $${params.length}${cast}`);
    }
    await tx.query(
      `UPDATE equipment SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2`,
      params,
    );

    const old = prev.rows[0];
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'update',
      tableName: 'equipment',
      recordId: id,
      oldValues: Object.fromEntries(
        Object.keys(input).map((k) => [
          k,
          (old as unknown as Record<string, unknown>)[COLUMN[k as keyof UpdateEquipmentInput]],
        ]),
      ),
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const updated = await tx.query<EquipmentRow>(
      `SELECT ${SELECT_COLS} FROM equipment e WHERE e.id = $1`,
      [id],
    );
    return toEquipmentDto(updated.rows[0]!);
  });
}

export async function deleteEquipment(
  companyId: string,
  userId: string,
  id: string,
  meta: Meta = {},
): Promise<void> {
  await withTransaction(async (tx) => {
    const { rows } = await tx.query<EquipmentRow>(
      `DELETE FROM equipment WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId],
    );
    if (!rows[0]) throw new NotFoundError('Apparat topilmadi');
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'equipment',
      recordId: id,
      oldValues: {
        name: rows[0].name,
        category: rows[0].category,
        serial_number: rows[0].serial_number,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}
