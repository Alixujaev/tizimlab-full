import crypto from 'node:crypto';
import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { generateProtocolDocx, type ExportLang } from '../../utils/docxExport.js';
import { writeAudit } from '../audit/audit.service.js';
import { type FileStorage, requireStorage, SIGNED_URL_TTL_SECONDS } from '../files/files.storage.js';
import {
  buildKey,
  deleteFileRecordByKey,
  deleteObjectSafely,
  insertFileRecord,
  runWithUpload,
} from '../files/files.service.js';
import {
  assertAllowedFile,
  contentDisposition,
  type IncomingFile,
  PASSPORT_MAX_BYTES,
} from '../files/files.validation.js';
import type { SampleRow, SampleType } from '../samples/samples.types.js';
import { protocolHooks } from './protocols.hooks.js';
import {
  assertCanApprove,
  assertCanCreateInProcess,
  assertCanFinalize,
  assertCanReject,
  assertCanSubmit,
  assertCanUploadFile,
} from './protocols.state-machine.js';
import type {
  ProtocolDetailDto,
  ProtocolDto,
  ProtocolFileDto,
  ProtocolFileRow,
  ProtocolRole,
  ProtocolRow,
  ProtocolSignatureAction,
  ProtocolSignatureDto,
  ProtocolSignatureRow,
  RejectProtocolInput,
  RequestMeta,
  UserContext,
} from './protocols.types.js';

export function toProtocolDto(
  row: ProtocolRow & { creator_name?: string | null },
): ProtocolDto {
  return {
    id: row.id,
    companyId: row.company_id,
    sampleId: row.sample_id,
    createdBy: row.created_by,
    createdByName: row.creator_name ?? null,
    status: row.status,
    protocolRole: row.protocol_role,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileMime: row.file_mime,
    passportFileName: row.passport_file_name ?? null,
    passportFilePath: row.passport_file_path ?? null,
    passportFileSize: row.passport_file_size ?? null,
    passportFileMime: row.passport_file_mime ?? null,
    passportUploadedBy: row.passport_uploaded_by ?? null,
    passportUploadedAt: row.passport_uploaded_at
      ? new Date(row.passport_uploaded_at).toISOString()
      : null,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at?.toISOString() ?? null,
    approvedAt: row.approved_at?.toISOString() ?? null,
    finalizedAt: row.finalized_at?.toISOString() ?? null,
    rejectedAt: row.rejected_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toSignatureDto(
  row: ProtocolSignatureRow & { user_full_name?: string | null },
): ProtocolSignatureDto {
  return {
    id: row.id,
    userId: row.user_id,
    userFullName: row.user_full_name ?? null,
    role: row.role,
    action: row.action,
    signatureHash: row.signature_hash,
    ipAddress: row.ip_address,
    signedAt: row.signed_at.toISOString(),
  };
}

export function createSignatureHash(params: {
  protocolId: string;
  userId: string;
  role: string;
  action: string;
  signedAt: Date;
  companyId: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      `${params.protocolId}:${params.userId}:${params.role}:${params.action}:${params.signedAt.toISOString()}:${params.companyId}`,
    )
    .digest('hex');
}

export async function recordSignature(
  client: pg.PoolClient,
  params: {
    companyId: string;
    protocolId: string;
    userId: string;
    role: ProtocolSignatureRow['role'];
    action: ProtocolSignatureAction;
    ip?: string | null;
  },
): Promise<ProtocolSignatureRow> {
  const signedAt = new Date();
  const signatureHash = createSignatureHash({
    protocolId: params.protocolId,
    userId: params.userId,
    role: params.role,
    action: params.action,
    signedAt,
    companyId: params.companyId,
  });

  const res = await client.query<ProtocolSignatureRow>(
    `INSERT INTO protocol_signatures (
       company_id, protocol_id, user_id, role, action, signature_hash, ip_address, signed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.companyId,
      params.protocolId,
      params.userId,
      params.role,
      params.action,
      signatureHash,
      params.ip ?? null,
      signedAt,
    ],
  );
  return res.rows[0]!;
}

interface SampleLookup {
  id: string;
  company_id: string;
  type: SampleType;
  status: SampleRow['status'];
  substance_name: string;
  assigned_to: string | null;
  created_by: string;
}

async function getProtocolAndSample(
  companyId: string,
  protocolId: string,
  client?: pg.PoolClient,
): Promise<{ protocol: ProtocolRow; sample: SampleLookup }> {
  const runner = client ? client.query.bind(client) : query;
  const res = await runner<ProtocolRow & {
    sample_company_id: string;
    sample_type: SampleType;
    sample_status: SampleRow['status'];
    sample_substance_name: string;
    sample_assigned_to: string | null;
    sample_created_by: string;
  }>(
    `SELECT p.*,
            s.company_id AS sample_company_id,
            s.type AS sample_type,
            s.status AS sample_status,
            s.substance_name AS sample_substance_name,
            s.assigned_to AS sample_assigned_to,
            s.created_by AS sample_created_by
     FROM protocols p
     JOIN samples s ON s.id = p.sample_id
     WHERE p.id = $1 AND p.company_id = $2`,
    [protocolId, companyId],
  );

  const row = res.rows[0];
  if (!row) {
    throw new NotFoundError('Protokol topilmadi');
  }

  const {
    sample_company_id,
    sample_type,
    sample_status,
    sample_substance_name,
    sample_assigned_to,
    sample_created_by,
    ...protocol
  } = row;

  return {
    protocol: protocol as ProtocolRow,
    sample: {
      id: protocol.sample_id,
      company_id: sample_company_id,
      type: sample_type,
      status: sample_status,
      substance_name: sample_substance_name,
      assigned_to: sample_assigned_to,
      created_by: sample_created_by,
    },
  };
}

function assertProtocolViewAccess(
  user: UserContext,
  sample: SampleLookup,
  protocol: ProtocolRow,
): void {
  if (user.role === 'kontrolyor') {
    throw new NotFoundError('Protokol topilmadi');
  }
  if (user.role === 'chemist') {
    const isAssigned = sample.assigned_to === user.id;
    const isCreator = protocol.created_by === user.id;
    if (!isAssigned && !isCreator) {
      throw new NotFoundError('Protokol topilmadi');
    }
  }
}

export async function getProtocolById(
  companyId: string,
  user: UserContext,
  protocolId: string,
): Promise<ProtocolDetailDto> {
  const { protocol, sample } = await getProtocolAndSample(companyId, protocolId);
  assertProtocolViewAccess(user, sample, protocol);

  const signaturesRes = await query<ProtocolSignatureRow & { user_full_name: string | null }>(
    `SELECT ps.*, u.full_name AS user_full_name
     FROM protocol_signatures ps
     LEFT JOIN users u ON u.id = ps.user_id
     WHERE ps.protocol_id = $1 AND ps.company_id = $2
     ORDER BY ps.signed_at ASC`,
    [protocolId, companyId],
  );

  const creatorRes = await query<{ full_name: string }>(
    `SELECT full_name FROM users WHERE id = $1`,
    [protocol.created_by],
  );

  const files = await listProtocolFiles(companyId, user, protocolId);

  return {
    ...toProtocolDto({
      ...protocol,
      creator_name: creatorRes.rows[0]?.full_name ?? null,
    }),
    sampleSubstanceName: sample.substance_name,
    sampleType: sample.type,
    sampleStatus: sample.status,
    sampleAssignedTo: sample.assigned_to,
    signatures: signaturesRes.rows.map(toSignatureDto),
    files,
  };
}

export async function getProtocolsBySampleId(
  companyId: string,
  user: UserContext,
  sampleId: string,
): Promise<ProtocolDetailDto[]> {
  const sampleRes = await query<SampleLookup>(
    `SELECT id, company_id, type, status, substance_name, assigned_to, created_by
     FROM samples
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [sampleId, companyId],
  );
  const sample = sampleRes.rows[0];
  if (!sample) {
    throw new NotFoundError('Namuna topilmadi');
  }

  // Kontrolyor protokol ma'lumotlarini ko'ra oladi faqat o'zi yaratgan namunada (pasport bloki uchun)
  if (user.role === 'kontrolyor') {
    if (sample.created_by !== user.id) {
      return [];
    }
  }

  // Kimyogar faqat o'ziga biriktirilgan namunani ko'radi
  if (user.role === 'chemist' && sample.assigned_to !== user.id) {
    return [];
  }

  const protocolsRes = await query<ProtocolRow & { creator_name: string | null }>(
    `SELECT p.*, u.full_name AS creator_name
     FROM protocols p
     LEFT JOIN users u ON u.id = p.created_by
     WHERE p.sample_id = $1 AND p.company_id = $2
     ORDER BY (CASE WHEN p.protocol_role = 'final' THEN 1 WHEN p.protocol_role = 'standard' THEN 2 ELSE 3 END), p.created_at ASC`,
    [sampleId, companyId],
  );

  const result: ProtocolDetailDto[] = [];
  for (const protocol of protocolsRes.rows) {
    const signaturesRes = await query<ProtocolSignatureRow & { user_full_name: string | null }>(
      `SELECT ps.*, u.full_name AS user_full_name
       FROM protocol_signatures ps
       LEFT JOIN users u ON u.id = ps.user_id
       WHERE ps.protocol_id = $1 AND ps.company_id = $2
       ORDER BY ps.signed_at ASC`,
      [protocol.id, companyId],
    );

    const files = await listProtocolFiles(companyId, user, protocol.id);

    result.push({
      ...toProtocolDto(protocol),
      sampleSubstanceName: sample.substance_name,
      sampleType: sample.type,
      sampleStatus: sample.status,
      sampleAssignedTo: sample.assigned_to,
      signatures: signaturesRes.rows.map(toSignatureDto),
      files,
    });
  }

  return result;
}

export async function createInProcessProtocol(
  companyId: string,
  user: UserContext,
  sampleId: string,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  return withTransaction(async (client) => {
    const sampleRes = await client.query<SampleLookup>(
      `SELECT id, company_id, type, status, substance_name, assigned_to, created_by
       FROM samples
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [sampleId, companyId],
    );
    const sample = sampleRes.rows[0];
    if (!sample) {
      throw new NotFoundError('Namuna topilmadi');
    }

    const existingProtocolsRes = await client.query<{ protocol_role: ProtocolRole }>(
      `SELECT protocol_role FROM protocols WHERE sample_id = $1 AND company_id = $2`,
      [sampleId, companyId],
    );
    const existingRoles = existingProtocolsRes.rows.map((r) => r.protocol_role);

    assertCanCreateInProcess({
      sampleType: sample.type,
      sampleStatus: sample.status,
      userRole: user.role,
      isAssignedChemist: sample.assigned_to === user.id,
      existingRoles,
    });

    const insertRes = await client.query<ProtocolRow>(
      `INSERT INTO protocols (
         company_id, sample_id, created_by, status, protocol_role
       ) VALUES ($1, $2, $3, 'draft', 'in_process')
       RETURNING *`,
      [companyId, sampleId, user.id],
    );
    const protocol = insertRes.rows[0]!;

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'create',
      tableName: 'protocols',
      recordId: protocol.id,
      newValues: {
        id: protocol.id,
        sampleId,
        protocolRole: 'in_process',
        status: 'draft',
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toProtocolDto(protocol);
  });
}

export async function uploadMainFile(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  file: IncomingFile | undefined,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  const validated = assertAllowedFile(file, PASSPORT_MAX_BYTES);
  const store = requireStorage(storage);

  let oldFilePathToDelete: string | null = null;
  let newFilePath: string | null = null;

  try {
    const updated = await withTransaction(async (client) => {
      const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);

      assertCanUploadFile({
        protocolStatus: protocol.status,
        sampleStatus: sample.status,
        userRole: user.role,
        isAssignedChemist: sample.assigned_to === user.id,
      });

      const ext = validated.ext;
      newFilePath = `${companyId}/protocols/${protocolId}/${crypto.randomUUID()}.${ext}`;

      await store.put(newFilePath, validated.buffer, validated.mime);

      if (protocol.file_path && protocol.file_path !== newFilePath) {
        oldFilePathToDelete = protocol.file_path;
      }

      const updateRes = await client.query<ProtocolRow>(
        `UPDATE protocols
         SET file_path = $1, file_name = $2, file_size = $3, file_mime = $4
         WHERE id = $5 AND company_id = $6
         RETURNING *`,
        [newFilePath, validated.filename, validated.size, validated.mime, protocolId, companyId],
      );

      const saved = updateRes.rows[0]!;

      await writeAudit(client, {
        userId: user.id,
        companyId,
        action: protocol.file_path ? 'replace_file' : 'upload_file',
        tableName: 'protocols',
        recordId: protocolId,
        oldValues: {
          filePath: protocol.file_path,
          fileName: protocol.file_name,
        },
        newValues: {
          filePath: saved.file_path,
          fileName: saved.file_name,
          fileSize: saved.file_size,
          fileMime: saved.file_mime,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return saved;
    });

    // Tranzaksiya muvaffaqiyatli commit bo'lgach, eski fayl R2'dan tozalanadi (yetim fayl qolmasligi uchun)
    if (oldFilePathToDelete) {
      await deleteObjectSafely(store, oldFilePathToDelete);
    }

    return toProtocolDto(updated);
  } catch (err) {
    // Tranzaksiya muvaffaqiyatsiz bo'lsa yangi yuklangan fayl R2'dan tozalanishi lozim
    if (newFilePath) {
      await deleteObjectSafely(store, newFilePath);
    }
    throw err;
  }
}

export async function deleteMainFile(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  const store = requireStorage(storage);
  let oldFilePathToDelete: string | null = null;

  const updated = await withTransaction(async (client) => {
    const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);

    assertCanUploadFile({
      protocolStatus: protocol.status,
      sampleStatus: sample.status,
      userRole: user.role,
      isAssignedChemist: sample.assigned_to === user.id,
    });

    if (!protocol.file_path) {
      throw new NotFoundError('Protokolda o‘chirish uchun fayl mavjud emas');
    }

    oldFilePathToDelete = protocol.file_path;

    const updateRes = await client.query<ProtocolRow>(
      `UPDATE protocols
       SET file_path = NULL, file_name = NULL, file_size = NULL, file_mime = NULL
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [protocolId, companyId],
    );

    const saved = updateRes.rows[0]!;

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'delete_file',
      tableName: 'protocols',
      recordId: protocolId,
      oldValues: {
        filePath: protocol.file_path,
        fileName: protocol.file_name,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return saved;
  });

  if (oldFilePathToDelete) {
    await deleteObjectSafely(store, oldFilePathToDelete);
  }

  return toProtocolDto(updated);
}

export async function getMainFileDownloadUrl(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
): Promise<{ url: string; filename: string }> {
  const { protocol, sample } = await getProtocolAndSample(companyId, protocolId);
  assertProtocolViewAccess(user, sample, protocol);

  if (!protocol.file_path || !protocol.file_name) {
    throw new NotFoundError('Protokol tahlil fayli topilmadi');
  }

  const store = requireStorage(storage);
  const disposition = contentDisposition(protocol.file_name);
  const url = await store.getSignedUrl(protocol.file_path, {
    contentDisposition: disposition,
    contentType: protocol.file_mime ?? 'application/octet-stream',
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });

  return {
    url,
    filename: protocol.file_name,
  };
}

export async function submitProtocol(
  companyId: string,
  user: UserContext,
  protocolId: string,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  return withTransaction(async (client) => {
    const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);

    const isAssigned = sample.assigned_to === user.id;
    assertCanSubmit({
      protocolStatus: protocol.status,
      sampleStatus: sample.status,
      hasFile: Boolean(protocol.file_path),
      userRole: user.role,
      isAssignedChemist: isAssigned,
    });

    const previousStatus = protocol.status;

    const updateRes = await client.query<ProtocolRow>(
      `UPDATE protocols
       SET status = 'submitted', submitted_at = now(), rejection_reason = NULL
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [protocolId, companyId],
    );
    const updatedProtocol = updateRes.rows[0]!;

    // Imzo yozuvi (action: 'submitted')
    await recordSignature(client, {
      companyId,
      protocolId,
      userId: user.id,
      role: user.role,
      action: 'submitted',
      ip: meta.ip,
    });

    // Standard yoki Final protokol bo'lsa, namunani submitted ga o'tkazish (D-14, D-15)
    if (protocol.protocol_role === 'standard' || protocol.protocol_role === 'final') {
      await client.query(
        `UPDATE samples
         SET status = 'submitted'
         WHERE id = $1 AND company_id = $2`,
        [sample.id, companyId],
      );

      await client.query(
        `INSERT INTO sample_tracking (
           company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata
         ) VALUES ($1, $2, 'submitted', $3, $4, 'submitted', NULL, $5)`,
        [
          companyId,
          sample.id,
          user.id,
          sample.status,
          JSON.stringify({ protocolId: protocol.id, protocolRole: protocol.protocol_role }),
        ],
      );
    }

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'submit',
      tableName: 'protocols',
      recordId: protocolId,
      oldValues: { status: previousStatus },
      newValues: { status: 'submitted' },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await protocolHooks.onProtocolStatusChanged?.(
      updatedProtocol,
      previousStatus,
      'submitted',
      meta,
    );

    return toProtocolDto(updatedProtocol);
  });
}

export async function approveProtocol(
  companyId: string,
  user: UserContext,
  protocolId: string,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  return withTransaction(async (client) => {
    const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);

    assertCanApprove({
      protocolStatus: protocol.status,
      userRole: user.role,
    });

    const previousStatus = protocol.status;

    const updateRes = await client.query<ProtocolRow>(
      `UPDATE protocols
       SET status = 'approved', approved_at = now()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [protocolId, companyId],
    );
    const updatedProtocol = updateRes.rows[0]!;

    // Imzo yozuvi (action: 'approved')
    await recordSignature(client, {
      companyId,
      protocolId,
      userId: user.id,
      role: user.role,
      action: 'approved',
      ip: meta.ip,
    });

    // Standard yoki Final protokol tasdiqlansa, namuna ham approved bo'ladi (D-15, R-PROTO-17)
    if (protocol.protocol_role === 'standard' || protocol.protocol_role === 'final') {
      await client.query(
        `UPDATE samples
         SET status = 'approved'
         WHERE id = $1 AND company_id = $2`,
        [sample.id, companyId],
      );

      await client.query(
        `INSERT INTO sample_tracking (
           company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata
         ) VALUES ($1, $2, 'approved', $3, $4, 'approved', NULL, $5)`,
        [
          companyId,
          sample.id,
          user.id,
          sample.status,
          JSON.stringify({ protocolId: protocol.id, protocolRole: protocol.protocol_role }),
        ],
      );
    }

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'approve',
      tableName: 'protocols',
      recordId: protocolId,
      oldValues: { status: previousStatus },
      newValues: { status: 'approved' },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await protocolHooks.onProtocolStatusChanged?.(
      updatedProtocol,
      previousStatus,
      'approved',
      meta,
    );

    return toProtocolDto(updatedProtocol);
  });
}

export async function rejectProtocol(
  companyId: string,
  user: UserContext,
  protocolId: string,
  input: RejectProtocolInput,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  const reason = input.reason?.trim() ?? '';

  return withTransaction(async (client) => {
    const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);

    assertCanReject({
      protocolStatus: protocol.status,
      userRole: user.role,
      reason,
    });

    const previousStatus = protocol.status;

    const updateRes = await client.query<ProtocolRow>(
      `UPDATE protocols
       SET status = 'rejected', rejected_at = now(), rejection_reason = $1
       WHERE id = $2 AND company_id = $3
       RETURNING *`,
      [reason, protocolId, companyId],
    );
    const updatedProtocol = updateRes.rows[0]!;

    // Imzo yozuvi (action: 'rejected')
    await recordSignature(client, {
      companyId,
      protocolId,
      userId: user.id,
      role: user.role,
      action: 'rejected',
      ip: meta.ip,
    });

    // Standard yoki Final protokol rad etilsa, namuna ham rejected bo'ladi (D-14)
    if (protocol.protocol_role === 'standard' || protocol.protocol_role === 'final') {
      await client.query(
        `UPDATE samples
         SET status = 'rejected'
         WHERE id = $1 AND company_id = $2`,
        [sample.id, companyId],
      );

      await client.query(
        `INSERT INTO sample_tracking (
           company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata
         ) VALUES ($1, $2, 'rejected', $3, $4, 'rejected', $5, $6)`,
        [
          companyId,
          sample.id,
          user.id,
          sample.status,
          reason,
          JSON.stringify({ protocolId: protocol.id, protocolRole: protocol.protocol_role }),
        ],
      );
    }

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'reject',
      tableName: 'protocols',
      recordId: protocolId,
      oldValues: { status: previousStatus },
      newValues: { status: 'rejected', rejectionReason: reason },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await protocolHooks.onProtocolStatusChanged?.(
      updatedProtocol,
      previousStatus,
      'rejected',
      meta,
    );

    return toProtocolDto(updatedProtocol);
  });
}

export async function finalizeProtocol(
  companyId: string,
  user: UserContext,
  protocolId: string,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  return withTransaction(async (client) => {
    const { protocol } = await getProtocolAndSample(companyId, protocolId, client);

    assertCanFinalize({
      protocolStatus: protocol.status,
      userRole: user.role,
    });

    const previousStatus = protocol.status;

    const updateRes = await client.query<ProtocolRow>(
      `UPDATE protocols
       SET status = 'finalized', finalized_at = now()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [protocolId, companyId],
    );
    const updatedProtocol = updateRes.rows[0]!;

    // Imzo yozuvi (action: 'finalized')
    await recordSignature(client, {
      companyId,
      protocolId,
      userId: user.id,
      role: user.role,
      action: 'finalized',
      ip: meta.ip,
    });

    // Direktor finalizatsiyasi namunani reyestrdan chiqarmaydi va namuna statusini o'zgartirmaydi (D-07, Q-34)

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'finalize',
      tableName: 'protocols',
      recordId: protocolId,
      oldValues: { status: previousStatus },
      newValues: { status: 'finalized' },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await protocolHooks.onProtocolStatusChanged?.(
      updatedProtocol,
      previousStatus,
      'finalized',
      meta,
    );

    return toProtocolDto(updatedProtocol);
  });
}

/**
 * Namuna kimyogarga biriktirilganda avtomatik protokol yaratish (D-15, Spec §3).
 * finished_product -> 'final' draft; boshqa turlar -> 'standard' draft.
 * Qayta biriktirishda (reassign) mavjud protokol saqlanadi (Q-15, D-37).
 */
export async function autoCreateProtocolOnAssignment(
  client: pg.PoolClient,
  companyId: string,
  sampleId: string,
  sampleType: SampleType,
  assignedByUserId: string,
): Promise<ProtocolRow | null> {
  if (sampleType === 'reagent' || sampleType === 'standard_substance') {
    return null;
  }

  const role: ProtocolRole = sampleType === 'finished_product' ? 'final' : 'standard';

  const existingRes = await client.query<ProtocolRow>(
    `SELECT * FROM protocols WHERE sample_id = $1 AND protocol_role = $2 AND company_id = $3`,
    [sampleId, role, companyId],
  );

  if (existingRes.rows[0]) {
    return existingRes.rows[0];
  }

  const insertRes = await client.query<ProtocolRow>(
    `INSERT INTO protocols (
       company_id, sample_id, created_by, status, protocol_role
     ) VALUES ($1, $2, $3, 'draft', $4)
     RETURNING *`,
    [companyId, sampleId, assignedByUserId, role],
  );

  return insertRes.rows[0]!;
}

/**
 * Pasport orqali tasdiqlanganda ochiq protokollarni approved holatiga o'tkazish (D-42, R-PASS-08).
 * Imzo va xabarnomasiz, tracking'ga "pasport orqali yopildi" deb yoziladi.
 */
export async function closeOpenProtocolsForSample(
  client: pg.PoolClient,
  companyId: string,
  sampleId: string,
  userId: string,
): Promise<number> {
  const openProtocolsRes = await client.query<ProtocolRow>(
    `UPDATE protocols
     SET status = 'approved', approved_at = now()
     WHERE sample_id = $1 AND company_id = $2 AND status IN ('draft', 'submitted', 'rejected')
     RETURNING id, protocol_role`,
    [sampleId, companyId],
  );

  for (const row of openProtocolsRes.rows) {
    await client.query(
      `INSERT INTO sample_tracking (
         company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata
       ) VALUES ($1, $2, 'approved', $3, NULL, 'approved', 'pasport orqali yopildi', $4)`,
      [
        companyId,
        sampleId,
        userId,
        JSON.stringify({ protocolId: row.id, protocolRole: row.protocol_role, via: 'passport' }),
      ],
    );
  }

  return openProtocolsRes.rowCount ?? 0;
}

// ----------------------------------------------------
// PROTOKOL PASPORTI (D-123, R-PROTO-31)
// ----------------------------------------------------

export const PROTOCOL_PASSPORT_ENTITY = 'protocol-passports';
export const PROTOCOL_FILE_ENTITY = 'protocol-files';

export function assertCanUploadProtocolPassport(
  user: UserContext,
  sample: SampleLookup,
  _protocol: ProtocolRow,
): void {
  if (user.role === 'director') {
    throw new AppError(403, 'FORBIDDEN', 'Direktor protokol pasportini yuklay olmaydi');
  }
  if (user.role === 'kontrolyor' || user.role === 'lab_head' || user.role === 'admin') {
    return;
  }
  if (user.role === 'chemist') {
    if (sample.assigned_to !== user.id) {
      throw new NotFoundError('Protokol topilmadi');
    }
    return;
  }
  throw new AppError(403, 'FORBIDDEN', 'Ushbu rolda protokol pasportini yuklash huquqi yo‘q');
}

export function assertCanDeleteProtocolPassport(
  user: UserContext,
  protocol: ProtocolRow,
): void {
  if (user.role === 'lab_head' || user.role === 'admin') {
    return;
  }
  if (protocol.passport_uploaded_by && protocol.passport_uploaded_by === user.id) {
    return;
  }
  throw new AppError(
    403,
    'FORBIDDEN',
    'Faqat pasportni yuklagan foydalanuvchi yoki laboratoriya mudiri/admin o‘chira oladi',
  );
}

export async function uploadProtocolPassport(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  file: IncomingFile | undefined,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  const store = requireStorage(storage);
  const validated = assertAllowedFile(file, PASSPORT_MAX_BYTES);

  const { protocol: preview, sample: samplePreview } = await getProtocolAndSample(
    companyId,
    protocolId,
  );
  assertCanUploadProtocolPassport(user, samplePreview, preview);

  const key = buildKey(companyId, PROTOCOL_PASSPORT_ENTITY, validated.ext);
  let oldPassportKeyToDelete: string | null = null;

  const updated = await runWithUpload(
    store,
    { key, body: validated.buffer, contentType: validated.mime },
    async (client) => {
      const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);
      assertCanUploadProtocolPassport(user, sample, protocol);

      oldPassportKeyToDelete = protocol.passport_file_path;
      if (oldPassportKeyToDelete) {
        await deleteFileRecordByKey(
          client,
          { userId: user.id, companyId, ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined },
          oldPassportKeyToDelete,
        );
      }

      await insertFileRecord(
        client,
        { userId: user.id, companyId, ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined },
        { key, file: validated, sampleId: protocol.sample_id },
      );

      const updateRes = await client.query<ProtocolRow>(
        `UPDATE protocols
         SET passport_file_name = $1,
             passport_file_path = $2,
             passport_file_size = $3,
             passport_file_mime = $4,
             passport_uploaded_by = $5,
             passport_uploaded_at = now()
         WHERE id = $6 AND company_id = $7
         RETURNING *`,
        [
          validated.filename,
          key,
          validated.size,
          validated.mime,
          user.id,
          protocolId,
          companyId,
        ],
      );

      const saved = updateRes.rows[0]!;

      await writeAudit(client, {
        userId: user.id,
        companyId,
        action: 'passport_upload',
        tableName: 'protocols',
        recordId: protocolId,
        newValues: {
          passportFileName: validated.filename,
          passportFilePath: key,
          passportFileSize: validated.size,
        },
        oldValues: oldPassportKeyToDelete ? { passportFilePath: oldPassportKeyToDelete } : undefined,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return saved;
    },
  );

  if (oldPassportKeyToDelete) {
    await deleteObjectSafely(store, oldPassportKeyToDelete);
  }

  return toProtocolDto(updated);
}

export async function getProtocolPassportDownload(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
): Promise<{ url: string; expiresIn: number; filename: string }> {
  const { protocol, sample } = await getProtocolAndSample(companyId, protocolId);
  if (user.role === 'chemist' && sample.assigned_to !== user.id) {
    throw new NotFoundError('Protokol topilmadi');
  }

  if (!protocol.passport_file_path || !protocol.passport_file_name) {
    throw new NotFoundError('Protokol pasporti topilmadi');
  }

  const store = requireStorage(storage);
  const disposition = contentDisposition(protocol.passport_file_name);
  const url = await store.getSignedUrl(protocol.passport_file_path, {
    contentDisposition: disposition,
    contentType: protocol.passport_file_mime ?? 'application/octet-stream',
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });

  return {
    url,
    expiresIn: SIGNED_URL_TTL_SECONDS,
    filename: protocol.passport_file_name,
  };
}

export async function deleteProtocolPassport(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  meta: RequestMeta,
): Promise<ProtocolDto> {
  const store = requireStorage(storage);
  let keyToDelete: string | null = null;

  const updated = await withTransaction(async (client) => {
    const { protocol } = await getProtocolAndSample(companyId, protocolId, client);
    assertCanDeleteProtocolPassport(user, protocol);

    if (!protocol.passport_file_path) {
      throw new NotFoundError('Protokol pasporti topilmadi');
    }

    keyToDelete = protocol.passport_file_path;

    await deleteFileRecordByKey(
      client,
      { userId: user.id, companyId, ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined },
      keyToDelete,
    );

    const updateRes = await client.query<ProtocolRow>(
      `UPDATE protocols
       SET passport_file_name = NULL,
           passport_file_path = NULL,
           passport_file_size = NULL,
           passport_file_mime = NULL,
           passport_uploaded_by = NULL,
           passport_uploaded_at = NULL
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [protocolId, companyId],
    );

    const saved = updateRes.rows[0]!;

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'passport_delete',
      tableName: 'protocols',
      recordId: protocolId,
      oldValues: {
        passportFileName: protocol.passport_file_name,
        passportFilePath: protocol.passport_file_path,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return saved;
  });

  if (keyToDelete) {
    await deleteObjectSafely(store, keyToDelete);
  }

  return toProtocolDto(updated);
}

// ----------------------------------------------------
// PROTOKOL QO'SHIMCHA FAYLLARI (D-49, D-76, D-124)
// ----------------------------------------------------

export async function uploadProtocolFile(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  file: IncomingFile | undefined,
  meta: RequestMeta,
): Promise<ProtocolFileDto> {
  const store = requireStorage(storage);
  const validated = assertAllowedFile(file, PASSPORT_MAX_BYTES);

  const { protocol: preview, sample: samplePreview } = await getProtocolAndSample(
    companyId,
    protocolId,
  );

  // Faqat finished_product namunasining protokollarida (D-49, D-76, D-124)
  if (samplePreview.type !== 'finished_product') {
    throw new AppError(
      422,
      'PROTOCOL_FILES_NOT_ALLOWED',
      'Qo‘shimcha fayllar faqat tayyor mahsulot (finished_product) protokollariga biriktirilishi mumkin',
    );
  }

  // Ruxsat: biriktirilgan kimyogar, lab_head, admin. Kontrolyor va direktor yo'q
  if (user.role === 'kontrolyor' || user.role === 'director') {
    throw new AppError(403, 'FORBIDDEN', 'Ushbu rolda qo‘shimcha fayl yuklash huquqi yo‘q');
  }
  if (user.role === 'chemist') {
    if (samplePreview.assigned_to !== user.id) {
      throw new NotFoundError('Protokol topilmadi');
    }
  } else if (user.role !== 'lab_head' && user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Ruxsat berilmagan');
  }

  // Protokol qulfi: faqat draft/rejected (D-47)
  if (preview.status !== 'draft' && preview.status !== 'rejected') {
    throw new AppError(
      409,
      'PROTOCOL_LOCKED',
      'Protokol qulflangan holatda yangi qo‘shimcha fayl yuklash taqiqlanadi',
    );
  }
  if (samplePreview.status === 'stopped') {
    throw new AppError(409, 'SAMPLE_STOPPED', 'To‘xtatilgan namunada fayl yuklash taqiqlanadi');
  }

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::int AS count FROM protocol_files WHERE protocol_id = $1 AND company_id = $2`,
    [protocolId, companyId],
  );
  if (Number(countRes.rows[0]?.count ?? 0) >= 10) {
    throw new AppError(
      422,
      'MAX_FILES_EXCEEDED',
      'Bitta protokolga ko‘pi bilan 10 ta qo‘shimcha fayl biriktirish mumkin',
    );
  }

  const key = buildKey(companyId, PROTOCOL_FILE_ENTITY, validated.ext);

  return runWithUpload(
    store,
    { key, body: validated.buffer, contentType: validated.mime },
    async (client) => {
      const fileRecord = await insertFileRecord(
        client,
        { userId: user.id, companyId, ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined },
        { key, file: validated, sampleId: preview.sample_id },
      );

      const insertRes = await client.query<ProtocolFileRow>(
        `INSERT INTO protocol_files (company_id, protocol_id, file_id, uploaded_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [companyId, protocolId, fileRecord.id, user.id],
      );

      const pfRow = insertRes.rows[0]!;

      await writeAudit(client, {
        userId: user.id,
        companyId,
        action: 'protocol_file_upload',
        tableName: 'protocol_files',
        recordId: pfRow.id,
        newValues: {
          protocolId,
          fileId: fileRecord.id,
          filename: validated.filename,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const userRes = await client.query<{ full_name: string }>(
        `SELECT full_name FROM users WHERE id = $1`,
        [user.id],
      );

      return {
        id: pfRow.id,
        protocolId: pfRow.protocol_id,
        fileId: pfRow.file_id,
        fileName: validated.filename,
        fileSize: validated.size,
        fileMime: validated.mime,
        uploadedBy: pfRow.uploaded_by,
        uploadedByName: userRes.rows[0]?.full_name ?? null,
        createdAt: pfRow.created_at.toISOString(),
      };
    },
  );
}

export async function listProtocolFiles(
  companyId: string,
  user: UserContext,
  protocolId: string,
): Promise<ProtocolFileDto[]> {
  const { protocol, sample } = await getProtocolAndSample(companyId, protocolId);
  if (user.role === 'kontrolyor') {
    return [];
  }
  assertProtocolViewAccess(user, sample, protocol);

  const res = await query<ProtocolFileRow>(
    `SELECT pf.*, f.filename, f.size_bytes, f.mime_type, f.r2_key, u.full_name AS uploaded_by_name
     FROM protocol_files pf
     JOIN files f ON f.id = pf.file_id
     LEFT JOIN users u ON u.id = pf.uploaded_by
     WHERE pf.protocol_id = $1 AND pf.company_id = $2
     ORDER BY pf.created_at ASC`,
    [protocolId, companyId],
  );

  return res.rows.map((r) => ({
    id: r.id,
    protocolId: r.protocol_id,
    fileId: r.file_id,
    fileName: r.filename ?? 'file',
    fileSize: Number(r.size_bytes ?? 0),
    fileMime: r.mime_type ?? 'application/octet-stream',
    uploadedBy: r.uploaded_by,
    uploadedByName: r.uploaded_by_name ?? null,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getProtocolFileDownload(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  fileId: string,
): Promise<{ url: string; expiresIn: number; filename: string }> {
  const { protocol, sample } = await getProtocolAndSample(companyId, protocolId);
  assertProtocolViewAccess(user, sample, protocol);

  const res = await query<ProtocolFileRow>(
    `SELECT pf.*, f.filename, f.size_bytes, f.mime_type, f.r2_key
     FROM protocol_files pf
     JOIN files f ON f.id = pf.file_id
     WHERE pf.id = $1 AND pf.protocol_id = $2 AND pf.company_id = $3`,
    [fileId, protocolId, companyId],
  );

  const row = res.rows[0];
  if (!row || !row.r2_key) {
    throw new NotFoundError('Qo‘shimcha fayl topilmadi');
  }

  const store = requireStorage(storage);
  const filename = row.filename ?? 'file';
  const disposition = contentDisposition(filename);
  const url = await store.getSignedUrl(row.r2_key, {
    contentDisposition: disposition,
    contentType: row.mime_type ?? 'application/octet-stream',
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });

  return {
    url,
    expiresIn: SIGNED_URL_TTL_SECONDS,
    filename,
  };
}

export async function deleteProtocolFile(
  storage: FileStorage | null,
  companyId: string,
  user: UserContext,
  protocolId: string,
  fileId: string,
  meta: RequestMeta,
): Promise<{ success: true }> {
  const store = requireStorage(storage);
  let keyToDelete: string | null = null;

  await withTransaction(async (client) => {
    const { protocol, sample } = await getProtocolAndSample(companyId, protocolId, client);
    assertProtocolViewAccess(user, sample, protocol);

    const res = await client.query<ProtocolFileRow>(
      `SELECT pf.*, f.r2_key, f.filename
       FROM protocol_files pf
       JOIN files f ON f.id = pf.file_id
       WHERE pf.id = $1 AND pf.protocol_id = $2 AND pf.company_id = $3`,
      [fileId, protocolId, companyId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError('Qo‘shimcha fayl topilmadi');
    }

    if (user.role === 'kontrolyor' || user.role === 'director') {
      throw new AppError(403, 'FORBIDDEN', 'Ushbu rolda qo‘shimcha faylni o‘chirish huquqi yo‘q');
    }

    if (protocol.status !== 'draft' && protocol.status !== 'rejected') {
      throw new AppError(
        409,
        'PROTOCOL_LOCKED',
        'Protokol qulflangan holatda qo‘shimcha faylni o‘chirish taqiqlanadi',
      );
    }

    if (user.role !== 'lab_head' && user.role !== 'admin' && row.uploaded_by !== user.id) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Faqat faylni yuklagan foydalanuvchi yoki laboratoriya mudiri/admin o‘chira oladi',
      );
    }

    keyToDelete = row.r2_key ?? null;

    await client.query(
      `DELETE FROM protocol_files WHERE id = $1 AND protocol_id = $2 AND company_id = $3`,
      [fileId, protocolId, companyId],
    );

    if (keyToDelete) {
      await deleteFileRecordByKey(
        client,
        { userId: user.id, companyId, ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined },
        keyToDelete,
      );
    }

    await writeAudit(client, {
      userId: user.id,
      companyId,
      action: 'protocol_file_delete',
      tableName: 'protocol_files',
      recordId: fileId,
      oldValues: {
        filename: row.filename,
        r2Key: row.r2_key,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });

  if (keyToDelete) {
    await deleteObjectSafely(store, keyToDelete);
  }

  return { success: true };
}

// ----------------------------------------------------
// DOCX EKSPORT (D-84, D-125)
// ----------------------------------------------------

export async function exportProtocolDocx(
  companyId: string,
  user: UserContext,
  protocolId: string,
  lang: string = 'uz',
): Promise<{ buffer: Buffer; filename: string }> {
  if (lang !== 'uz' && lang !== 'ru' && lang !== 'en') {
    throw new AppError(422, 'INVALID_LANGUAGE', 'Til faqat uz, ru yoki en bo‘lishi mumkin');
  }

  const { protocol, sample } = await getProtocolAndSample(companyId, protocolId);
  assertProtocolViewAccess(user, sample, protocol);

  const detail = await getProtocolById(companyId, user, protocolId);

  const sampleRes = await query<{
    lot_number: string | null;
    serial_number: string | null;
    quantity: string | null;
    manufacturer: string | null;
  }>(
    `SELECT lot_number, serial_number, quantity, manufacturer
     FROM samples
     WHERE id = $1 AND company_id = $2`,
    [sample.id, companyId],
  );

  const sampleExtra = sampleRes.rows[0] ?? {};

  const buffer = await generateProtocolDocx(detail, sampleExtra, lang as ExportLang);
  const filename = `protocol-${protocol.id}.docx`;

  return { buffer, filename };
}

