-- 020_protocol_temperature.sql: protokolga xona harorati snapshot'i (TZ §3.5, DECISIONS.md D-173)
-- Snapshot JSON nusxa — harorat jurnali keyin o'zgarsa yoki o'qish o'chirilsa ham protokolda saqlanadi.

ALTER TABLE protocols
  ADD COLUMN sensor_config_id uuid NULL REFERENCES sensor_configs(id) ON DELETE SET NULL,
  ADD COLUMN temperature_snapshot jsonb NULL,
  ADD COLUMN temperature_warning varchar(20) NULL
    CHECK (temperature_warning IS NULL OR temperature_warning IN ('no_room', 'no_reading')),
  ADD CONSTRAINT protocols_temperature_consistency_check
    CHECK (temperature_snapshot IS NULL OR temperature_warning IS NULL);

CREATE INDEX IF NOT EXISTS idx_protocols_sensor_config ON protocols(sensor_config_id)
  WHERE sensor_config_id IS NOT NULL;
