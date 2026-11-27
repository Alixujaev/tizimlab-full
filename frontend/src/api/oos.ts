import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  ChatAttachmentDto,
  ChatSendInput,
  ChatSendResult,
  ChatSessionDetailDto,
  ChatSessionDto,
  CreateOosInput,
  OosCaseDetailDto,
  OosCaseDto,
  OosListParams,
  OosNoteDto,
  OosStatusInput,
  Paginated,
  PeakComparisonDto,
  PeakExtractionDto,
  PeakResultDto,
  PeakResultInput,
  PeakResultsDto,
  RagStatusDto,
} from '@/types';

/** P19 API: OOS jurnali, AI kopilot chat, peak natijalari/solishtirish va bilim bazasi (RAG). */

const clean = (params?: object) =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== ''));

// ---------------------------------------------------------------- OOS
export async function fetchOosCases(params?: OosListParams): Promise<Paginated<OosCaseDto>> {
  return (await apiClient.get<Paginated<OosCaseDto>>('/oos', { params: clean(params) })).data;
}
export async function fetchOosCase(id: string): Promise<OosCaseDetailDto> {
  return (await apiClient.get<ApiResponse<OosCaseDetailDto>>(`/oos/${id}`)).data.data;
}
export async function createOosCase(input: CreateOosInput): Promise<OosCaseDto> {
  return (await apiClient.post<ApiResponse<OosCaseDto>>('/oos', input)).data.data;
}
export async function addOosNote(id: string, text: string): Promise<OosNoteDto> {
  return (await apiClient.post<ApiResponse<OosNoteDto>>(`/oos/${id}/notes`, { text })).data.data;
}
export async function changeOosStatus(id: string, input: OosStatusInput): Promise<OosCaseDto> {
  return (await apiClient.post<ApiResponse<OosCaseDto>>(`/oos/${id}/status`, input)).data.data;
}

// ---------------------------------------------------------------- Chat
export async function fetchChatSessions(caseId?: string): Promise<ChatSessionDto[]> {
  return (
    await apiClient.get<ApiResponse<ChatSessionDto[]>>('/oos/chat/sessions', {
      params: clean({ caseId }),
    })
  ).data.data;
}
export async function createChatSession(input: {
  caseId?: string | null;
  title?: string;
}): Promise<ChatSessionDto> {
  return (await apiClient.post<ApiResponse<ChatSessionDto>>('/oos/chat/sessions', input)).data.data;
}
export async function fetchChatSession(id: string): Promise<ChatSessionDetailDto> {
  return (await apiClient.get<ApiResponse<ChatSessionDetailDto>>(`/oos/chat/sessions/${id}`)).data
    .data;
}
export async function uploadChatAttachment(id: string, file: File): Promise<ChatAttachmentDto> {
  const form = new FormData();
  form.append('file', file);
  return (
    await apiClient.post<ApiResponse<ChatAttachmentDto>>(
      `/oos/chat/sessions/${id}/attachments`,
      form,
    )
  ).data.data;
}
export async function sendChatMessage(id: string, input: ChatSendInput): Promise<ChatSendResult> {
  return (
    await apiClient.post<ApiResponse<ChatSendResult>>(`/oos/chat/sessions/${id}/messages`, input)
  ).data.data;
}

// ---------------------------------------------------------------- Peak natijalari
export async function fetchPeakResults(fileId: string): Promise<PeakResultsDto> {
  return (await apiClient.get<ApiResponse<PeakResultsDto>>(`/peaks/files/${fileId}/results`)).data
    .data;
}
export async function addPeakResult(
  fileId: string,
  input: PeakResultInput,
): Promise<PeakResultDto> {
  return (await apiClient.post<ApiResponse<PeakResultDto>>(`/peaks/files/${fileId}/results`, input))
    .data.data;
}
export async function updatePeakResult(id: string, input: PeakResultInput): Promise<PeakResultDto> {
  return (await apiClient.put<ApiResponse<PeakResultDto>>(`/peaks/results/${id}`, input)).data.data;
}
export async function deletePeakResult(id: string): Promise<void> {
  await apiClient.delete(`/peaks/results/${id}`);
}
export async function confirmPeakResults(fileId: string): Promise<{ confirmed: number }> {
  return (
    await apiClient.post<ApiResponse<{ confirmed: number }>>(`/peaks/files/${fileId}/confirm`)
  ).data.data;
}
export async function fetchPeakComparison(fileId: string): Promise<PeakComparisonDto> {
  return (await apiClient.get<ApiResponse<PeakComparisonDto>>(`/peaks/files/${fileId}/comparison`))
    .data.data;
}
export async function extractPeaks(protocolFileId: string): Promise<PeakExtractionDto> {
  return (
    await apiClient.post<ApiResponse<PeakExtractionDto>>('/ai/extract/peaks', { protocolFileId })
  ).data.data;
}

// ---------------------------------------------------------------- Bilim bazasi (RAG)
export async function fetchRagStatus(): Promise<RagStatusDto> {
  return (await apiClient.get<ApiResponse<RagStatusDto>>('/rag/status')).data.data;
}
export async function reindexRag(): Promise<{ queued: number }> {
  return (await apiClient.post<ApiResponse<{ queued: number }>>('/rag/reindex')).data.data;
}
export async function retryRagJob(id: string): Promise<void> {
  await apiClient.post(`/rag/jobs/${id}/retry`);
}
