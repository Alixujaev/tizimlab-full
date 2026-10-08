import type { PermissionKey } from '../../config/permissions.js';
import type { Role } from '../auth/auth.types.js';

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

export interface UserStatsDto {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
}

export interface UserPermissionsDto {
  userId: string;
  role: Role;
  rolePermissions: readonly PermissionKey[];
  individualPermissions: readonly PermissionKey[];
  effectivePermissions: readonly PermissionKey[];
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
