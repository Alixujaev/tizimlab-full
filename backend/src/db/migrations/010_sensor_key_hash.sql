-- 010_sensor_key_hash.sql: sensor kalitlarini sha256 xeshga o'tkazish va indeks
-- DECISIONS.md D-141

UPDATE sensor_configs
SET api_key = encode(sha256(api_key::bytea), 'hex')
WHERE api_key IS NOT NULL AND length(api_key) <> 64;

CREATE INDEX IF NOT EXISTS idx_sensor_configs_api_key ON sensor_configs(api_key);
