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

