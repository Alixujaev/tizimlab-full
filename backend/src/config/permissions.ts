import type { Role } from '../modules/auth/auth.types.js';

/** `resource:action` (masalan `samples:create`). */
export type PermissionKey = `${string}:${string}`;
export type RolePermissionCatalog = Partial<Record<Role, readonly PermissionKey[]>>;

/**
 * Rol asosidagi ruxsatlar katalogi. D-10: katalog P2b da tuziladi va foydalanuvchiga tasdiqlatiladi —
 * hozircha bo'sh (`requirePermission` faqat individual grant'lar bilan ishlaydi).
 */
export const ROLE_PERMISSIONS: RolePermissionCatalog = {};
