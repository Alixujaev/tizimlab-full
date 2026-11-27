import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addOosNote,
  addPeakResult,
  changeOosStatus,
  confirmPeakResults,
  createChatSession,
  createOosCase,
  deletePeakResult,
  extractPeaks,
  fetchChatSession,
  fetchChatSessions,
  fetchOosCase,
  fetchOosCases,
  fetchPeakComparison,
  fetchPeakResults,
  fetchRagStatus,
  reindexRag,
  retryRagJob,
  sendChatMessage,
  updatePeakResult,
  uploadChatAttachment,
} from '@/api/oos';
import { aiKeys } from '@/hooks/useAi';
import type {
  ChatSendInput,
  CreateOosInput,
  OosListParams,
  OosStatusInput,
  PeakResultInput,
} from '@/types';

/** P19 React Query hooklari: OOS jurnali, AI kopilot chat, peak natijalari va bilim bazasi. */

export const oosKeys = {
  all: ['oos'] as const,
  list: (params?: OosListParams) => ['oos', 'list', params] as const,
  detail: (id: string) => ['oos', 'detail', id] as const,
  sessions: (caseId?: string) => ['oos', 'sessions', caseId ?? 'all'] as const,
  session: (id: string) => ['oos', 'session', id] as const,
  peakResults: (fileId: string) => ['peaks', 'results', fileId] as const,
  peakComparison: (fileId: string) => ['peaks', 'comparison', fileId] as const,
  rag: ['rag', 'status'] as const,
};

// ---------------------------------------------------------------- OOS
export function useOosListQuery(params: OosListParams) {
  return useQuery({
    queryKey: oosKeys.list(params),
    queryFn: () => fetchOosCases(params),
    placeholderData: keepPreviousData,
  });
}

export function useOosCaseQuery(id: string | undefined) {
  return useQuery({
    queryKey: oosKeys.detail(id ?? ''),
    queryFn: () => fetchOosCase(id!),
    enabled: Boolean(id),
  });
}

export function useCreateOosMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOosInput) => createOosCase(input),
    meta: { silentError: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.all }),
  });
}

export function useAddOosNoteMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addOosNote(id, text),
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.detail(id) }),
  });
}

export function useOosStatusMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OosStatusInput) => changeOosStatus(id, input),
    meta: { silentError: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.all }),
  });
}

// ---------------------------------------------------------------- Chat
export function useChatSessionsQuery(caseId?: string) {
  return useQuery({
    queryKey: oosKeys.sessions(caseId),
    queryFn: () => fetchChatSessions(caseId),
  });
}

export function useChatSessionQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: oosKeys.session(id ?? ''),
    queryFn: () => fetchChatSession(id!),
    enabled: Boolean(id),
  });
}

export function useCreateChatSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createChatSession,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['oos', 'sessions'] }),
  });
}

/** Xato (413/415/422) chat ichida inline ko'rsatiladi. */
export function useUploadChatAttachmentMutation(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadChatAttachment(sessionId, file),
    meta: { silentError: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.session(sessionId) }),
  });
}

/** AI xatolari (503/403/429) chat ichida inline; savol matni saqlanib qoladi. */
export function useSendChatMessageMutation(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChatSendInput) => sendChatMessage(sessionId, input),
    meta: { silentError: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.session(sessionId) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: aiKeys.status }),
  });
}

// ---------------------------------------------------------------- Peak natijalari
export function usePeakResultsQuery(fileId: string | null) {
  return useQuery({
    queryKey: oosKeys.peakResults(fileId ?? ''),
    queryFn: () => fetchPeakResults(fileId!),
    enabled: Boolean(fileId),
  });
}

export function usePeakComparisonQuery(fileId: string | null, enabled = true) {
  return useQuery({
    queryKey: oosKeys.peakComparison(fileId ?? ''),
    queryFn: () => fetchPeakComparison(fileId!),
    enabled: Boolean(fileId) && enabled,
  });
}

function useInvalidatePeaks(fileId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: oosKeys.peakResults(fileId) });
    void qc.invalidateQueries({ queryKey: oosKeys.peakComparison(fileId) });
  };
}

export function useSavePeakResultMutation(fileId: string) {
  const invalidate = useInvalidatePeaks(fileId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PeakResultInput }) =>
      id ? updatePeakResult(id, input) : addPeakResult(fileId, input),
    meta: { silentError: true },
    onSuccess: invalidate,
  });
}

export function useDeletePeakResultMutation(fileId: string) {
  const invalidate = useInvalidatePeaks(fileId);
  return useMutation({ mutationFn: deletePeakResult, onSuccess: invalidate });
}

export function useConfirmPeakResultsMutation(fileId: string) {
  const invalidate = useInvalidatePeaks(fileId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => confirmPeakResults(fileId),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: oosKeys.all });
    },
  });
}

export function useExtractPeaksMutation(fileId: string) {
  const invalidate = useInvalidatePeaks(fileId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => extractPeaks(fileId),
    meta: { silentError: true },
    onSuccess: invalidate,
    onSettled: () => void qc.invalidateQueries({ queryKey: aiKeys.status }),
  });
}

// ---------------------------------------------------------------- Bilim bazasi
export function useRagStatusQuery() {
  return useQuery({ queryKey: oosKeys.rag, queryFn: fetchRagStatus });
}

export function useReindexRagMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reindexRag,
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.rag }),
  });
}

export function useRetryRagJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryRagJob,
    onSuccess: () => void qc.invalidateQueries({ queryKey: oosKeys.rag }),
  });
}
