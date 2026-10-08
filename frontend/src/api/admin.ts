import { apiClient } from '@/api/client';
import type {
  AdminUserDto,
  ApiResponse,
  CreateUserInput,
  Paginated,
  PermissionsCatalogDto,
  ResetPasswordInput,
  UpdateUserInput,
  UserAuditLogDto,
  UserListParams,
  UserPermissionsDto,
  UserStatsDto,
} from '@/types';

export async function fetchUsers(params?: UserListParams): Promise<Paginated<AdminUserDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.search) query.search = params.search;
  if (params?.role) query.role = params.role;
  if (params?.isActive !== undefined) query.isActive = String(params.isActive);

  const { data } = await apiClient.get<Paginated<AdminUserDto>>('/admin/users', { params: query });
  return data;
}

export async function fetchUserStats(): Promise<UserStatsDto> {
  const { data } = await apiClient.get<ApiResponse<UserStatsDto>>('/admin/users/stats');
  return data.data;
}

export async function fetchUser(id: string): Promise<AdminUserDto> {
  const { data } = await apiClient.get<ApiResponse<AdminUserDto>>(`/admin/users/${id}`);
  return data.data;
}

export async function createUser(input: CreateUserInput): Promise<AdminUserDto> {
  const { data } = await apiClient.post<ApiResponse<AdminUserDto>>('/admin/users', input);
  return data.data;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AdminUserDto> {
  const { data } = await apiClient.patch<ApiResponse<AdminUserDto>>(`/admin/users/${id}`, input);
  return data.data;
}

export async function resetPassword(
  id: string,
  input: ResetPasswordInput,
): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean }>>(
    `/admin/users/${id}/reset-password`,
    input,
  );
  return data.data;
}

export async function fetchPermissionsCatalog(): Promise<PermissionsCatalogDto> {
  const { data } = await apiClient.get<ApiResponse<PermissionsCatalogDto>>(
    '/admin/permissions/catalog',
  );
  return data.data;
}

export async function fetchUserPermissions(id: string): Promise<UserPermissionsDto> {
  const { data } = await apiClient.get<ApiResponse<UserPermissionsDto>>(
    `/admin/users/${id}/permissions`,
  );
  return data.data;
}

export async function setUserPermissions(
  id: string,
  permissions: string[],
): Promise<UserPermissionsDto> {
  const { data } = await apiClient.put<ApiResponse<UserPermissionsDto>>(
    `/admin/users/${id}/permissions`,
    { permissions },
  );
  return data.data;
}

export async function fetchUserLogs(
  id: string,
  params?: { page?: number; limit?: number },
): Promise<Paginated<UserAuditLogDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;

  const { data } = await apiClient.get<Paginated<UserAuditLogDto>>(`/admin/users/${id}/logs`, {
    params: query,
  });
  return data;
}
