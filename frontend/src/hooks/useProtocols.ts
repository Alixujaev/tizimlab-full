import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveProtocol,
  createInProcessProtocol,
  deleteProtocolFile,
  fetchProtocol,
  fetchProtocolsBySample,
  finalizeProtocol,
  rejectProtocol,
  submitProtocol,
  uploadProtocolFile,
} from '@/api/protocols';
import { samplesKeys } from '@/hooks/useSamples';
import type { RejectProtocolInput } from '@/types';

export const protocolsKeys = {
  all: ['protocols'] as const,
  bySample: (sampleId: string) => [...protocolsKeys.all, 'sample', sampleId] as const,
  detail: (id: string) => [...protocolsKeys.all, 'detail', id] as const,
};

export function useProtocolsBySampleQuery(sampleId: string) {
  return useQuery({
    queryKey: protocolsKeys.bySample(sampleId),
    queryFn: () => fetchProtocolsBySample(sampleId),
    enabled: Boolean(sampleId),
  });
}

export function useProtocolQuery(id: string | null) {
  return useQuery({
    queryKey: protocolsKeys.detail(id ?? ''),
    queryFn: () => fetchProtocol(id!),
    enabled: Boolean(id),
  });
}

export function useCreateInProcessProtocolMutation(sampleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createInProcessProtocol(sampleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(sampleId) });
    },
  });
}

export function useUploadProtocolFileMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProtocolFile(id, file),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(variables.id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}

export function useDeleteProtocolFileMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProtocolFile(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}

export function useSubmitProtocolMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => submitProtocol(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
        void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(sampleId) });
      }
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
    },
  });
}

export function useApproveProtocolMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveProtocol(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
        void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(sampleId) });
      }
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['registry'] });
    },
  });
}

export function useRejectProtocolMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RejectProtocolInput }) =>
      rejectProtocol(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(variables.id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
        void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(sampleId) });
      }
      void queryClient.invalidateQueries({ queryKey: samplesKeys.all });
    },
  });
}

export function useFinalizeProtocolMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => finalizeProtocol(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
        void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(sampleId) });
      }
      void queryClient.invalidateQueries({ queryKey: ['registry'] });
    },
  });
}
