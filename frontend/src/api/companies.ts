import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  CompanyDto,
  CompanyListParams,
  CreateCompanyInput,
  Paginated,
  UpdateCompanyInput,
} from '@/types';

export async function fetchCompanies(params?: CompanyListParams): Promise<Paginated<CompanyDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.search) query.search = params.search;
  if (params?.isActive !== undefined) query.isActive = String(params.isActive);

  const { data } = await apiClient.get<Paginated<CompanyDto>>('/companies', { params: query });
  return data;
}

export async function fetchCompany(id: string): Promise<CompanyDto> {
  const { data } = await apiClient.get<ApiResponse<CompanyDto>>(`/companies/${id}`);
  return data.data;
}

export async function createCompany(
  input: CreateCompanyInput,
): Promise<{ company: CompanyDto; adminUserId: string }> {
  const { data } = await apiClient.post<
    ApiResponse<{ company: CompanyDto; adminUserId: string }>
  >('/companies', input);
  return data.data;
}

export async function updateCompany(id: string, input: UpdateCompanyInput): Promise<CompanyDto> {
  const { data } = await apiClient.patch<ApiResponse<CompanyDto>>(`/companies/${id}`, input);
  return data.data;
}

export async function activateCompany(id: string): Promise<CompanyDto> {
  const { data } = await apiClient.post<ApiResponse<CompanyDto>>(`/companies/${id}/activate`);
  return data.data;
}

export async function deactivateCompany(id: string): Promise<CompanyDto> {
  const { data } = await apiClient.post<ApiResponse<CompanyDto>>(`/companies/${id}/deactivate`);
  return data.data;
}
