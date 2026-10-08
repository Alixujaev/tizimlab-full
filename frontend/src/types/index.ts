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
