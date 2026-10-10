import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  CreateReagentInput,
  CreateTransactionInput,
  ExpenseCalendarDayDto,
  ListReagentsQuery,
  Paginated,
  ReagentDocType,
  ReagentDocumentDto,
  ReagentDto,
  ReagentExpenseItemDto,
  ReagentTransactionDto,
  UpdateReagentInput,
} from '@/types';

export interface ListExpensesParams {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
  reagentId?: string;
}

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  type?: string;
}

export async function fetchReagents(
  params?: ListReagentsQuery,
): Promise<Paginated<ReagentDto>> {
  const query: Record<string, string | number | boolean> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.search) query.search = params.search;
  if (params?.isLowStock !== undefined) query.isLowStock = params.isLowStock;
  if (params?.isExpired !== undefined) query.isExpired = params.isExpired;
  if (params?.isHazardous !== undefined) query.isHazardous = params.isHazardous;

  const { data } = await apiClient.get<Paginated<ReagentDto>>('/reagents', { params: query });
  return data;
}

export async function fetchReagent(id: string): Promise<ReagentDto> {
  const { data } = await apiClient.get<ApiResponse<ReagentDto>>(`/reagents/${id}`);
  return data.data;
}

export async function createReagent(input: CreateReagentInput): Promise<ReagentDto> {
  const { data } = await apiClient.post<ApiResponse<ReagentDto>>('/reagents', input);
  return data.data;
}

export async function updateReagent(
  id: string,
  input: UpdateReagentInput,
): Promise<ReagentDto> {
  const { data } = await apiClient.put<ApiResponse<ReagentDto>>(`/reagents/${id}`, input);
  return data.data;
}

export async function deleteReagent(id: string): Promise<void> {
  await apiClient.delete(`/reagents/${id}`);
}

export async function createTransaction(
  reagentId: string,
  input: CreateTransactionInput,
): Promise<ReagentTransactionDto> {
  const { data } = await apiClient.post<ApiResponse<ReagentTransactionDto>>(
    `/reagents/${reagentId}/transactions`,
    input,
  );
  return data.data;
}

export async function fetchTransactions(
  reagentId: string,
  params?: ListTransactionsParams,
): Promise<Paginated<ReagentTransactionDto>> {
  const { data } = await apiClient.get<Paginated<ReagentTransactionDto>>(
    `/reagents/${reagentId}/transactions`,
    { params },
  );
  return data;
}

export async function uploadReagentDocument(
  reagentId: string,
  docType: ReagentDocType,
  title: string,
  file: File,
): Promise<ReagentDocumentDto> {
  const formData = new FormData();
  formData.append('docType', docType);
  formData.append('title', title);
  formData.append('file', file);

  const { data } = await apiClient.post<ApiResponse<ReagentDocumentDto>>(
    `/reagents/${reagentId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function fetchReagentDocuments(
  reagentId: string,
): Promise<ReagentDocumentDto[]> {
  const { data } = await apiClient.get<ApiResponse<ReagentDocumentDto[]>>(
    `/reagents/${reagentId}/documents`,
  );
  return data.data;
}

export async function getReagentDocumentDownloadUrl(
  reagentId: string,
  docId: string,
): Promise<{ url: string; filename: string }> {
  const { data } = await apiClient.get<ApiResponse<{ url: string; filename: string }>>(
    `/reagents/${reagentId}/documents/${docId}/download`,
  );
  return data.data;
}

export async function deleteReagentDocument(
  reagentId: string,
  docId: string,
): Promise<void> {
  await apiClient.delete(`/reagents/${reagentId}/documents/${docId}`);
}

export async function fetchExpenses(
  params?: ListExpensesParams,
): Promise<Paginated<ReagentExpenseItemDto>> {
  const { data } = await apiClient.get<Paginated<ReagentExpenseItemDto>>('/expenses', {
    params,
  });
  return data;
}

export async function fetchExpenseCalendar(
  from?: string,
  to?: string,
): Promise<ExpenseCalendarDayDto[]> {
  const { data } = await apiClient.get<ApiResponse<ExpenseCalendarDayDto[]>>(
    '/reagents/expenses/calendar',
    { params: { from, to } },
  );
  return data.data;
}
