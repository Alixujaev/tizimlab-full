import { apiClient } from '@/api/client';
import type {
  CreateStabilityCheckpointInput,
  CreateStabilityStudyInput,
  ListStabilityStudiesQuery,
  RecordStabilityResultsInput,
  StabilityCheckpointDto,
  StabilityStudyDetailDto,
  StabilityStudyDto,
  UpdateStabilityCheckpointInput,
} from '@/types';

export async function fetchStabilityStudies(
  params?: ListStabilityStudiesQuery,
): Promise<{ items: StabilityStudyDto[]; meta: { page: number; limit: number; total: number } }> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.status) query.status = params.status;
  if (params?.sampleId) query.sampleId = params.sampleId;
  if (params?.search) query.search = params.search;

  const { data } = await apiClient.get('/stability', { params: query });
  return data;
}

export async function fetchStabilityStudy(id: string): Promise<StabilityStudyDetailDto> {
  const { data } = await apiClient.get<StabilityStudyDetailDto>(`/stability/${id}`);
  return data;
}

export async function fetchStabilityStudyBySample(
  sampleId: string,
): Promise<StabilityStudyDetailDto | null> {
  try {
    const { data } = await apiClient.get<StabilityStudyDetailDto>(`/stability/sample/${sampleId}`);
    return data;
  } catch {
    return null;
  }
}

export async function createStabilityStudy(
  input: CreateStabilityStudyInput,
): Promise<StabilityStudyDetailDto> {
  const { data } = await apiClient.post<StabilityStudyDetailDto>('/stability', input);
  return data;
}

export async function createStabilityCheckpoint(
  studyId: string,
  input: CreateStabilityCheckpointInput,
): Promise<StabilityCheckpointDto> {
  const { data } = await apiClient.post<StabilityCheckpointDto>(
    `/stability/${studyId}/checkpoints`,
    input,
  );
  return data;
}

export async function updateStabilityCheckpoint(
  checkpointId: string,
  input: UpdateStabilityCheckpointInput,
): Promise<StabilityCheckpointDto> {
  const { data } = await apiClient.put<StabilityCheckpointDto>(
    `/stability/checkpoints/${checkpointId}`,
    input,
  );
  return data;
}

export async function deleteStabilityCheckpoint(checkpointId: string): Promise<void> {
  await apiClient.delete(`/stability/checkpoints/${checkpointId}`);
}

export async function recordStabilityResults(
  checkpointId: string,
  input: RecordStabilityResultsInput,
): Promise<StabilityCheckpointDto> {
  const { data } = await apiClient.post<StabilityCheckpointDto>(
    `/stability/checkpoints/${checkpointId}/results`,
    input,
  );
  return data;
}

export async function completeStabilityCheckpoint(
  checkpointId: string,
  notes?: string | null,
): Promise<StabilityCheckpointDto> {
  const { data } = await apiClient.post<StabilityCheckpointDto>(
    `/stability/checkpoints/${checkpointId}/complete`,
    { notes },
  );
  return data;
}
