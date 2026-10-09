import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignSample,
  createSample,
  deletePassport,
  fetchSample,
  fetchSamples,
  resumeSample,
  reviewPassport,
  stopSample,
  uploadPassport,
} from '@/api/samples';
import type {
  AssignSampleInput,
  CreateSampleInput,
  ResumeSampleInput,
  ReviewPassportInput,
  SampleListParams,
  StopSampleInput,
} from '@/types';

export const samplesKeys = {
  all: ['samples'] as const,
  lists: () => [...samplesKeys.all, 'list'] as const,
  list: (params?: SampleListParams) => [...samplesKeys.lists(), params] as const,
  details: () => [...samplesKeys.all, 'detail'] as const,
  detail: (id: string) => [...samplesKeys.details(), id] as const,
};

export function useSamplesQuery(params?: SampleListParams) {
  return useQuery({
    queryKey: samplesKeys.list(params),
    queryFn: () => fetchSamples(params),
  });
}

export function useSampleQuery(id: string) {
  return useQuery({
    queryKey: samplesKeys.detail(id),
    queryFn: () => fetchSample(id),
    enabled: Boolean(id),
  });
}

export function useCreateSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSampleInput) => createSample(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
    },
  });
}

export function useAssignSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignSampleInput }) =>
      assignSample(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
      void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(variables.id) });
    },
  });
}

export function useStopSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StopSampleInput }) => stopSample(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
      void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(variables.id) });
    },
  });
}

export function useResumeSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: ResumeSampleInput }) =>
      resumeSample(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
      void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(variables.id) });
    },
  });
}

// ---------------------------------------------------- Namuna pasporti

function useInvalidateSample() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
    void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(id) });
    // Pasport orqali tasdiqlash reyestrni ham o'zgartiradi
    void queryClient.invalidateQueries({ queryKey: ['registry'] });
  };
}

/** Xato bo'limning o'zida ko'rsatiladi (`silentError`) — global toast takrorlanmaydi. */
export function useUploadPassportMutation() {
  const invalidate = useInvalidateSample();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadPassport(id, file),
    meta: { silentError: true },
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useReviewPassportMutation() {
  const invalidate = useInvalidateSample();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewPassportInput }) =>
      reviewPassport(id, input),
    meta: { silentError: true },
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useDeletePassportMutation() {
  const invalidate = useInvalidateSample();
  return useMutation({
    mutationFn: (id: string) => deletePassport(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}
