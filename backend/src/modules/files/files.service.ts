import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { getPool, query, withTransaction } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { writeAudit } from '../audit/audit.service.js';
import { type FileStorage, SIGNED_URL_TTL_SECONDS } from './files.storage.js';
import { contentDisposition, type ValidatedFile } from './files.validation.js';

// D-61, D-113: generic fayl servisi — HTTP route'siz; pasport (P4b), protokol (P5), reaktiv (P7) modullari
// o'z endpointlari orqali shu funksiyalarni chaqiradi.

export interface FileRow {
  id: string;
  company_id: string;
  sample_id: string | null;
  r2_key: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  uploaded_by: string;
  created_at: string;
}

export interface FileDto {
  id: string;
  sampleId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export const toFileDto = (row: FileRow): FileDto => ({
  id: row.id,
  sampleId: row.sample_id,
  filename: row.filename,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
});

export interface ActorMeta {
  userId: string;
  companyId: string;
  ip?: string;
  userAgent?: string;
}

const ENTITY_RE = /^[a-z0-9-]+$/;

/** R2 kaliti: `<company_id>/<entity>/<uuid>.<ext>` — asl fayl nomi kalitga tushmaydi (path traversal yo'q). */
export function buildKey(companyId: string, entity: string, ext: string): string {
  if (!ENTITY_RE.test(entity) || !/^[a-z0-9]+$/.test(ext)) {
    throw new Error(`buildKey: noto'g'ri entity/ext`);
  }
  return `${companyId}/${entity}/${randomUUID()}.${ext}`;
}

/** R2 ob'ektini o'chiradi; xato bo'lsa faqat ogohlantirish (DB allaqachon izchil, yetim ob'ekt zararsiz). */
export async function deleteObjectSafely(storage: FileStorage, key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch (err) {
    logger.warn('R2 ob‘ektini o‘chirib bo‘lmadi', {
      key,
      error: err instanceof Error ? err.name : 'unknown',
    });
  }
}

export interface PendingObject {
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * Yuklash tartibi (orphan/rollback kafolati):
 *   BEGIN → DB yozuvlari (`fn`) → oxirgi qadam `storage.put` → COMMIT.
 *   - DB qadami xato → ROLLBACK, R2 ga hech narsa yozilmagan.
 *   - `put` xato → ROLLBACK (DB toza).
 *   - `put` muvaffaqiyatli, COMMIT xato → R2 dagi yetim ob'ekt o'chiriladi.
 */
export async function runWithUpload<T>(
  storage: FileStorage,
  object: PendingObject,
  fn: (tx: pg.PoolClient) => Promise<T>,
  db: pg.Pool = getPool(),
): Promise<T> {
  let uploaded = false;
  try {
    return await withTransaction(async (tx) => {
      const result = await fn(tx);
      await storage.put(object.key, object.body, object.contentType);
      uploaded = true;
      return result;
    }, db);
  } catch (err) {
    if (uploaded) await deleteObjectSafely(storage, object.key);
    throw err;
  }
}

export interface InsertFileInput {
  key: string;
  file: ValidatedFile;
  sampleId?: string | null;
}

/** `files` qatori + audit (D-60: fayl yuklash). Tranzaksiya ichida chaqiriladi. */
export async function insertFileRecord(
  tx: pg.PoolClient,
  actor: ActorMeta,
  input: InsertFileInput,
): Promise<FileRow> {
  const { rows } = await tx.query<FileRow>(
    `INSERT INTO files (company_id, sample_id, r2_key, filename, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      actor.companyId,
      input.sampleId ?? null,
      input.key,
      input.file.filename,
      input.file.mime,
      input.file.size,
      actor.userId,
    ],
  );
  const row = rows[0]!;
  await writeAudit(tx, {
    userId: actor.userId,
    companyId: actor.companyId,
    action: 'create',
    tableName: 'files',
    recordId: row.id,
    newValues: {
      sample_id: row.sample_id,
      filename: row.filename,
      mime_type: row.mime_type,
      size_bytes: Number(row.size_bytes),
    },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return row;
}

/** `files` qatorini kalit bo'yicha o'chiradi + audit. Qator bo'lmasa `null`. */
export async function deleteFileRecordByKey(
  tx: pg.PoolClient,
  actor: ActorMeta,
  key: string,
): Promise<FileRow | null> {
  const { rows } = await tx.query<FileRow>(
    `DELETE FROM files WHERE r2_key = $1 AND company_id = $2 RETURNING *`,
    [key, actor.companyId],
  );
  const row = rows[0];
  if (!row) return null;
  await writeAudit(tx, {
    userId: actor.userId,
    companyId: actor.companyId,
    action: 'delete',
    tableName: 'files',
    recordId: row.id,
    oldValues: { sample_id: row.sample_id, filename: row.filename, mime_type: row.mime_type },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return row;
}

export async function findFileByKey(companyId: string, key: string): Promise<FileRow | null> {
  const { rows } = await query<FileRow>(
    `SELECT * FROM files WHERE r2_key = $1 AND company_id = $2`,
    [key, companyId],
  );
  return rows[0] ?? null;
}

export interface DownloadLink {
  url: string;
  expiresIn: number;
}

/** 5 daqiqalik imzolangan URL (D-61). Chaqiruvchi ruxsatni OLDIN tekshiradi. */
export async function getDownloadUrl(
  storage: FileStorage,
  file: Pick<FileRow, 'r2_key' | 'filename' | 'mime_type'>,
): Promise<DownloadLink> {
  const url = await storage.getSignedUrl(file.r2_key, {
    contentDisposition: contentDisposition(file.filename),
    contentType: file.mime_type,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
  return { url, expiresIn: SIGNED_URL_TTL_SECONDS };
}

// --- Generic API (R-FILE-03..06) ---

/** Faylni yuklaydi va metama'lumotini `files` ga yozadi (bitta tranzaksiya, `runWithUpload` tartibi). */
export async function storeFile(
  storage: FileStorage,
  actor: ActorMeta,
  input: { entity: string; file: ValidatedFile; sampleId?: string | null },
): Promise<FileDto> {
  const key = buildKey(actor.companyId, input.entity, input.file.ext);
  const row = await runWithUpload(
    storage,
    { key, body: input.file.buffer, contentType: input.file.mime },
    (tx) => insertFileRecord(tx, actor, { key, file: input.file, sampleId: input.sampleId }),
  );
  return toFileDto(row);
}

export async function listFiles(
  companyId: string,
  filter: { sampleId?: string } = {},
): Promise<FileDto[]> {
  const values: unknown[] = [companyId];
  let where = 'company_id = $1';
  if (filter.sampleId) {
    values.push(filter.sampleId);
    where += ` AND sample_id = $${values.length}`;
  }
  const { rows } = await query<FileRow>(
    `SELECT * FROM files WHERE ${where} ORDER BY created_at DESC`,
    values,
  );
  return rows.map(toFileDto);
}

async function getFileRow(companyId: string, fileId: string): Promise<FileRow> {
  const { rows } = await query<FileRow>(`SELECT * FROM files WHERE id = $1 AND company_id = $2`, [
    fileId,
    companyId,
  ]);
  // Boshqa kompaniya fayli — 404 (D-102)
  if (!rows[0]) throw new NotFoundError('Fayl topilmadi');
  return rows[0];
}

export async function getFileDownloadUrl(
  storage: FileStorage,
  companyId: string,
  fileId: string,
): Promise<DownloadLink> {
  return getDownloadUrl(storage, await getFileRow(companyId, fileId));
}

/** DB qatori o'chiriladi (COMMIT), so'ng R2 ob'ekti — R2 xatosi DB izchilligini buzmaydi. */
export async function removeFile(
  storage: FileStorage,
  actor: ActorMeta,
  fileId: string,
): Promise<void> {
  const file = await getFileRow(actor.companyId, fileId);
  await withTransaction((tx) => deleteFileRecordByKey(tx, actor, file.r2_key));
  await deleteObjectSafely(storage, file.r2_key);
}
