import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUser,
  fetchPermissionsCatalog,
  fetchUser,
  fetchUserLogs,
  fetchUserPermissions,
  fetchUserStats,
  fetchUsers,
  resetPassword,
  setUserPermissions,
  updateUser,
} from '@/api/admin';
import type {
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
  UserListParams,
} from '@/types';

export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (params?: UserListParams) => [...adminKeys.users(), 'list', params] as const,
  userDetail: (id: string) => [...adminKeys.users(), 'detail', id] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  catalog: () => [...adminKeys.all, 'catalog'] as const,
  permissions: (id: string) => [...adminKeys.all, 'permissions', id] as const,
  logs: (id: string, params?: { page?: number; limit?: number }) =>
    [...adminKeys.all, 'logs', id, params] as const,
};

export function useUsersQuery(params?: UserListParams) {
  return useQuery({
    queryKey: adminKeys.userList(params),
    queryFn: () => fetchUsers(params),
  });
}

export function useUserStatsQuery() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => fetchUserStats(),
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: adminKeys.userDetail(id),
    queryFn: () => fetchUser(id),
    enabled: Boolean(id),
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(variables.id) });
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResetPasswordInput }) =>
      resetPassword(id, input),
  });
}

export function usePermissionsCatalogQuery() {
  return useQuery({
    queryKey: adminKeys.catalog(),
    queryFn: () => fetchPermissionsCatalog(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserPermissionsQuery(id: string) {
  return useQuery({
    queryKey: adminKeys.permissions(id),
    queryFn: () => fetchUserPermissions(id),
    enabled: Boolean(id),
  });
}

export function useSetUserPermissionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      setUserPermissions(id, permissions),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.permissions(variables.id) });
    },
  });
}

export function useUserLogsQuery(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: adminKeys.logs(id, params),
    queryFn: () => fetchUserLogs(id, params),
    enabled: Boolean(id),
  });
}
