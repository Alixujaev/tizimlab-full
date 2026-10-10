import { apiClient } from '@/api/client';
import type {
  ApiResponse,
  CreateManualReadingInput,
  CreateSensorConfigInput,
  ListAlertsQuery,
  ListReadingsQuery,
  Paginated,
  ResolveAlertInput,
  SensorConfigDto,
  SensorStatusDto,
  TemperatureAlertDto,
  TemperatureReadingDto,
  UpdateSensorConfigInput,
} from '@/types';

export async function fetchTemperatureStatus(): Promise<SensorStatusDto[]> {
  const { data } = await apiClient.get<ApiResponse<SensorStatusDto[]>>('/temperature/status');
  return data.data;
}

export async function fetchSensors(): Promise<SensorConfigDto[]> {
  const { data } = await apiClient.get<ApiResponse<SensorConfigDto[]>>('/temperature/sensors');
  return data.data;
}

export async function fetchSensor(id: string): Promise<SensorConfigDto> {
  const { data } = await apiClient.get<ApiResponse<SensorConfigDto>>(`/temperature/sensors/${id}`);
  return data.data;
}

export async function createSensor(input: CreateSensorConfigInput): Promise<SensorConfigDto> {
  const { data } = await apiClient.post<ApiResponse<SensorConfigDto>>('/temperature/sensors', input);
  return data.data;
}

export async function updateSensor(
  id: string,
  input: UpdateSensorConfigInput,
): Promise<SensorConfigDto> {
  const { data } = await apiClient.put<ApiResponse<SensorConfigDto>>(`/temperature/sensors/${id}`, input);
  return data.data;
}

export async function deleteSensor(id: string): Promise<void> {
  await apiClient.delete(`/temperature/sensors/${id}`);
}

export async function fetchReadings(
  params?: ListReadingsQuery,
): Promise<Paginated<TemperatureReadingDto>> {
  const query: Record<string, string | number | boolean> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.sensorConfigId) query.sensorConfigId = params.sensorConfigId;
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.isManual !== undefined) query.isManual = params.isManual;
  if (params?.alertOnly !== undefined) query.alertOnly = params.alertOnly;

  const { data } = await apiClient.get<Paginated<TemperatureReadingDto>>('/temperature/readings', {
    params: query,
  });
  return data;
}

export async function createManualReading(
  input: CreateManualReadingInput,
): Promise<{ reading: TemperatureReadingDto; alertsCreated: number }> {
  const { data } = await apiClient.post<
    ApiResponse<{ reading: TemperatureReadingDto; alertsCreated: number }>
  >('/temperature/readings', input);
  return data.data;
}

export async function fetchAlerts(
  params?: ListAlertsQuery,
): Promise<Paginated<TemperatureAlertDto>> {
  const query: Record<string, string | number | boolean> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.sensorConfigId) query.sensorConfigId = params.sensorConfigId;
  if (params?.unresolvedOnly !== undefined) query.unresolvedOnly = params.unresolvedOnly;
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;

  const { data } = await apiClient.get<Paginated<TemperatureAlertDto>>('/temperature/alerts', {
    params: query,
  });
  return data;
}

export async function resolveAlert(
  id: string,
  input: ResolveAlertInput,
): Promise<TemperatureAlertDto> {
  const { data } = await apiClient.post<ApiResponse<TemperatureAlertDto>>(
    `/temperature/alerts/${id}/resolve`,
    input,
  );
  return data.data;
}
