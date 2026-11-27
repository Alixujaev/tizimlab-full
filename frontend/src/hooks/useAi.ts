import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { extractDocument, extractNd, fetchAiStatus, fetchHistory } from '@/api/ai';
import { p17Keys } from '@/hooks/useP17';
import { useAuthStore } from '@/store/authStore';
import type { AiDocumentKind, HistoryEntity } from '@/types';

/** P18 React Query hooklari: AI holati, ekstraksiya (D-179..D-182) va yagona tarix (D-189). */

export const aiKeys = {
  status: ['ai', 'status'] as const,
  history: (entity: HistoryEntity, id: string) => ['history', entity, id] as const,
};

/**
 * AI holati. super_admin'da kompaniya yo'q — so'rov yuborilmaydi. Xato bo'lsa (yoki o'chiq) — `enabled=false`,
 * ya'ni AI tugmalari ko'rinmaydi va formalar avvalgidek ishlaydi.
 */
export function useAiEnabled(): boolean {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: aiKeys.status,
    queryFn: fetchAiStatus,
    enabled: Boolean(user && user.role !== 'super_admin' && user.companyId),
    staleTime: 60_000,
    retry: false,
  });
  return data?.enabled === true;
}

/** Xatoni forma o'zi inline ko'rsatadi (global toast emas). */
export function useExtractDocumentMutation(kind: AiDocumentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => extractDocument(kind, file),
    meta: { silentError: true },
    onSettled: () => void qc.invalidateQueries({ queryKey: aiKeys.status }),
  });
}

export function useExtractNdMutation(ndId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => extractNd(ndId),
    meta: { silentError: true },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: p17Keys.nd });
      void qc.invalidateQueries({ queryKey: aiKeys.status });
      void qc.invalidateQueries({ queryKey: ['history', 'nd', ndId] });
    },
  });
}

export function useHistoryQuery(entity: HistoryEntity, id: string | undefined) {
  return useQuery({
    queryKey: aiKeys.history(entity, id ?? ''),
    queryFn: () => fetchHistory(entity, id!),
    enabled: Boolean(id),
  });
}
