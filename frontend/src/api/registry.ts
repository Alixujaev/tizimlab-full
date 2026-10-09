import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  DownloadLink,
  Paginated,
  RegistryDetailDto,
  RegistryItemDto,
  RegistryListParams,
} from '@/types';

export async function fetchRegistry(
  params?: RegistryListParams,
): Promise<Paginated<RegistryItemDto>> {
  // Bo'sh qiymatlar yuborilmaydi
  const query = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== ''),
  );
  const { data } = await apiClient.get<Paginated<RegistryItemDto>>('/registry', { params: query });
  return data;
}

export async function fetchRegistryItem(id: string): Promise<RegistryDetailDto> {
  const { data } = await apiClient.get<ApiResponse<RegistryDetailDto>>(`/registry/${id}`);
  return data.data;
}

export async function fetchRegistryDownloadLink(id: string): Promise<DownloadLink> {
  const { data } = await apiClient.get<ApiResponse<DownloadLink>>(`/registry/${id}/download`);
  return data.data;
}

export async function deleteRegistryItem(id: string): Promise<void> {
  await apiClient.delete(`/registry/${id}`);
}
