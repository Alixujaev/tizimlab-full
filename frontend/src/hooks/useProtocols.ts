import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveProtocol,
  createInProcessProtocol,
  deleteProtocolExtraFile,
  deleteProtocolFile,
  deleteProtocolPassport,
  deleteProtocolPeakFile,
  fetchProtocol,
  fetchProtocols,
  fetchTemperatureSuggestion,
  fetchProtocolFiles,
  fetchProtocolsBySample,
  finalizeProtocol,
  rejectProtocol,
  submitProtocol,
  uploadProtocolExtraFile,
  uploadProtocolFile,
  uploadProtocolPassport,
  uploadProtocolPeakFile,
} from '@/api/protocols';
import { samplesKeys } from '@/hooks/useSamples';
import type { ProtocolListParams, RejectProtocolInput, SubmitProtocolInput } from '@/types';

export const protocolsKeys = {
  all: ['protocols'] as const,
  bySample: (sampleId: string) => [...protocolsKeys.all, 'sample', sampleId] as const,
  detail: (id: string) => [...protocolsKeys.all, 'detail', id] as const,
  files: (id: string) => [...protocolsKeys.all, 'files', id] as const,
  list: (params?: ProtocolListParams) => [...protocolsKeys.all, 'list', params] as const,
  suggestion: (id: string, sensorConfigId: string, analysisDate: string) =>
    [...protocolsKeys.all, 'temperature-suggestion', id, sensorConfigId, analysisDate] as const,
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
    mutationFn: (v: string | { id: string; input: SubmitProtocolInput }) =>
      typeof v === 'string' ? submitProtocol(v) : submitProtocol(v.id, v.input),
    onSuccess: (_data, v) => {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      const id = typeof v === 'string' ? v : v.id;
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
      void queryClient.invalidateQueries({ queryKey: ['history'] });
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
      void queryClient.invalidateQueries({ queryKey: ['history'] });
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
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
        void queryClient.invalidateQueries({ queryKey: samplesKeys.detail(sampleId) });
      }
      void queryClient.invalidateQueries({ queryKey: ['registry'] });
    },
  });
}

export function useUploadProtocolPassportMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProtocolPassport(id, file),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(variables.id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}

export function useDeleteProtocolPassportMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProtocolPassport(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}

export function useProtocolFilesQuery(protocolId: string | null) {
  return useQuery({
    queryKey: protocolsKeys.files(protocolId ?? ''),
    queryFn: () => fetchProtocolFiles(protocolId!),
    enabled: Boolean(protocolId),
  });
}

export function useUploadProtocolExtraFileMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProtocolExtraFile(id, file),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.files(variables.id) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}

export function useDeleteProtocolExtraFileMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ protocolId, fileId }: { protocolId: string; fileId: string }) =>
      deleteProtocolExtraFile(protocolId, fileId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(variables.protocolId) });
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.files(variables.protocolId) });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}


// ---------------------------------------------------------------- P18
/** D-187: protokollar ro'yxati. */
export function useProtocolsListQuery(params?: ProtocolListParams) {
  return useQuery({ queryKey: protocolsKeys.list(params), queryFn: () => fetchProtocols(params) });
}

/** D-188: harorat taklifi — xona yoki sana o'zgarsa qayta so'raladi. */
export function useTemperatureSuggestionQuery(
  protocolId: string | null | undefined,
  params: { sensorConfigId?: string; analysisDate?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: protocolsKeys.suggestion(
      protocolId ?? '',
      params.sensorConfigId ?? '',
      params.analysisDate ?? '',
    ),
    queryFn: () => fetchTemperatureSuggestion(protocolId!, params),
    enabled: enabled && Boolean(protocolId),
    retry: false,
  });
}

export function useUploadProtocolPeakMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProtocolPeakFile(id, file),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: [...protocolsKeys.all, 'list'] });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}

export function useDeleteProtocolPeakMutation(sampleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ protocolId, fileId }: { protocolId: string; fileId: string }) =>
      deleteProtocolPeakFile(protocolId, fileId),
    onSuccess: (_data, { protocolId }) => {
      void queryClient.invalidateQueries({ queryKey: protocolsKeys.detail(protocolId) });
      void queryClient.invalidateQueries({ queryKey: [...protocolsKeys.all, 'list'] });
      if (sampleId) {
        void queryClient.invalidateQueries({ queryKey: protocolsKeys.bySample(sampleId) });
      }
    },
  });
}
