import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addNdRequirement,
  changeNdStatus,
  confirmConsumption,
  correctConsumption,
  createEquipment,
  createNd,
  deleteEquipment,
  deleteNd,
  deleteNdRequirement,
  fetchEquipment,
  fetchEquipmentCategories,
  fetchEquipmentItem,
  fetchFeasibility,
  fetchNd,
  fetchNdList,
  fetchProtocolConsumptions,
  fetchReagentItems,
  updateEquipment,
  updateNd,
  updateNdRequirement,
  uploadNdFile,
} from '@/api/p17';
import type {
  EquipmentInput,
  EquipmentListParams,
  NdInput,
  NdListParams,
  NdRequirementInput,
} from '@/types/p17';

/** P17 React Query hooklari (D-174..D-177). */

export const p17Keys = {
  equipment: ['equipment'] as const,
  equipmentList: (p?: EquipmentListParams) => ['equipment', 'list', p] as const,
  equipmentItem: (id: string) => ['equipment', 'item', id] as const,
  categories: ['equipment', 'categories'] as const,
  nd: ['nd'] as const,
  ndList: (p?: NdListParams) => ['nd', 'list', p] as const,
  ndItem: (id: string) => ['nd', 'item', id] as const,
  feasibility: (id: string, n: number) => ['nd', 'feasibility', id, n] as const,
  reagentItems: (s?: string) => ['reagents', 'items', s] as const,
  consumptions: (protocolId: string) => ['consumptions', protocolId] as const,
};

// Apparatlar
export const useEquipmentQuery = (params?: EquipmentListParams) =>
  useQuery({ queryKey: p17Keys.equipmentList(params), queryFn: () => fetchEquipment(params) });
export const useEquipmentItemQuery = (id: string | undefined) =>
  useQuery({
    queryKey: p17Keys.equipmentItem(id ?? ''),
    queryFn: () => fetchEquipmentItem(id!),
    enabled: Boolean(id),
  });
export const useEquipmentCategoriesQuery = () =>
  useQuery({ queryKey: p17Keys.categories, queryFn: fetchEquipmentCategories, staleTime: 60_000 });

export function useSaveEquipmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id?: string; input: EquipmentInput }) =>
      v.id ? updateEquipment(v.id, v.input) : createEquipment(v.input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: p17Keys.equipment }),
  });
}
export function useDeleteEquipmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => void qc.invalidateQueries({ queryKey: p17Keys.equipment }),
  });
}

// ND
export const useNdListQuery = (params?: NdListParams, enabled = true) =>
  useQuery({ queryKey: p17Keys.ndList(params), queryFn: () => fetchNdList(params), enabled });
export const useNdQuery = (id: string) =>
  useQuery({ queryKey: p17Keys.ndItem(id), queryFn: () => fetchNd(id), enabled: Boolean(id) });
export const useFeasibilityQuery = (id: string, n: number, enabled = true) =>
  useQuery({
    queryKey: p17Keys.feasibility(id, n),
    queryFn: () => fetchFeasibility(id, n),
    enabled: enabled && Boolean(id) && n >= 1,
  });

function useNdInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: p17Keys.nd });
}

export function useSaveNdMutation() {
  const invalidate = useNdInvalidate();
  return useMutation({
    mutationFn: (v: { id?: string; input: NdInput }) =>
      v.id ? updateNd(v.id, v.input) : createNd(v.input),
    onSuccess: invalidate,
  });
}
export function useDeleteNdMutation() {
  const invalidate = useNdInvalidate();
  return useMutation({ mutationFn: deleteNd, onSuccess: invalidate });
}
export function useNdRequirementMutation(ndId: string) {
  const invalidate = useNdInvalidate();
  return useMutation({
    mutationFn: (v: { reqId?: string; input?: NdRequirementInput; remove?: boolean }) =>
      v.remove && v.reqId
        ? deleteNdRequirement(ndId, v.reqId)
        : v.reqId
          ? updateNdRequirement(ndId, v.reqId, v.input!)
          : addNdRequirement(ndId, v.input!),
    onSuccess: invalidate,
  });
}
export function useNdStatusMutation(ndId: string) {
  const invalidate = useNdInvalidate();
  return useMutation({
    mutationFn: (action: 'approve' | 'revise' | 'archive') => changeNdStatus(ndId, action),
    onSuccess: invalidate,
  });
}
export function useNdFileMutation(ndId: string) {
  const invalidate = useNdInvalidate();
  return useMutation({
    mutationFn: (file: File) => uploadNdFile(ndId, file),
    onSuccess: invalidate,
  });
}

// Katalog va sarf
export const useReagentItemsQuery = (search?: string) =>
  useQuery({ queryKey: p17Keys.reagentItems(search), queryFn: () => fetchReagentItems(search) });
export const useConsumptionsQuery = (protocolId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: p17Keys.consumptions(protocolId ?? ''),
    queryFn: () => fetchProtocolConsumptions(protocolId!),
    enabled: enabled && Boolean(protocolId),
  });

export function useReviewConsumptionMutation(protocolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; correct?: { quantity: number; reason: string } }) =>
      v.correct ? correctConsumption(v.id, v.correct) : confirmConsumption(v.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: p17Keys.consumptions(protocolId) });
      void qc.invalidateQueries({ queryKey: ['reagents'] });
    },
  });
}
