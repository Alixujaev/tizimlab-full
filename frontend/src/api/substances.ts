import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  CreateSubstanceInput,
  Paginated,
  SubstanceDetailDto,
  SubstanceDto,
  SubstanceListParams,
  UpdateSubstanceInput,
} from '@/types';

export async function fetchSubstances(
  params?: SubstanceListParams,
): Promise<Paginated<SubstanceDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.search) query.search = params.search;
  if (params?.pharmacopoeia) query.pharmacopoeia = params.pharmacopoeia;
  if (params?.isActive !== undefined) query.isActive = String(params.isActive);

  const { data } = await apiClient.get<Paginated<SubstanceDto>>('/substances', { params: query });
  return data;
}

export async function fetchSubstance(id: string): Promise<SubstanceDetailDto> {
  const { data } = await apiClient.get<ApiResponse<SubstanceDetailDto>>(`/substances/${id}`);
  return data.data;
}

export async function createSubstance(
  input: CreateSubstanceInput,
): Promise<SubstanceDetailDto> {
  const { data } = await apiClient.post<ApiResponse<SubstanceDetailDto>>('/substances', input);
  return data.data;
}

export async function updateSubstance(
  id: string,
  input: UpdateSubstanceInput,
): Promise<SubstanceDetailDto> {
  const { data } = await apiClient.put<ApiResponse<SubstanceDetailDto>>(`/substances/${id}`, input);
  return data.data;
}

export async function deleteSubstance(id: string): Promise<void> {
  await apiClient.delete(`/substances/${id}`);
}
