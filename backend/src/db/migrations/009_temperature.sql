-- 009_temperature.sql: Harorat monitoringi (sensor sozlamalari, o'qishlar, alertlar)
-- Spec §7, SCHEMA_DIFF P8, DECISIONS.md D-12, D-52, D-78, D-83, D-137..D-140

-- 1. `sensor_configs` jadvali
CREATE TABLE sensor_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sensor_id varchar(100) NOT NULL,
  location_name varchar(255) NOT NULL,
  temp_min numeric(5,1) NOT NULL,
  temp_max numeric(5,1) NOT NULL,
  humidity_min numeric(5,1) NULL,
  humidity_max numeric(5,1) NULL,
  is_active boolean NOT NULL DEFAULT true,
  api_key varchar(255) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sensor_configs_company_sensor UNIQUE (company_id, sensor_id),
  CONSTRAINT temp_range_valid CHECK (temp_min < temp_max),
  CONSTRAINT temp_min_physical_range CHECK (temp_min >= -100 AND temp_min <= 100),
  CONSTRAINT temp_max_physical_range CHECK (temp_max >= -100 AND temp_max <= 100),
  CONSTRAINT humidity_range_valid CHECK (humidity_min IS NULL OR humidity_max IS NULL OR humidity_min < humidity_max),
  CONSTRAINT humidity_min_physical_range CHECK (humidity_min IS NULL OR (humidity_min >= 0 AND humidity_min <= 100)),
  CONSTRAINT humidity_max_physical_range CHECK (humidity_max IS NULL OR (humidity_max >= 0 AND humidity_max <= 100))
);

CREATE INDEX idx_sensor_configs_company_id ON sensor_configs(company_id);
CREATE INDEX idx_sensor_configs_company_sensor ON sensor_configs(company_id, sensor_id);

CREATE TRIGGER trg_sensor_configs_updated_at BEFORE UPDATE ON sensor_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. `temperature_readings` jadvali
CREATE TABLE temperature_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sensor_config_id uuid NOT NULL REFERENCES sensor_configs(id) ON DELETE RESTRICT,
  temperature numeric(5,2) NOT NULL,
  humidity numeric(5,2) NULL,
  alert_triggered boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  is_manual boolean NOT NULL DEFAULT false,
  recorded_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT temperature_range CHECK (temperature >= -100 AND temperature <= 100),
  CONSTRAINT humidity_range CHECK (humidity IS NULL OR (humidity >= 0 AND humidity <= 100))
);

CREATE INDEX idx_temp_readings_company_id ON temperature_readings(company_id);
CREATE INDEX idx_temp_readings_sensor_recorded ON temperature_readings(sensor_config_id, recorded_at DESC);
CREATE INDEX idx_temp_readings_recorded_at ON temperature_readings(recorded_at DESC);
CREATE INDEX idx_temp_readings_alerts ON temperature_readings(company_id, alert_triggered) WHERE alert_triggered = true;
CREATE INDEX idx_temp_readings_recorded_by ON temperature_readings(recorded_by) WHERE recorded_by IS NOT NULL;

-- 3. `temperature_alerts` jadvali
CREATE TABLE temperature_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sensor_config_id uuid NOT NULL REFERENCES sensor_configs(id) ON DELETE RESTRICT,
  reading_id uuid NOT NULL REFERENCES temperature_readings(id) ON DELETE CASCADE,
  temperature numeric(5,2) NOT NULL,
  alert_type varchar(50) NOT NULL,
  resolved_at timestamptz NULL,
  resolved_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  resolution_note text NULL,
  notified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_temp_alerts_company_id ON temperature_alerts(company_id);
CREATE INDEX idx_temp_alerts_sensor_created ON temperature_alerts(sensor_config_id, created_at DESC);
CREATE INDEX idx_temp_alerts_notified ON temperature_alerts(company_id, notified_at) WHERE notified_at IS NULL;
CREATE INDEX idx_temp_alerts_unresolved ON temperature_alerts(company_id, resolved_at) WHERE resolved_at IS NULL;
