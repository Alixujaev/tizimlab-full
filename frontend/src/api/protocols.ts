import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  DownloadLink,
  ProtocolDetailDto,
  ProtocolDto,
  ProtocolFileDto,
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

export async function uploadProtocolPassport(id: string, file: File): Promise<ProtocolDto> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ApiResponse<ProtocolDto>>(`/protocols/${id}/passport`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function deleteProtocolPassport(id: string): Promise<ProtocolDto> {
  const { data } = await apiClient.delete<ApiResponse<ProtocolDto>>(`/protocols/${id}/passport`);
  return data.data;
}

export async function getProtocolPassportDownload(id: string): Promise<DownloadLink> {
  const { data } = await apiClient.get<ApiResponse<DownloadLink>>(`/protocols/${id}/passport`);
  return data.data;
}

export async function uploadProtocolExtraFile(id: string, file: File): Promise<ProtocolFileDto> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ApiResponse<ProtocolFileDto>>(`/protocols/${id}/files`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function fetchProtocolFiles(id: string): Promise<ProtocolFileDto[]> {
  const { data } = await apiClient.get<ApiResponse<ProtocolFileDto[]>>(`/protocols/${id}/files`);
  return data.data;
}

export async function getProtocolExtraFileDownload(protocolId: string, fileId: string): Promise<DownloadLink> {
  const { data } = await apiClient.get<ApiResponse<DownloadLink>>(`/protocols/${protocolId}/files/${fileId}`);
  return data.data;
}

export async function deleteProtocolExtraFile(protocolId: string, fileId: string): Promise<{ success: true }> {
  const { data } = await apiClient.delete<ApiResponse<{ success: true }>>(`/protocols/${protocolId}/files/${fileId}`);
  return data.data;
}

export async function exportProtocolDocx(id: string, lang: 'uz' | 'ru' | 'en' = 'uz'): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/protocols/${id}/export?lang=${lang}`, {
    responseType: 'blob',
  });
  return response.data;
}

