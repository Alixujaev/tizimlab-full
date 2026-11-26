import { apiClient } from '@/api/client';
import type { ApiResponse, DownloadLink, Paginated } from '@/types';
import type {
  ConsumptionDto,
  EquipmentDto,
  EquipmentInput,
  EquipmentListParams,
  FeasibilityDto,
  NdDetailDto,
  NdDto,
  NdInput,
  NdListParams,
  NdRequirementInput,
  ReagentItemDto,
} from '@/types/p17';

/** P17 API: apparatlar (D-175), ND va moslik (D-176), avto-sarf (D-177), reaktiv katalogi (D-174). */

const clean = (params?: object) =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== ''));

// ---------------------------------------------------------------- Apparatlar
export async function fetchEquipment(
  params?: EquipmentListParams,
): Promise<Paginated<EquipmentDto>> {
  const { data } = await apiClient.get<Paginated<EquipmentDto>>('/equipment', {
    params: clean(params),
  });
  return data;
}
export async function fetchEquipmentItem(id: string): Promise<EquipmentDto> {
  return (await apiClient.get<ApiResponse<EquipmentDto>>(`/equipment/${id}`)).data.data;
}
export async function fetchEquipmentCategories(): Promise<string[]> {
  return (await apiClient.get<ApiResponse<string[]>>('/equipment/categories')).data.data;
}
export async function createEquipment(input: EquipmentInput): Promise<EquipmentDto> {
  return (await apiClient.post<ApiResponse<EquipmentDto>>('/equipment', input)).data.data;
}
export async function updateEquipment(
  id: string,
  input: Partial<EquipmentInput>,
): Promise<EquipmentDto> {
  return (await apiClient.put<ApiResponse<EquipmentDto>>(`/equipment/${id}`, input)).data.data;
}
export async function deleteEquipment(id: string): Promise<void> {
  await apiClient.delete(`/equipment/${id}`);
}

// ---------------------------------------------------------------- ND
export async function fetchNdList(params?: NdListParams): Promise<Paginated<NdDto>> {
  const { data } = await apiClient.get<Paginated<NdDto>>('/nd', { params: clean(params) });
  return data;
}
export async function fetchNd(id: string): Promise<NdDetailDto> {
  return (await apiClient.get<ApiResponse<NdDetailDto>>(`/nd/${id}`)).data.data;
}
export async function createNd(input: NdInput): Promise<NdDetailDto> {
  return (await apiClient.post<ApiResponse<NdDetailDto>>('/nd', input)).data.data;
}
export async function updateNd(id: string, input: Partial<NdInput>): Promise<NdDetailDto> {
  return (await apiClient.put<ApiResponse<NdDetailDto>>(`/nd/${id}`, input)).data.data;
}
export async function deleteNd(id: string): Promise<void> {
  await apiClient.delete(`/nd/${id}`);
}
export async function addNdRequirement(
  id: string,
  input: NdRequirementInput,
): Promise<NdDetailDto> {
  return (await apiClient.post<ApiResponse<NdDetailDto>>(`/nd/${id}/requirements`, input)).data
    .data;
}
export async function updateNdRequirement(
  id: string,
  reqId: string,
  input: NdRequirementInput,
): Promise<NdDetailDto> {
  return (await apiClient.put<ApiResponse<NdDetailDto>>(`/nd/${id}/requirements/${reqId}`, input))
    .data.data;
}
export async function deleteNdRequirement(id: string, reqId: string): Promise<NdDetailDto> {
  return (await apiClient.delete<ApiResponse<NdDetailDto>>(`/nd/${id}/requirements/${reqId}`)).data
    .data;
}
export async function changeNdStatus(
  id: string,
  action: 'approve' | 'revise' | 'archive',
): Promise<NdDetailDto> {
  return (await apiClient.post<ApiResponse<NdDetailDto>>(`/nd/${id}/${action}`)).data.data;
}
export async function uploadNdFile(id: string, file: File): Promise<NdDetailDto> {
  const form = new FormData();
  form.append('file', file);
  return (await apiClient.post<ApiResponse<NdDetailDto>>(`/nd/${id}/file`, form)).data.data;
}
export async function getNdFileUrl(id: string): Promise<DownloadLink> {
  return (await apiClient.get<ApiResponse<DownloadLink>>(`/nd/${id}/file`)).data.data;
}
export async function fetchFeasibility(id: string, n: number): Promise<FeasibilityDto> {
  return (
    await apiClient.get<ApiResponse<FeasibilityDto>>(`/nd/${id}/feasibility`, { params: { n } })
  ).data.data;
}

// ---------------------------------------------------------------- Reaktiv katalogi va sarf
export async function fetchReagentItems(search?: string): Promise<ReagentItemDto[]> {
  return (
    await apiClient.get<ApiResponse<ReagentItemDto[]>>('/reagents/items', {
      params: clean({ search, limit: 100 }),
    })
  ).data.data;
}
export async function fetchProtocolConsumptions(protocolId: string): Promise<ConsumptionDto[]> {
  return (
    await apiClient.get<ApiResponse<ConsumptionDto[]>>(`/consumptions/protocol/${protocolId}`)
  ).data.data;
}
export async function confirmConsumption(id: string): Promise<ConsumptionDto> {
  return (await apiClient.post<ApiResponse<ConsumptionDto>>(`/consumptions/${id}/confirm`)).data
    .data;
}
export async function correctConsumption(
  id: string,
  input: { quantity: number; reason: string },
): Promise<ConsumptionDto> {
  return (await apiClient.post<ApiResponse<ConsumptionDto>>(`/consumptions/${id}/correct`, input))
    .data.data;
}
