import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  DownloadLink,
  ProtocolDetailDto,
  ProtocolDto,
  RejectProtocolInput,
} from '@/types';

export async function fetchProtocolsBySample(sampleId: string): Promise<ProtocolDto[]> {
  const { data } = await apiClient.get<ApiResponse<ProtocolDto[]>>(`/protocols/sample/${sampleId}`);
  return data.data;
}

export async function fetchProtocol(id: string): Promise<ProtocolDetailDto> {
  const { data } = await apiClient.get<ApiResponse<ProtocolDetailDto>>(`/protocols/${id}`);
  return data.data;
}

export async function createInProcessProtocol(sampleId: string): Promise<ProtocolDto> {
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(
    `/protocols/sample/${sampleId}/in-process`,
  );
  return data.data;
}

export async function uploadProtocolFile(id: string, file: File): Promise<ProtocolDto> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(`/protocols/${id}/file`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function deleteProtocolFile(id: string): Promise<ProtocolDto> {
  const { data } = await apiClient.delete<ApiResponse<ProtocolDto>>(`/protocols/${id}/file`);
  return data.data;
}

export async function getProtocolFileDownload(id: string): Promise<DownloadLink> {
  const { data } = await apiClient.get<ApiResponse<DownloadLink>>(`/protocols/${id}/file`);
  return data.data;
}

export async function submitProtocol(id: string): Promise<ProtocolDto> {
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(`/protocols/${id}/submit`);
  return data.data;
}

export async function approveProtocol(id: string): Promise<ProtocolDto> {
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(`/protocols/${id}/approve`);
  return data.data;
}

export async function rejectProtocol(id: string, input: RejectProtocolInput): Promise<ProtocolDto> {
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(`/protocols/${id}/reject`, input);
  return data.data;
}

export async function finalizeProtocol(id: string): Promise<ProtocolDto> {
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(`/protocols/${id}/finalize`);
  return data.data;
}
