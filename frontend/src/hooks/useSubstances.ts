import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSubstance,
  deleteSubstance,
  fetchSubstance,
  fetchSubstances,
  updateSubstance,
} from '@/api/substances';
import type {
  CreateSubstanceInput,
  SubstanceListParams,
  UpdateSubstanceInput,
} from '@/types';

export const substancesKeys = {
  all: ['substances'] as const,
  lists: () => [...substancesKeys.all, 'list'] as const,
  list: (params?: SubstanceListParams) => [...substancesKeys.lists(), params] as const,
  details: () => [...substancesKeys.all, 'detail'] as const,
  detail: (id: string) => [...substancesKeys.details(), id] as const,
};

export function useSubstancesQuery(params?: SubstanceListParams) {
  return useQuery({
    queryKey: substancesKeys.list(params),
    queryFn: () => fetchSubstances(params),
  });
}

export function useSubstanceQuery(id: string) {
  return useQuery({
    queryKey: substancesKeys.detail(id),
    queryFn: () => fetchSubstance(id),
    enabled: Boolean(id),
  });
}

export function useCreateSubstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubstanceInput) => createSubstance(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: substancesKeys.all });
    },
  });
}

export function useUpdateSubstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSubstanceInput }) =>
      updateSubstance(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: substancesKeys.all });
      void queryClient.invalidateQueries({ queryKey: substancesKeys.detail(variables.id) });
    },
  });
}

export function useDeleteSubstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubstance(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: substancesKeys.all });
      void queryClient.invalidateQueries({ queryKey: substancesKeys.detail(id) });
    },
  });
}
