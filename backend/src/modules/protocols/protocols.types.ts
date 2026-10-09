import type { Role } from '../auth/auth.types.js';

export type ProtocolStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'finalized';
export type ProtocolRole = 'standard' | 'final' | 'in_process';
export type ProtocolSignatureAction = 'submitted' | 'approved' | 'rejected' | 'finalized';

export interface ProtocolRow {
  id: string;
  company_id: string;
  sample_id: string;
  created_by: string;
  status: ProtocolStatus;
  protocol_role: ProtocolRole;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  rejection_reason: string | null;
  submitted_at: Date | null;
  approved_at: Date | null;
  finalized_at: Date | null;
  rejected_at: Date | null;
  passport_file_name: string | null;
  passport_file_path: string | null;
  passport_file_size: number | null;
  passport_file_mime: string | null;
  passport_uploaded_by: string | null;
  passport_uploaded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProtocolFileRow {
  id: string;
  company_id: string;
  protocol_id: string;
  file_id: string;
  uploaded_by: string;
  created_at: Date;
  filename?: string;
  size_bytes?: number | string;
  mime_type?: string;
  r2_key?: string;
  uploaded_by_name?: string | null;
}

export interface ProtocolFileDto {
  id: string;
  protocolId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
  uploadedBy: string;
  uploadedByName: string | null;
  createdAt: string;
}

export interface ProtocolSignatureRow {
  id: string;
  company_id: string;
  protocol_id: string;
  user_id: string;
  role: Role;
  action: ProtocolSignatureAction;
  signature_hash: string;
  ip_address: string | null;
  signed_at: Date;
}

export interface ProtocolSignatureDto {
  id: string;
  userId: string;
  userFullName: string | null;
  role: Role;
  action: ProtocolSignatureAction;
  signatureHash: string;
  ipAddress: string | null;
  signedAt: string;
}

export interface ProtocolDto {
  id: string;
  companyId: string;
  sampleId: string;
  createdBy: string;
  createdByName?: string | null;
  status: ProtocolStatus;
  protocolRole: ProtocolRole;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  passportFileName: string | null;
  passportFilePath: string | null;
  passportFileSize: number | null;
  passportFileMime: string | null;
  passportUploadedBy: string | null;
  passportUploadedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  finalizedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolDetailDto extends ProtocolDto {
  sampleSubstanceName: string;
  sampleType: string;
  sampleStatus: string;
  sampleAssignedTo: string | null;
  signatures: ProtocolSignatureDto[];
  files: ProtocolFileDto[];
}

export interface RejectProtocolInput {
  reason: string;
}

export interface UserContext {
  id: string;
  role: Role;
  companyId: string | null;
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}
