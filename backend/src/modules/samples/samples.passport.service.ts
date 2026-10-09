import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { writeAudit } from '../audit/audit.service.js';
import {
  type ActorMeta,
  buildKey,
  deleteFileRecordByKey,
  deleteObjectSafely,
  type DownloadLink,
  findFileByKey,
  getDownloadUrl,
  insertFileRecord,
  runWithUpload,
} from '../files/files.service.js';
import { type FileStorage, requireStorage } from '../files/files.storage.js';
import {
  assertAllowedFile,
  extensionOf,
  FILE_KINDS,
  type IncomingFile,
  PASSPORT_MAX_BYTES,
} from '../files/files.validation.js';
import { sampleHooks } from './samples.hooks.js';
import {
  type Denial,
  decideDelete,
  decideReview,
  decideUpload,
} from './samples.passport.policy.js';
import type { ReviewPassportInput } from './samples.schemas.js';
import { isSampleVisibleTo, type RequestMeta, type UserContext } from './samples.service.js';
import { assertPassportApproval } from './samples.state-machine.js';
import { type SampleDto, type SampleRow, type SampleStatus, toSampleDto } from './samples.types.js';

// Namuna pasporti (spec §3). Har o'zgarish: samples + sample_tracking + files + audit + hooklar — BITTA tranzaksiyada.

/** R2 kalitidagi entity qismi: `<company_id>/sample-passports/<uuid>.<ext>`. */
export const PASSPORT_ENTITY = 'sample-passports';
/** Pasport orqali tasdiqlanganda tracking izohi (spec §3, D-117). */
export const PASSPORT_APPROVAL_REASON = 'pasport orqali';

const DENIAL_MESSAGES: Record<Denial['code'], string> = {
  PASSPORT_NOT_ALLOWED: 'Bu turdagi namunaga pasport biriktirilmaydi',
  FORBIDDEN: 'Bu amal uchun ruxsat yo‘q',
  PASSPORT_EXISTS: 'Namunada pasport allaqachon mavjud — avval uni o‘chiring',
  INVALID_TRANSITION: 'Namuna yoki pasport holati bu amalga mos emas',
  PASSPORT_REVIEW_NOT_APPLICABLE:
    'Bu turdagi namuna pasporti ko‘rib chiqilmaydi (qo‘shimcha hujjat)',
  SELF_REVIEW_FORBIDDEN: 'O‘zingiz yuklagan pasportni o‘zingiz ko‘rib chiqa olmaysiz',
  PASSPORT_NOT_FOUND: 'Pasport topilmadi',
};

const toError = (d: Denial) => new AppError(d.status, d.code, DENIAL_MESSAGES[d.code]);

export interface PassportContext {
  companyId: string;
  user: UserContext;
  meta: RequestMeta;
}

const actorOf = (ctx: PassportContext): ActorMeta => ({
  userId: ctx.user.id,
  companyId: ctx.companyId,
  ip: ctx.meta.ip,
  userAgent: ctx.meta.userAgent,
});

async function loadVisibleSample(
  tx: pg.PoolClient | null,
  ctx: PassportContext,
  sampleId: string,
): Promise<SampleRow> {
  const sql = 'SELECT * FROM samples WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL';
  const params = [sampleId, ctx.companyId];
  // Tranzaksiya ichida qator qulflanadi (parallel yuklash/ko'rib chiqishga qarshi)
  const { rows } = tx
    ? await tx.query<SampleRow>(`${sql} FOR UPDATE`, params)
    : await query<SampleRow>(sql, params);
  const sample = rows[0];
  if (!sample || !isSampleVisibleTo(ctx.user, sample)) throw new NotFoundError('Namuna topilmadi');
  return sample;
}

async function insertTracking(
  tx: pg.PoolClient,
  ctx: PassportContext,
  sampleId: string,
  event: {
    type: 'passport_uploaded' | 'passport_reviewed' | 'passport_deleted' | 'approved';
    from: SampleStatus;
    to: SampleStatus;
    reason?: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO sample_tracking (company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      ctx.companyId,
      sampleId,
      event.type,
      ctx.user.id,
      event.from,
      event.to,
      event.reason ?? null,
      JSON.stringify(event.metadata),
    ],
  );
}

/** Pasport orqali tasdiqlash: namuna `approved`, tracking, ochiq protokollarni yopish (P5) va xabarnoma (P6) hooklari. */
async function approveSampleViaPassport(
  tx: pg.PoolClient,
  ctx: PassportContext,
  before: SampleRow,
  updated: SampleRow,
): Promise<void> {
  await insertTracking(tx, ctx, before.id, {
    type: 'approved',
    from: before.status,
    to: 'approved',
    reason: PASSPORT_APPROVAL_REASON,
    metadata: { via: 'passport' },
  });
  await sampleHooks.closeOpenProtocolsForSample(updated, ctx.user.id, tx);
  await sampleHooks.onSampleStatusChanged(updated, before.status, 'approved', ctx.user.id, tx);
}

export async function uploadPassport(
  storage: FileStorage | null,
  ctx: PassportContext,
  sampleId: string,
  file: IncomingFile | undefined,
): Promise<SampleDto> {
  // Ruxsat avval (404/403/409/422), keyin fayl tekshiruvi; tranzaksiya ichida qulf bilan qayta tekshiriladi
  const preview = await loadVisibleSample(null, ctx, sampleId);
  const pre = decideUpload(ctx.user, preview);
  if (!pre.allowed) throw toError(pre.denial);
  const s3 = requireStorage(storage);
  const validated = assertAllowedFile(file, PASSPORT_MAX_BYTES);
  const key = buildKey(ctx.companyId, PASSPORT_ENTITY, validated.ext);
  let replacedKey: string | null = null;

  const result = await runWithUpload(
    s3,
    { key, body: validated.buffer, contentType: validated.mime },
    async (tx) => {
      const sample = await loadVisibleSample(tx, ctx, sampleId);
      const decision = decideUpload(ctx.user, sample);
      if (!decision.allowed) throw toError(decision.denial);

      replacedKey = sample.passport_file_path;
      if (replacedKey) await deleteFileRecordByKey(tx, actorOf(ctx), replacedKey);
      await insertFileRecord(tx, actorOf(ctx), { key, file: validated, sampleId });

      let newStatus = sample.status;
      if (decision.approvesSample) {
        assertPassportApproval(sample.type, sample.status);
        newStatus = 'approved';
      }

      const { rows } = await tx.query<SampleRow>(
        `UPDATE samples
         SET passport_file_name = $1, passport_file_path = $2, passport_file_size = $3,
             passport_status = $4, passport_uploaded_by = $5, status = $6
         WHERE id = $7 AND company_id = $8
         RETURNING *`,
        [
          validated.filename,
          key,
          validated.size,
          decision.passportStatus,
          ctx.user.id,
          newStatus,
          sampleId,
          ctx.companyId,
        ],
      );
      const updated = rows[0]!;

      await insertTracking(tx, ctx, sampleId, {
        type: 'passport_uploaded',
        from: sample.status,
        to: sample.status,
        metadata: {
          passport_status: decision.passportStatus,
          file_name: validated.filename,
          replaced: Boolean(replacedKey),
        },
      });
      if (decision.approvesSample) await approveSampleViaPassport(tx, ctx, sample, updated);

      await writeAudit(tx, {
        userId: ctx.user.id,
        companyId: ctx.companyId,
        action: 'passport_upload',
        tableName: 'samples',
        recordId: sampleId,
        oldValues: { status: sample.status, passport_status: sample.passport_status },
        newValues: { status: newStatus, passport_status: decision.passportStatus },
        ip: ctx.meta.ip,
        userAgent: ctx.meta.userAgent,
      });
      return toSampleDto(updated);
    },
  );

  // Rad etilgan eski pasport ob'ekti faqat COMMIT'dan keyin o'chiriladi
  if (replacedKey) await deleteObjectSafely(s3, replacedKey);
  return result;
}

export async function reviewPassport(
  ctx: PassportContext,
  sampleId: string,
  input: ReviewPassportInput,
): Promise<SampleDto> {
  return withTransaction(async (tx) => {
    const sample = await loadVisibleSample(tx, ctx, sampleId);
    const decision = decideReview(ctx.user, sample);
    if (!decision.allowed) throw toError(decision.denial);

    const approve = input.decision === 'approve';
    if (approve) assertPassportApproval(sample.type, sample.status);
    const passportStatus = approve ? 'approved' : 'rejected';
    const newStatus: SampleStatus = approve ? 'approved' : sample.status;

    const { rows } = await tx.query<SampleRow>(
      `UPDATE samples SET passport_status = $1, status = $2 WHERE id = $3 AND company_id = $4 RETURNING *`,
      [passportStatus, newStatus, sampleId, ctx.companyId],
    );
    const updated = rows[0]!;

    // D-85: rad etish sababi alohida ustunda emas — tracking voqeasida
    await insertTracking(tx, ctx, sampleId, {
      type: 'passport_reviewed',
      from: sample.status,
      to: sample.status,
      reason: approve ? null : (input.reason ?? null),
      metadata: { decision: input.decision, uploaded_by: sample.passport_uploaded_by },
    });
    if (approve) await approveSampleViaPassport(tx, ctx, sample, updated);

    await writeAudit(tx, {
      userId: ctx.user.id,
      companyId: ctx.companyId,
      action: 'passport_review',
      tableName: 'samples',
      recordId: sampleId,
      oldValues: { status: sample.status, passport_status: sample.passport_status },
      newValues: {
        status: newStatus,
        passport_status: passportStatus,
        reason: input.reason ?? null,
      },
      ip: ctx.meta.ip,
      userAgent: ctx.meta.userAgent,
    });
    return toSampleDto(updated);
  });
}

/** D-111: tasdiqlangan pasport o'chirilsa ham namuna statusi o'zgarmaydi. R2 ob'ekti COMMIT'dan keyin o'chadi. */
export async function deletePassport(
  storage: FileStorage | null,
  ctx: PassportContext,
  sampleId: string,
): Promise<SampleDto> {
  const s3 = requireStorage(storage);
  let removedKey: string | null = null;
  const result = await withTransaction(async (tx) => {
    const sample = await loadVisibleSample(tx, ctx, sampleId);
    const decision = decideDelete(ctx.user, sample);
    if (!decision.allowed) throw toError(decision.denial);

    removedKey = sample.passport_file_path!;
    await deleteFileRecordByKey(tx, actorOf(ctx), removedKey);
    const { rows } = await tx.query<SampleRow>(
      `UPDATE samples
       SET passport_file_name = NULL, passport_file_path = NULL, passport_file_size = NULL,
           passport_status = NULL, passport_uploaded_by = NULL
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [sampleId, ctx.companyId],
    );
    await insertTracking(tx, ctx, sampleId, {
      type: 'passport_deleted',
      from: sample.status,
      to: sample.status,
      metadata: {
        previous_passport_status: sample.passport_status,
        file_name: sample.passport_file_name,
        uploaded_by: sample.passport_uploaded_by,
      },
    });
    await writeAudit(tx, {
      userId: ctx.user.id,
      companyId: ctx.companyId,
      action: 'passport_delete',
      tableName: 'samples',
      recordId: sampleId,
      oldValues: {
        passport_status: sample.passport_status,
        passport_file_name: sample.passport_file_name,
      },
      newValues: { passport_status: null },
      ip: ctx.meta.ip,
      userAgent: ctx.meta.userAgent,
    });
    return toSampleDto(rows[0]!);
  });
  if (removedKey) await deleteObjectSafely(s3, removedKey);
  return result;
}

/** Pasport faylining imzolangan URL'i — namuna ko'rinishi va pasport mavjudligi tekshirilgandan KEYIN. */
export async function getPassportFileLink(
  storage: FileStorage | null,
  sample: Pick<SampleRow, 'company_id' | 'passport_file_path' | 'passport_file_name'>,
): Promise<DownloadLink> {
  if (!sample.passport_file_path)
    throw new AppError(404, 'PASSPORT_NOT_FOUND', DENIAL_MESSAGES.PASSPORT_NOT_FOUND);
  const s3 = requireStorage(storage);
  const file = await findFileByKey(sample.company_id, sample.passport_file_path);
  const filename = file?.filename ?? sample.passport_file_name ?? 'passport';
  const mime =
    file?.mime_type ??
    Object.values(FILE_KINDS).find((k) => k.extensions.includes(extensionOf(filename)))?.mime ??
    'application/octet-stream';
  return getDownloadUrl(s3, { r2_key: sample.passport_file_path, filename, mime_type: mime });
}

export async function getPassportDownload(
  storage: FileStorage | null,
  ctx: PassportContext,
  sampleId: string,
): Promise<DownloadLink> {
  const sample = await loadVisibleSample(null, ctx, sampleId);
  return getPassportFileLink(storage, sample);
}
