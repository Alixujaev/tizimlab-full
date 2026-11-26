import { toIsoDay } from '../../utils/dates.js';
export type ReagentTransactionType = 'in' | 'out' | 'adjustment' | 'disposal';
export type ReagentDocType = 'passport' | 'analysis';
export type ReagentApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ReagentRow {
  id: string;
  company_id: string;
  name: string;
  cas_number: string | null;
  unit: string;
  quantity: string | number;
  low_stock_threshold: string | number;
  expires_at: string | Date | null;
  supplier: string | null;
  storage_conditions: string | null;
  is_hazardous: boolean;
  approval_status: ReagentApprovalStatus;
  reagent_item_id: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | Date | null;
  rejection_reason: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ReagentDto {
  id: string;
  companyId: string;
  name: string;
  casNumber: string | null;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  expiresAt: string | null;
  supplier: string | null;
  storageConditions: string | null;
  isHazardous: boolean;
  isLowStock: boolean;
  isExpired: boolean;
  /** D-170: muddati 30 kun ichida tugaydi (hali o'tmagan). */
  isExpiringSoon: boolean;
  /** D-169: tasdiqlanmaguncha sarf (`out`) taqiqlanadi. */
  approvalStatus: ReagentApprovalStatus;
  /** D-174: katalog elementi (bu reaktiv — uning loti) */
  reagentItemId: string;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReagentTransactionRow {
  id: string;
  company_id: string;
  reagent_id: string;
  user_id: string;
  type: ReagentTransactionType;
  quantity: string | number;
  quantity_before: string | number;
  quantity_after: string | number;
  note: string | null;
  protocol_id: string | null;
  analysis_purpose: string | null;
  recorded_date: string | Date;
  created_at: string | Date;
  user_full_name?: string | null;
  reagent_name?: string | null;
  reagent_unit?: string | null;
}

export interface ReagentTransactionDto {
  id: string;
  companyId: string;
  reagentId: string;
  reagentName?: string;
  reagentUnit?: string;
  userId: string;
  userName?: string;
  type: ReagentTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  note: string | null;
  protocolId: string | null;
  analysisPurpose: string | null;
  recordedDate: string;
  createdAt: string;
}

export interface ReagentDocumentRow {
  id: string;
  company_id: string;
  reagent_id: string;
  file_id: string | null;
  doc_type: ReagentDocType;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_mime: string | null;
  uploaded_by: string;
  uploaded_at: string | Date;
  uploaded_by_name?: string | null;
}

export interface ReagentDocumentDto {
  id: string;
  reagentId: string;
  fileId: string | null;
  docType: ReagentDocType;
  fileName: string;
  fileSize: number | null;
  fileMime: string | null;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
}

export const EXPIRING_SOON_DAYS = 30;

function isExpiringSoon(expiresAt: string | Date | null, isExpired: boolean): boolean {
  if (!expiresAt || isExpired) return false;
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + EXPIRING_SOON_DAYS);
  return new Date(expiresAt) <= limit;
}

export function toReagentDto(row: ReagentRow): ReagentDto {
  const qty = Number(row.quantity);
  const threshold = Number(row.low_stock_threshold);
  const isExpired = row.expires_at ? new Date(row.expires_at) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
  const expiresAt = toIsoDay(row.expires_at);
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    casNumber: row.cas_number,
    unit: row.unit,
    quantity: qty,
    lowStockThreshold: threshold,
    expiresAt,
    supplier: row.supplier,
    storageConditions: row.storage_conditions,
    isHazardous: row.is_hazardous,
    isLowStock: qty < threshold,
    isExpired,
    isExpiringSoon: isExpiringSoon(row.expires_at, isExpired),
    approvalStatus: row.approval_status,
    reagentItemId: row.reagent_item_id,
    createdBy: row.created_by ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function toReagentTransactionDto(row: ReagentTransactionRow): ReagentTransactionDto {
  return {
    id: row.id,
    companyId: row.company_id,
    reagentId: row.reagent_id,
    reagentName: row.reagent_name ?? undefined,
    reagentUnit: row.reagent_unit ?? undefined,
    userId: row.user_id,
    userName: row.user_full_name ?? undefined,
    type: row.type,
    quantity: Number(row.quantity),
    quantityBefore: Number(row.quantity_before),
    quantityAfter: Number(row.quantity_after),
    note: row.note,
    protocolId: row.protocol_id,
    analysisPurpose: row.analysis_purpose,
    recordedDate: toIsoDay(row.recorded_date) ?? (toIsoDay(new Date()) as string),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function toReagentDocumentDto(row: ReagentDocumentRow): ReagentDocumentDto {
  return {
    id: row.id,
    reagentId: row.reagent_id,
    fileId: row.file_id,
    docType: row.doc_type,
    fileName: row.file_name,
    fileSize: row.file_size ? Number(row.file_size) : null,
    fileMime: row.file_mime,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name ?? undefined,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
  };
}
