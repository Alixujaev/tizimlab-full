export interface SensorConfigRow {
  id: string;
  company_id: string;
  sensor_id: string;
  location_name: string;
  temp_min: string | number;
  temp_max: string | number;
  humidity_min: string | number | null;
  humidity_max: string | number | null;
  is_active: boolean;
  api_key: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SensorConfigDto {
  id: string;
  companyId: string;
  sensorId: string;
  locationName: string;
  tempMin: number;
  tempMax: number;
  humidityMin: number | null;
  humidityMax: number | null;
  isActive: boolean;
  apiKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureReadingRow {
  id: string;
  company_id: string;
  sensor_config_id: string;
  temperature: string | number;
  humidity: string | number | null;
  alert_triggered: boolean;
  recorded_at: Date | string;
  is_manual: boolean;
  recorded_by: string | null;
  sensor_id?: string;
  location_name?: string;
  recorded_by_name?: string;
}

export interface TemperatureReadingDto {
  id: string;
  companyId: string;
  sensorConfigId: string;
  sensorId?: string;
  locationName?: string;
  temperature: number;
  humidity: number | null;
  alertTriggered: boolean;
  recordedAt: string;
  isManual: boolean;
  recordedBy: string | null;
  recordedByName?: string | null;
}

export interface TemperatureAlertRow {
  id: string;
  company_id: string;
  sensor_config_id: string;
  reading_id: string;
  temperature: string | number;
  alert_type: string;
  resolved_at: Date | string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  notified_at: Date | string | null;
  created_at: Date | string;
  sensor_id?: string;
  location_name?: string;
  resolved_by_name?: string;
}

export interface TemperatureAlertDto {
  id: string;
  companyId: string;
  sensorConfigId: string;
  sensorId?: string;
  locationName?: string;
  readingId: string;
  temperature: number;
  alertType: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByName?: string | null;
  resolutionNote: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

export interface SensorStatusDto {
  sensor: SensorConfigDto;
  latestReading: TemperatureReadingDto | null;
  activeAlertCount: number;
  stats24h?: {
    minTemp: number | null;
    maxTemp: number | null;
    avgTemp: number | null;
    readingCount: number;
  };
}
