import { apiClient } from '@/api/client';
import type {
  AiDocumentKind,
  AiExtractionDto,
  AiStatusDto,
  ApiResponse,
  HistoryEntity,
  HistoryItemDto,
  NdExtractionDto,
} from '@/types';

/** P18 (D-179..D-182): AI yordamchi — natija faqat taklif, saqlash odatdagi formada. */

export async function fetchAiStatus(): Promise<AiStatusDto> {
  return (await apiClient.get<ApiResponse<AiStatusDto>>('/ai/status')).data.data;
}

/** Etiketka/CoA rasm yoki PDF dan maydonlar (multipart `file`). */
export async function extractDocument(kind: AiDocumentKind, file: File): Promise<AiExtractionDto> {
  const form = new FormData();
  form.append('file', file);
  return (await apiClient.post<ApiResponse<AiExtractionDto>>(`/ai/extract/${kind}`, form)).data
    .data;
}

/** ND faylidan qoralama talablar (faqat draft ND). */
export async function extractNd(ndId: string): Promise<NdExtractionDto> {
  return (await apiClient.post<ApiResponse<NdExtractionDto>>('/ai/extract/nd', { ndId })).data.data;
}

/** D-189: yagona tarix (sarf, AI o'zgarishlari, rad etishlar, tasdiqlashlar). */
export async function fetchHistory(entity: HistoryEntity, id: string): Promise<HistoryItemDto[]> {
  return (await apiClient.get<ApiResponse<HistoryItemDto[]>>(`/history/${entity}/${id}`)).data.data;
}
