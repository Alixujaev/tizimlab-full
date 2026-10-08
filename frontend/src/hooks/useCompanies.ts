import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateCompany,
  createCompany,
  deactivateCompany,
  fetchCompanies,
  fetchCompany,
  updateCompany,
} from '@/api/companies';
import type { CompanyListParams, CreateCompanyInput, UpdateCompanyInput } from '@/types';

export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (params?: CompanyListParams) => [...companiesKeys.lists(), params] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
};

export function useCompaniesQuery(params?: CompanyListParams) {
  return useQuery({
    queryKey: companiesKeys.list(params),
    queryFn: () => fetchCompanies(params),
  });
}

export function useCompanyQuery(id: string) {
  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => fetchCompany(id),
    enabled: Boolean(id),
  });
}

export function useCreateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) => createCompany(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useUpdateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCompanyInput }) =>
      updateCompany(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      void queryClient.invalidateQueries({ queryKey: companiesKeys.detail(variables.id) });
    },
  });
}

export function useActivateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateCompany(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      void queryClient.invalidateQueries({ queryKey: companiesKeys.detail(id) });
    },
  });
}

export function useDeactivateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateCompany(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      void queryClient.invalidateQueries({ queryKey: companiesKeys.detail(id) });
    },
  });
}
