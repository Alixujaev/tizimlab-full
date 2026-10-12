import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  AuditLogDto,
  ListAuditLogsQuery,
  Paginated,
} from '@/types';

export async function fetchAuditLogs(
  params?: ListAuditLogsQuery,
): Promise<Paginated<AuditLogDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.userId) query.userId = params.userId;
  if (params?.companyId) query.companyId = params.companyId;
  if (params?.action) query.action = params.action;
  if (params?.tableName) query.tableName = params.tableName;
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.search) query.search = params.search;

  const { data } = await apiClient.get<Paginated<AuditLogDto>>('/audit', { params: query });
  return data;
}

export async function fetchAuditLogById(
  id: string,
): Promise<AuditLogDto> {
  const { data } = await apiClient.get<ApiResponse<AuditLogDto>>(`/audit/${id}`);
  return data.data;
}

export async function fetchActivityLogs(
  params?: ListAuditLogsQuery,
): Promise<Paginated<AuditLogDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.userId) query.userId = params.userId;
  if (params?.action) query.action = params.action;
  if (params?.tableName) query.tableName = params.tableName;
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.search) query.search = params.search;

  const { data } = await apiClient.get<Paginated<AuditLogDto>>('/activity', { params: query });
  return data;
}

export async function fetchActivityLogById(
  id: string,
): Promise<AuditLogDto> {
  const { data } = await apiClient.get<ApiResponse<AuditLogDto>>(`/activity/${id}`);
  return data.data;
}
