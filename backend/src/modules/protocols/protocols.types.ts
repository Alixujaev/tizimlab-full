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
  created_at: Date;
  updated_at: Date;
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
