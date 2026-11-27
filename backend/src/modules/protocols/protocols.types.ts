import type { TemperatureSnapshot, TemperatureWarning } from './protocols.temperature.js';
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
  /** D-173: xona (sensor) va harorat snapshot'i */
  sensor_config_id?: string | null;
  nd_id?: string | null;
  n_analyses?: number;
  temperature_snapshot?: TemperatureSnapshot | null;
  temperature_warning?: TemperatureWarning | null;
  /** P18 (D-184): apparat (NULL — noma'lum) va tahlil sanasi */
  equipment_id?: string | null;
  analysis_date?: Date | string | null;
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
  /** P18 (D-185): tur va metadata */
  kind?: ProtocolFileKind;
  substance_name?: string | null;
  series?: string | null;
  analysis_date?: Date | string | null;
  chemist_id?: string | null;
  equipment_id?: string | null;
  equipment_name?: string | null;
}

/** 'extra' — D-49 qo'shimcha fayllari, 'protocol' — asosiy fayl bog'i, 'peak' — HPLC/UV peak fayllari. */
export type ProtocolFileKind = 'protocol' | 'peak' | 'extra';

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
  kind: ProtocolFileKind;
  substanceName: string | null;
  series: string | null;
  analysisDate: string | null;
  chemistId: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
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
  /** D-173: yuborishda olingan xona harorati (jurnal o'zgarsa ham o'zgarmaydi). */
  sensorConfigId: string | null;
  /** D-177: tahlil bog'langan ND va tahlillar soni */
  ndId: string | null;
  nAnalyses: number;
  temperatureSnapshot: TemperatureSnapshot | null;
  temperatureWarning: TemperatureWarning | null;
  /** P18 (D-184): apparat (null — noma'lum) va tahlil sanasi (YYYY-MM-DD) */
  equipmentId: string | null;
  analysisDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolRejectionDto {
  id: string;
  reason: string;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectedAt: string;
}

export interface ProtocolDetailDto extends ProtocolDto {
  sampleSubstanceName: string;
  sampleType: string;
  sampleStatus: string;
  sampleAssignedTo: string | null;
  signatures: ProtocolSignatureDto[];
  files: ProtocolFileDto[];
  /** P18 (D-185): peak fayllari */
  peakFiles: ProtocolFileDto[];
  /** P18 (D-186): barcha rad etish sabablari (eng eskisi birinchi) */
  rejections: ProtocolRejectionDto[];
  equipmentName: string | null;
}

export interface SubmitProtocolInput {
  sensorConfigId?: string | null;
  analysisDate?: string | null;
  /** D-177 */
  ndId?: string | null;
  nAnalyses?: number;
  /** P18 (D-184): apparat; `null` — noma'lum, berilmasa avvalgisi saqlanadi */
  equipmentId?: string | null;
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
