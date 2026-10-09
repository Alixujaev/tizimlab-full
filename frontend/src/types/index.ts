// Ilova bo'ylab umumiy TypeScript tiplari (spec §16). Modul tiplari keyingi fazalarda qo'shiladi.

export const ROLES = [
  'super_admin',
  'kontrolyor',
  'chemist',
  'lab_head',
  'director',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

/** Kompaniyaga bog'langan rollar (super_admin'dan tashqari hammasi, spec §1). */
export const COMPANY_ROLES = [
  'kontrolyor',
  'chemist',
  'lab_head',
  'director',
  'admin',
] as const satisfies readonly Role[];
export type CompanyUserRole = (typeof COMPANY_ROLES)[number];

export interface Company {
  id: string;
  name: string;
  slug: string;
}

/** `GET /auth/me` javobi (parol xeshi/token hech qachon yo'q). */
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** super_admin uchun `null` (spec §2). */
  companyId: string | null;
  company: Company | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

/** D-22: muvaffaqiyatli javob. */
export interface ApiResponse<T> {
  data: T;
}

/** D-22: ro'yxat javobi. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** D-22: xato javobi `{ error: {...} }` ichidagi ob'ekt. */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

// ---------------------------------------------------- Companies
export interface CompanyDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usersCount?: number;
}

export interface CreateCompanyInput {
  name: string;
  slug: string;
  admin: {
    email: string;
    fullName: string;
    password: string;
  };
}

export interface UpdateCompanyInput {
  name?: string;
  slug?: string;
}

export interface CompanyListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

// ---------------------------------------------------- Admin Users & Permissions
export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

export interface UpdateUserInput {
  fullName?: string;
  role?: Role;
  isActive?: boolean;
}

export interface ResetPasswordInput {
  newPassword: string;
}

export interface UserStatsDto {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
}

export interface PermissionsCatalogDto {
  catalog: readonly string[];
  roleDefaults: Record<Role, readonly string[]>;
}

export interface UserPermissionsDto {
  userId: string;
  role: Role;
  rolePermissions: readonly string[];
  individualPermissions: readonly string[];
  effectivePermissions: readonly string[];
}

export interface UserAuditLogDto {
  id: string;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ---------------------------------------------------- Profile
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileInput {
  fullName: string;
}

// ---------------------------------------------------- Substances
export type Pharmacopoeia = 'EP' | 'BP' | 'UzDSt' | 'USP' | 'OTHER';

export interface SubstanceParameterDto {
  id: string;
  substanceId: string;
  parameterName: string;
  unit: string | null;
  specMin: number | null;
  specMax: number | null;
  method: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SubstanceDto {
  id: string;
  nameUz: string;
  nameRu: string | null;
  nameEn: string | null;
  pharmacopoeia: Pharmacopoeia;
  casNumber: string | null;
  description: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  parametersCount?: number;
}

export interface SubstanceDetailDto extends SubstanceDto {
  parameters: SubstanceParameterDto[];
}

export interface SubstanceParameterInput {
  parameterName: string;
  unit?: string | null;
  specMin?: number | null;
  specMax?: number | null;
  method?: string | null;
  sortOrder?: number;
}

export interface CreateSubstanceInput {
  nameUz: string;
  nameRu?: string | null;
  nameEn?: string | null;
  pharmacopoeia: Pharmacopoeia;
  casNumber?: string | null;
  description?: string | null;
  parameters?: SubstanceParameterInput[];
}

export interface UpdateSubstanceInput {
  nameUz?: string;
  nameRu?: string | null;
  nameEn?: string | null;
  pharmacopoeia?: Pharmacopoeia;
  casNumber?: string | null;
  description?: string | null;
  isActive?: boolean;
  parameters?: SubstanceParameterInput[];
}

export interface SubstanceListParams {
  page?: number;
  limit?: number;
  search?: string;
  pharmacopoeia?: Pharmacopoeia;
  isActive?: boolean;
}

// ---------------------------------------------------- Samples
export type SampleType =
  'raw_material' | 'finished_product' | 'reagent' | 'standard_substance' | 'other';

export type SampleStatus =
  'pending_assignment' | 'in_progress' | 'stopped' | 'submitted' | 'approved' | 'rejected';

export type SampleTrackingEventType =
  | 'sample_created'
  | 'assigned'
  | 'reassigned'
  | 'stopped'
  | 'resumed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'passport_uploaded'
  | 'passport_reviewed'
  | 'passport_deleted'
  | 'deleted';

export interface SampleDto {
  id: string;
  companyId: string;
  type: SampleType;
  status: SampleStatus;
  substanceId: string | null;
  substanceName: string;
  serialNumber: string | null;
  lotNumber: string | null;
  quantity: string | null;
  manufacturer: string | null;
  manufacturedAt: string | null;
  analysisStart: string | null;
  analysisEnd: string | null;
  notes: string | null;
  createdBy: string;
  assignedTo: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  stopReason: string | null;
  stoppedAt: string | null;
  deletedAt: string | null;
  passportFileName?: string | null;
  passportStatus?: PassportStatus | null;
  passportFileSize?: number | null;
  passportUploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleTrackingDto {
  id: string;
  sampleId: string;
  eventType: SampleTrackingEventType;
  userId: string | null;
  userFullName?: string | null;
  fromStatus: SampleStatus | null;
  toStatus: SampleStatus | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SampleDetailDto extends SampleDto {
  tracking: SampleTrackingDto[];
}

export interface CreateSampleInput {
  type: SampleType;
  substanceId?: string | null;
  substanceName: string;
  serialNumber?: string | null;
  lotNumber?: string | null;
  quantity?: string | null;
  manufacturer?: string | null;
  manufacturedAt?: string | null;
  analysisStart?: string | null;
  analysisEnd?: string | null;
  notes?: string | null;
}

export interface SampleListParams {
  page?: number;
  limit?: number;
  status?: SampleStatus;
  type?: SampleType;
  substanceId?: string;
  search?: string;
}

export interface AssignSampleInput {
  chemistId: string;
}

export interface StopSampleInput {
  reason: string;
}

export interface ResumeSampleInput {
  reason?: string | null;
}

// ---------------------------------------------------- Passport & Files
export type PassportStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewPassportInput {
  decision: 'approve' | 'reject';
  reason?: string;
}

/** 5 daqiqalik imzolangan URL (D-61). */
export interface DownloadLink {
  url: string;
  expiresIn: number;
}

// ---------------------------------------------------- Registry
export type RegistryDownloadKind = 'passport' | 'protocol' | null;

export interface RegistryItemDto extends SampleDto {
  approvedAt: string;
  downloadKind: RegistryDownloadKind;
}

export interface RegistryDetailDto extends RegistryItemDto {
  tracking: SampleTrackingDto[];
}

export interface RegistryListParams {
  page?: number;
  limit?: number;
  type?: SampleType;
  substanceName?: string;
  serialNumber?: string;
  lotNumber?: string;
  approvedFrom?: string;
  approvedTo?: string;
  unfinalizedOnly?: boolean;
}

// ---------------------------------------------------- Protocols
export type ProtocolStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'finalized';
export type ProtocolRole = 'standard' | 'final' | 'in_process';
export type ProtocolSignatureAction = 'submitted' | 'approved' | 'rejected' | 'finalized';

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
  passportFileName?: string | null;
  passportFilePath?: string | null;
  passportFileSize?: number | null;
  passportFileMime?: string | null;
  passportUploadedBy?: string | null;
  passportUploadedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolFileDto {
  id: string;
  protocolId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
  uploadedBy: string;
  uploadedByName?: string | null;
  createdAt: string;
}

export interface ProtocolDetailDto extends ProtocolDto {
  sampleSubstanceName: string;
  sampleType: string;
  sampleStatus: string;
  sampleAssignedTo: string | null;
  signatures: ProtocolSignatureDto[];
  files?: ProtocolFileDto[];
}

export interface RejectProtocolInput {
  reason: string;
}

// ---------------------------------------------------------------- Notifications (P6, spec §9)

/** Ilova yaratadigan 10 tur; legacy (`general` va h.k.) faqat ko'chirilgan yozuvlarda. */
export type NotificationType =
  | 'sample_assigned'
  | 'sample_approved'
  | 'sample_rejected'
  | 'protocol_submitted'
  | 'protocol_approved'
  | 'protocol_rejected'
  | 'temperature_alert'
  | 'low_stock'
  | 'stability_due_soon'
  | 'stability_overdue';

export interface NotificationDto {
  id: string;
  type: NotificationType | 'sample_created' | 'sample_overdue' | 'general';
  title: string;
  message: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread?: boolean;
}

// ---------------------------------------------------------------- Dashboard (P6, D-33)

interface SamplesSummary {
  samplesByStatus: Record<SampleStatus, number>;
  totalSamples: number;
}

export type DashboardDto =
  | ({ view: 'chemist' } & SamplesSummary)
  | ({ view: 'inspector' } & SamplesSummary)
  | ({ view: 'lab_head'; pendingAssignment: number; awaitingApproval: number } & SamplesSummary)
  | ({
      view: 'director';
      openProtocolsByStatus: Record<Exclude<ProtocolStatus, 'finalized'>, number>;
      openProtocolsTotal: number;
    } & SamplesSummary);
