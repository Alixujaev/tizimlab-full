import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createReagent,
  createTransaction,
  deleteReagent,
  deleteReagentDocument,
  fetchExpenseCalendar,
  fetchExpenses,
  fetchReagent,
  fetchReagentDocuments,
  fetchReagents,
  fetchTransactions,
  type ListExpensesParams,
  type ListTransactionsParams,
  updateReagent,
  uploadReagentDocument,
} from '@/api/reagents';
import type {
  CreateReagentInput,
  CreateTransactionInput,
  ListReagentsQuery,
  ReagentDocType,
  UpdateReagentInput,
} from '@/types';

export const reagentsKeys = {
  all: ['reagents'] as const,
  lists: () => [...reagentsKeys.all, 'list'] as const,
  list: (params?: ListReagentsQuery) => [...reagentsKeys.lists(), params] as const,
  details: () => [...reagentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...reagentsKeys.details(), id] as const,
  transactions: (id: string, params?: ListTransactionsParams) =>
    [...reagentsKeys.all, 'transactions', id, params] as const,
  documents: (id: string) => [...reagentsKeys.all, 'documents', id] as const,
  expenses: (params?: ListExpensesParams) => ['expenses', params] as const,
  calendar: (from?: string, to?: string) => ['expenses', 'calendar', from, to] as const,
};

export function useReagentsQuery(params?: ListReagentsQuery) {
  return useQuery({
    queryKey: reagentsKeys.list(params),
    queryFn: () => fetchReagents(params),
  });
}

export function useReagentQuery(id: string) {
  return useQuery({
    queryKey: reagentsKeys.detail(id),
    queryFn: () => fetchReagent(id),
    enabled: Boolean(id),
  });
}

export function useCreateReagentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReagentInput) => createReagent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.all });
    },
  });
}

export function useUpdateReagentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReagentInput }) =>
      updateReagent(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.all });
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.detail(variables.id) });
    },
  });
}

export function useDeleteReagentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReagent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.all });
    },
  });
}

export function useTransactionsQuery(reagentId: string, params?: ListTransactionsParams) {
  return useQuery({
    queryKey: reagentsKeys.transactions(reagentId, params),
    queryFn: () => fetchTransactions(reagentId, params),
    enabled: Boolean(reagentId),
  });
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reagentId,
      input,
    }: {
      reagentId: string;
      input: CreateTransactionInput;
    }) => createTransaction(reagentId, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.all });
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.detail(variables.reagentId) });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useReagentDocumentsQuery(reagentId: string) {
  return useQuery({
    queryKey: reagentsKeys.documents(reagentId),
    queryFn: () => fetchReagentDocuments(reagentId),
    enabled: Boolean(reagentId),
  });
}

export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reagentId,
      docType,
      title,
      file,
    }: {
      reagentId: string;
      docType: ReagentDocType;
      title: string;
      file: File;
    }) => uploadReagentDocument(reagentId, docType, title, file),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.documents(variables.reagentId) });
    },
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reagentId, docId }: { reagentId: string; docId: string }) =>
      deleteReagentDocument(reagentId, docId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: reagentsKeys.documents(variables.reagentId) });
    },
  });
}

export function useExpensesQuery(params?: ListExpensesParams) {
  return useQuery({
    queryKey: reagentsKeys.expenses(params),
    queryFn: () => fetchExpenses(params),
  });
}

export function useExpenseCalendarQuery(from?: string, to?: string) {
  return useQuery({
    queryKey: reagentsKeys.calendar(from, to),
    queryFn: () => fetchExpenseCalendar(from, to),
  });
}
