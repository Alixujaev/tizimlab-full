import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteRegistryItem, fetchRegistry, fetchRegistryItem } from '@/api/registry';
import { samplesKeys } from '@/hooks/useSamples';
import type { RegistryListParams } from '@/types';

export const registryKeys = {
  all: ['registry'] as const,
  list: (params?: RegistryListParams) => [...registryKeys.all, 'list', params] as const,
  detail: (id: string) => [...registryKeys.all, 'detail', id] as const,
};

export function useRegistryQuery(params?: RegistryListParams) {
  return useQuery({ queryKey: registryKeys.list(params), queryFn: () => fetchRegistry(params) });
}

export function useRegistryItemQuery(id: string) {
  return useQuery({
    queryKey: registryKeys.detail(id),
    queryFn: () => fetchRegistryItem(id),
    enabled: Boolean(id),
  });
}

export function useDeleteRegistryItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRegistryItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registryKeys.all });
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
    },
  });
}
