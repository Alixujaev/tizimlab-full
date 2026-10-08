import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignSample,
  createSample,
  fetchSample,
  fetchSamples,
  resumeSample,
  stopSample,
} from '@/api/samples';
import type {
  AssignSampleInput,
  CreateSampleInput,
  ResumeSampleInput,
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
    mutationFn: ({ id, input }: { id: string; input: StopSampleInput }) =>
      stopSample(id, input),
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
