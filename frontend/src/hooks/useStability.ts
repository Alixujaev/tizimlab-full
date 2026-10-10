import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeStabilityCheckpoint,
  createStabilityCheckpoint,
  createStabilityStudy,
  deleteStabilityCheckpoint,
  fetchStabilityStudies,
  fetchStabilityStudy,
  fetchStabilityStudyBySample,
  recordStabilityResults,
  updateStabilityCheckpoint,
} from '@/api/stability';
import type {
  CreateStabilityCheckpointInput,
  CreateStabilityStudyInput,
  ListStabilityStudiesQuery,
  RecordStabilityResultsInput,
  UpdateStabilityCheckpointInput,
} from '@/types';

export const stabilityKeys = {
  all: ['stability'] as const,
  studies: (params?: ListStabilityStudiesQuery) => [...stabilityKeys.all, 'studies', params] as const,
  study: (id: string) => [...stabilityKeys.all, 'study', id] as const,
  sampleStudy: (sampleId: string) => [...stabilityKeys.all, 'sample', sampleId] as const,
};

export function useStabilityStudiesQuery(params?: ListStabilityStudiesQuery, enabled = true) {
  return useQuery({
    queryKey: stabilityKeys.studies(params),
    queryFn: () => fetchStabilityStudies(params),
    enabled,
  });
}

export function useStabilityStudyQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: stabilityKeys.study(id),
    queryFn: () => fetchStabilityStudy(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useStabilityStudyBySampleQuery(sampleId: string, enabled = true) {
  return useQuery({
    queryKey: stabilityKeys.sampleStudy(sampleId),
    queryFn: () => fetchStabilityStudyBySample(sampleId),
    enabled: Boolean(sampleId) && enabled,
  });
}

export function useCreateStudyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStabilityStudyInput) => createStabilityStudy(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.all });
    },
  });
}

export function useCreateCheckpointMutation(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStabilityCheckpointInput) => createStabilityCheckpoint(studyId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.study(studyId) });
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.studies() });
    },
  });
}

export function useUpdateCheckpointMutation(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStabilityCheckpointInput }) =>
      updateStabilityCheckpoint(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.study(studyId) });
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.studies() });
    },
  });
}

export function useDeleteCheckpointMutation(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkpointId: string) => deleteStabilityCheckpoint(checkpointId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.study(studyId) });
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.studies() });
    },
  });
}

export function useRecordResultsMutation(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      checkpointId,
      input,
    }: {
      checkpointId: string;
      input: RecordStabilityResultsInput;
    }) => recordStabilityResults(checkpointId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.study(studyId) });
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.studies() });
    },
  });
}

export function useCompleteCheckpointMutation(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ checkpointId, notes }: { checkpointId: string; notes?: string | null }) =>
      completeStabilityCheckpoint(checkpointId, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.study(studyId) });
      void queryClient.invalidateQueries({ queryKey: stabilityKeys.studies() });
    },
  });
}
