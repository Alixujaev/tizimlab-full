import { useQuery } from '@tanstack/react-query';
import {
  fetchActivityLogById,
  fetchActivityLogs,
  fetchAuditLogById,
  fetchAuditLogs,
} from '@/api/audit';
import type { ListAuditLogsQuery } from '@/types';

export const auditKeys = {
  all: ['audit'] as const,
  logs: (params?: ListAuditLogsQuery) => [...auditKeys.all, 'logs', params] as const,
  log: (id: string) => [...auditKeys.all, 'log', id] as const,
  activityAll: ['activity'] as const,
  activityLogs: (params?: ListAuditLogsQuery) => [...auditKeys.activityAll, 'logs', params] as const,
  activityLog: (id: string) => [...auditKeys.activityAll, 'log', id] as const,
};

export function useAuditLogsQuery(params?: ListAuditLogsQuery, enabled = true) {
  return useQuery({
    queryKey: auditKeys.logs(params),
    queryFn: () => fetchAuditLogs(params),
    enabled,
  });
}

export function useAuditLogQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: auditKeys.log(id),
    queryFn: () => fetchAuditLogById(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useActivityLogsQuery(params?: ListAuditLogsQuery, enabled = true) {
  return useQuery({
    queryKey: auditKeys.activityLogs(params),
    queryFn: () => fetchActivityLogs(params),
    enabled,
  });
}

export function useActivityLogQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: auditKeys.activityLog(id),
    queryFn: () => fetchActivityLogById(id),
    enabled: Boolean(id) && enabled,
  });
}
