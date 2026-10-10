import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createManualReading,
  createSensor,
  deleteSensor,
  fetchAlerts,
  fetchReadings,
  fetchSensor,
  fetchSensors,
  fetchTemperatureStatus,
  resolveAlert,
  updateSensor,
} from '@/api/temperature';
import type {
  CreateManualReadingInput,
  CreateSensorConfigInput,
  ListAlertsQuery,
  ListReadingsQuery,
  ResolveAlertInput,
  UpdateSensorConfigInput,
} from '@/types';

export const temperatureKeys = {
  all: ['temperature'] as const,
  status: () => [...temperatureKeys.all, 'status'] as const,
  sensors: () => [...temperatureKeys.all, 'sensors'] as const,
  sensor: (id: string) => [...temperatureKeys.sensors(), id] as const,
  readings: (params?: ListReadingsQuery) => [...temperatureKeys.all, 'readings', params] as const,
  alerts: (params?: ListAlertsQuery) => [...temperatureKeys.all, 'alerts', params] as const,
};

export function useTemperatureStatusQuery(enabled = true) {
  return useQuery({
    queryKey: temperatureKeys.status(),
    queryFn: fetchTemperatureStatus,
    enabled,
    refetchInterval: 30000, // 30 soniyada yangilab turish
  });
}

export function useSensorsQuery(enabled = true) {
  return useQuery({
    queryKey: temperatureKeys.sensors(),
    queryFn: fetchSensors,
    enabled,
  });
}

export function useSensorQuery(id: string) {
  return useQuery({
    queryKey: temperatureKeys.sensor(id),
    queryFn: () => fetchSensor(id),
    enabled: Boolean(id),
  });
}

export function useCreateSensorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSensorConfigInput) => createSensor(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: temperatureKeys.all });
    },
  });
}

export function useUpdateSensorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSensorConfigInput }) =>
      updateSensor(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: temperatureKeys.all });
    },
  });
}

export function useDeleteSensorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSensor(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: temperatureKeys.all });
    },
  });
}

export function useReadingsQuery(params?: ListReadingsQuery, enabled = true) {
  return useQuery({
    queryKey: temperatureKeys.readings(params),
    queryFn: () => fetchReadings(params),
    enabled,
  });
}

export function useCreateManualReadingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualReadingInput) => createManualReading(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: temperatureKeys.all });
    },
  });
}

export function useAlertsQuery(params?: ListAlertsQuery, enabled = true) {
  return useQuery({
    queryKey: temperatureKeys.alerts(params),
    queryFn: () => fetchAlerts(params),
    enabled,
  });
}

export function useResolveAlertMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveAlertInput }) => resolveAlert(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: temperatureKeys.all });
    },
  });
}
