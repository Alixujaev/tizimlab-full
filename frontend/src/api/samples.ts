import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  AssignSampleInput,
  CreateSampleInput,
  Paginated,
  ResumeSampleInput,
  SampleDetailDto,
  SampleDto,
  SampleListParams,
  StopSampleInput,
} from '@/types';

export async function fetchSamples(
  params?: SampleListParams,
): Promise<Paginated<SampleDto>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.status) query.status = params.status;
  if (params?.type) query.type = params.type;
  if (params?.substanceId) query.substanceId = params.substanceId;
  if (params?.search) query.search = params.search;

  const { data } = await apiClient.get<Paginated<SampleDto>>('/samples', { params: query });
  return data;
}

export async function fetchSample(id: string): Promise<SampleDetailDto> {
  const { data } = await apiClient.get<ApiResponse<SampleDetailDto>>(`/samples/${id}`);
  return data.data;
}

export async function createSample(input: CreateSampleInput): Promise<SampleDto> {
  const { data } = await apiClient.post<ApiResponse<SampleDto>>('/samples', input);
  return data.data;
}

export async function assignSample(
  id: string,
  input: AssignSampleInput,
): Promise<SampleDto> {
  const { data } = await apiClient.post<ApiResponse<SampleDto>>(`/samples/${id}/assign`, input);
  return data.data;
}

export async function stopSample(
  id: string,
  input: StopSampleInput,
): Promise<SampleDto> {
  const { data } = await apiClient.post<ApiResponse<SampleDto>>(`/samples/${id}/stop`, input);
  return data.data;
}

export async function resumeSample(
  id: string,
  input?: ResumeSampleInput,
): Promise<SampleDto> {
  const { data } = await apiClient.post<ApiResponse<SampleDto>>(
    `/samples/${id}/resume`,
    input ?? {},
  );
  return data.data;
}
