import { query, withTransaction } from '../../config/database.js';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import { createNotification } from '../notifications/notifications.service.js';
import type {
  CreateManualReadingInput,
  CreateSensorConfigInput,
  IngestReadingInput,
  ListAlertsQuery,
  ListReadingsQuery,
  ResolveAlertInput,
  UpdateSensorConfigInput,
} from './temperature.schemas.js';
import type {
  SensorConfigDto,
  SensorConfigRow,
  SensorStatusDto,
  TemperatureAlertDto,
  TemperatureAlertRow,
  TemperatureReadingDto,
  TemperatureReadingRow,
} from './temperature.types.js';

export function toSensorConfigDto(row: SensorConfigRow): SensorConfigDto {
  return {
    id: row.id,
    companyId: row.company_id,
    sensorId: row.sensor_id,
    locationName: row.location_name,
    tempMin: Number(row.temp_min),
    tempMax: Number(row.temp_max),
    humidityMin: row.humidity_min != null ? Number(row.humidity_min) : null,
    humidityMax: row.humidity_max != null ? Number(row.humidity_max) : null,
    isActive: row.is_active,
    apiKey: row.api_key,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function toTemperatureReadingDto(row: TemperatureReadingRow): TemperatureReadingDto {
  return {
    id: row.id,
    companyId: row.company_id,
    sensorConfigId: row.sensor_config_id,
    sensorId: row.sensor_id,
    locationName: row.location_name,
    temperature: Number(row.temperature),
    humidity: row.humidity != null ? Number(row.humidity) : null,
    alertTriggered: row.alert_triggered,
    recordedAt: new Date(row.recorded_at).toISOString(),
    isManual: row.is_manual,
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by_name ?? null,
  };
}

export function toTemperatureAlertDto(row: TemperatureAlertRow): TemperatureAlertDto {
  return {
    id: row.id,
    companyId: row.company_id,
    sensorConfigId: row.sensor_config_id,
    sensorId: row.sensor_id,
    locationName: row.location_name,
    readingId: row.reading_id,
    temperature: Number(row.temperature),
    alertType: row.alert_type,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolvedBy: row.resolved_by,
    resolvedByName: row.resolved_by_name ?? null,
    resolutionNote: row.resolution_note,
    notifiedAt: row.notified_at ? new Date(row.notified_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ------------------- SENSOR CONFIGS CRUD -------------------

export async function listSensorConfigs(companyId: string): Promise<SensorConfigDto[]> {
  const { rows } = await query<SensorConfigRow>(
    `SELECT * FROM sensor_configs WHERE company_id = $1 ORDER BY created_at ASC`,
    [companyId],
  );
  return rows.map(toSensorConfigDto);
}

export async function getSensorConfigById(companyId: string, id: string): Promise<SensorConfigDto> {
  const { rows } = await query<SensorConfigRow>(
    `SELECT * FROM sensor_configs WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  if (!rows[0]) throw new NotFoundError('Sensor konfiguratsiyasi topilmadi');
  return toSensorConfigDto(rows[0]);
}

export async function createSensorConfig(
  companyId: string,
  input: CreateSensorConfigInput,
): Promise<SensorConfigDto> {
  const existing = await query<SensorConfigRow>(
    `SELECT id FROM sensor_configs WHERE company_id = $1 AND sensor_id = $2`,
    [companyId, input.sensorId],
  );
  if (existing.rows.length > 0) {
    throw new ConflictError(`'${input.sensorId}' identifikatorli sensor allaqachon mavjud`);
  }

  const { rows } = await query<SensorConfigRow>(
    `INSERT INTO sensor_configs (
      company_id, sensor_id, location_name, temp_min, temp_max, humidity_min, humidity_max, is_active, api_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      companyId,
      input.sensorId,
      input.locationName,
      input.tempMin,
      input.tempMax,
      input.humidityMin ?? null,
      input.humidityMax ?? null,
      input.isActive ?? true,
      input.apiKey ?? null,
    ],
  );

  return toSensorConfigDto(rows[0]!);
}

export async function updateSensorConfig(
  companyId: string,
  id: string,
  input: UpdateSensorConfigInput,
): Promise<SensorConfigDto> {
  const existing = await query<SensorConfigRow>(
    `SELECT * FROM sensor_configs WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  if (!existing.rows[0]) {
    throw new NotFoundError('Sensor konfiguratsiyasi topilmadi');
  }

  const current = existing.rows[0];
  if (input.sensorId && input.sensorId !== current.sensor_id) {
    const duplicate = await query<SensorConfigRow>(
      `SELECT id FROM sensor_configs WHERE company_id = $1 AND sensor_id = $2 AND id <> $3`,
      [companyId, input.sensorId, id],
    );
    if (duplicate.rows.length > 0) {
      throw new ConflictError(`'${input.sensorId}' identifikatorli sensor allaqachon mavjud`);
    }
  }

  const newTempMin = input.tempMin ?? Number(current.temp_min);
  const newTempMax = input.tempMax ?? Number(current.temp_max);
  if (newTempMin >= newTempMax) {
    throw new ValidationError('Minimal harorat maksimal haroratdan kichik bo‘lishi shart');
  }

  const newHumidityMin =
    input.humidityMin !== undefined
      ? input.humidityMin
      : current.humidity_min != null
        ? Number(current.humidity_min)
        : null;
  const newHumidityMax =
    input.humidityMax !== undefined
      ? input.humidityMax
      : current.humidity_max != null
        ? Number(current.humidity_max)
        : null;

  if (newHumidityMin != null && newHumidityMax != null && newHumidityMin >= newHumidityMax) {
    throw new ValidationError('Minimal namlik maksimal namlikdan kichik bo‘lishi shart');
  }

  const { rows } = await query<SensorConfigRow>(
    `UPDATE sensor_configs SET
      sensor_id = COALESCE($3, sensor_id),
      location_name = COALESCE($4, location_name),
      temp_min = $5,
      temp_max = $6,
      humidity_min = $7,
      humidity_max = $8,
      is_active = COALESCE($9, is_active),
      api_key = CASE WHEN $10::boolean THEN $11 ELSE api_key END
    WHERE id = $1 AND company_id = $2
    RETURNING *`,
    [
      id,
      companyId,
      input.sensorId ?? null,
      input.locationName ?? null,
      newTempMin,
      newTempMax,
      newHumidityMin,
      newHumidityMax,
      input.isActive ?? null,
      input.apiKey !== undefined,
      input.apiKey ?? null,
    ],
  );

  return toSensorConfigDto(rows[0]!);
}

export async function deleteSensorConfig(companyId: string, id: string): Promise<void> {
  const existing = await query<SensorConfigRow>(
    `SELECT id FROM sensor_configs WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  if (!existing.rows[0]) {
    throw new NotFoundError('Sensor konfiguratsiyasi topilmadi');
  }

  const readings = await query<{ count: string }>(
    `SELECT count(*) AS count FROM temperature_readings WHERE company_id = $1 AND sensor_config_id = $2`,
    [companyId, id],
  );
  if (Number(readings.rows[0]?.count ?? 0) > 0) {
    throw new ConflictError(
      "O'qishlari mavjud bo'lgan sensorni o'chirib bo'lmaydi. Uni nofaollashtirishingiz mumkin.",
    );
  }

  await query(`DELETE FROM sensor_configs WHERE id = $1 AND company_id = $2`, [id, companyId]);
}

// ------------------- READINGS & ALERTS -------------------

interface Violation {
  type: string;
  message: string;
}

export function detectViolations(
  config: SensorConfigRow,
  temperature: number,
  humidity?: number | null,
): Violation[] {
  const violations: Violation[] = [];
  const tempMin = Number(config.temp_min);
  const tempMax = Number(config.temp_max);

  if (temperature > tempMax) {
    violations.push({
      type: 'temp_high',
      message: `Harorat yuqori: ${temperature}°C > ${tempMax}°C`,
    });
  } else if (temperature < tempMin) {
    violations.push({
      type: 'temp_low',
      message: `Harorat past: ${temperature}°C < ${tempMin}°C`,
    });
  }

  if (humidity != null) {
    if (config.humidity_max != null && humidity > Number(config.humidity_max)) {
      violations.push({
        type: 'humidity_high',
        message: `Namlik yuqori: ${humidity}% > ${Number(config.humidity_max)}%`,
      });
    } else if (config.humidity_min != null && humidity < Number(config.humidity_min)) {
      violations.push({
        type: 'humidity_low',
        message: `Namlik past: ${humidity}% < ${Number(config.humidity_min)}%`,
      });
    }
  }

  return violations;
}

export async function recordReading(
  companyId: string,
  input: {
    sensorConfigId: string;
    temperature: number;
    humidity?: number | null;
    recordedAt?: string;
    isManual: boolean;
  },
  userId?: string | null,
): Promise<{ reading: TemperatureReadingDto; alertsCreated: number }> {
  const sensorRes = await query<SensorConfigRow>(
    `SELECT * FROM sensor_configs WHERE id = $1 AND company_id = $2`,
    [input.sensorConfigId, companyId],
  );
  const config = sensorRes.rows[0];
  if (!config) {
    throw new NotFoundError('Sensor konfiguratsiyasi topilmadi');
  }
  if (!config.is_active) {
    throw new ValidationError('Sensor faol emas');
  }

  const violations = detectViolations(config, input.temperature, input.humidity);
  const alertTriggered = violations.length > 0;

  return withTransaction(async (client) => {
    const readingRes = await client.query<TemperatureReadingRow>(
      `INSERT INTO temperature_readings (
        company_id, sensor_config_id, temperature, humidity, alert_triggered, recorded_at, is_manual, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7, $8)
      RETURNING *`,
      [
        companyId,
        config.id,
        input.temperature,
        input.humidity ?? null,
        alertTriggered,
        input.recordedAt ?? null,
        input.isManual,
        userId ?? null,
      ],
    );
    const reading = readingRes.rows[0]!;

    let alertsCreated = 0;
    for (const v of violations) {
      // D-138: Cooldown check — oxirgi 15 daqiqa ichida xuddi shu sensor va shu alert_type bo'yicha yopilmagan alert bormi?
      const cooldownRes = await client.query<{ id: string }>(
        `SELECT id FROM temperature_alerts
         WHERE company_id = $1
           AND sensor_config_id = $2
           AND alert_type = $3
           AND resolved_at IS NULL
           AND created_at >= now() - interval '15 minutes'
         LIMIT 1`,
        [companyId, config.id, v.type],
      );

      if (cooldownRes.rows.length === 0) {
        // Yangi alert yaratish
        const alertRes = await client.query<TemperatureAlertRow>(
          `INSERT INTO temperature_alerts (
            company_id, sensor_config_id, reading_id, temperature, alert_type, notified_at
          ) VALUES ($1, $2, $3, $4, $5, now())
          RETURNING *`,
          [companyId, config.id, reading.id, input.temperature, v.type],
        );
        alertsCreated++;

        // D-140: P6 xabarnomasi
        await createNotification(client, {
          companyId,
          type: 'temperature_alert',
          title: `Harorat/namlik ogohlantirishi: ${config.location_name}`,
          message: `${config.sensor_id} (${config.location_name}): ${v.message}`,
          referenceId: alertRes.rows[0]!.id,
          actorId: userId ?? null,
        });
      }
    }

    return {
      reading: toTemperatureReadingDto({
        ...reading,
        sensor_id: config.sensor_id,
        location_name: config.location_name,
      }),
      alertsCreated,
    };
  });
}

export async function createManualReading(
  companyId: string,
  userId: string,
  input: CreateManualReadingInput,
): Promise<{ reading: TemperatureReadingDto; alertsCreated: number }> {
  return recordReading(
    companyId,
    {
      sensorConfigId: input.sensorConfigId,
      temperature: input.temperature,
      humidity: input.humidity,
      recordedAt: input.recordedAt,
      isManual: true,
    },
    userId,
  );
}

export async function ingestDeviceReading(
  apiKeyHeaderOrParam: string | undefined,
  input: IngestReadingInput,
): Promise<{ reading: TemperatureReadingDto; alertsCreated: number }> {
  const key = apiKeyHeaderOrParam || input.apiKey;
  if (!key) {
    throw new UnauthorizedError('Sensor kaliti talab qilinadi (X-Sensor-Key yoki apiKey)');
  }

  let sensorRes;
  if (input.sensorConfigId) {
    sensorRes = await query<SensorConfigRow>(
      `SELECT * FROM sensor_configs WHERE id = $1 AND api_key = $2`,
      [input.sensorConfigId, key],
    );
  } else if (input.sensorId) {
    sensorRes = await query<SensorConfigRow>(
      `SELECT * FROM sensor_configs WHERE sensor_id = $1 AND api_key = $2`,
      [input.sensorId, key],
    );
  } else {
    sensorRes = await query<SensorConfigRow>(
      `SELECT * FROM sensor_configs WHERE api_key = $1`,
      [key],
    );
  }

  const config = sensorRes.rows[0];
  if (!config) {
    throw new UnauthorizedError('Yaroqsiz sensor kaliti yoki sensor topilmadi');
  }

  return recordReading(
    config.company_id,
    {
      sensorConfigId: config.id,
      temperature: input.temperature,
      humidity: input.humidity,
      recordedAt: input.recordedAt,
      isManual: false,
    },
    null,
  );
}

export async function listReadings(
  companyId: string,
  q: ListReadingsQuery,
): Promise<PaginatedResult<TemperatureReadingDto>> {
  const page = q.page ? Number(q.page) : 1;
  const limit = q.limit ? Number(q.limit) : 20;
  const offset = toOffset({ page, limit });

  const conditions: string[] = ['r.company_id = $1'];
  const params: unknown[] = [companyId];
  let pIdx = 2;

  if (q.sensorConfigId) {
    conditions.push(`r.sensor_config_id = $${pIdx++}`);
    params.push(q.sensorConfigId);
  }
  if (q.from) {
    conditions.push(`r.recorded_at >= $${pIdx++}`);
    params.push(q.from);
  }
  if (q.to) {
    conditions.push(`r.recorded_at <= $${pIdx++}`);
    params.push(q.to);
  }
  if (q.isManual !== undefined) {
    conditions.push(`r.is_manual = $${pIdx++}`);
    params.push(q.isManual);
  }
  if (q.alertOnly) {
    conditions.push(`r.alert_triggered = true`);
  }

  const whereClause = conditions.join(' AND ');

  const [listRes, countRes] = await Promise.all([
    query<TemperatureReadingRow>(
      `SELECT
        r.*,
        s.sensor_id,
        s.location_name,
        u.full_name AS recorded_by_name
       FROM temperature_readings r
       JOIN sensor_configs s ON s.id = r.sensor_config_id
       LEFT JOIN users u ON u.id = r.recorded_by
       WHERE ${whereClause}
       ORDER BY r.recorded_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset],
    ),
    query<{ total: string }>(
      `SELECT count(*) AS total
       FROM temperature_readings r
       WHERE ${whereClause}`,
      params,
    ),
  ]);

  return {
    items: listRes.rows.map(toTemperatureReadingDto),
    meta: {
      page,
      limit,
      total: Number(countRes.rows[0]?.total ?? 0),
    },
  };
}

export async function listAlerts(
  companyId: string,
  q: ListAlertsQuery,
): Promise<PaginatedResult<TemperatureAlertDto>> {
  const page = q.page ? Number(q.page) : 1;
  const limit = q.limit ? Number(q.limit) : 20;
  const offset = toOffset({ page, limit });

  const conditions: string[] = ['a.company_id = $1'];
  const params: unknown[] = [companyId];
  let pIdx = 2;

  if (q.sensorConfigId) {
    conditions.push(`a.sensor_config_id = $${pIdx++}`);
    params.push(q.sensorConfigId);
  }
  if (q.unresolvedOnly) {
    conditions.push(`a.resolved_at IS NULL`);
  }
  if (q.from) {
    conditions.push(`a.created_at >= $${pIdx++}`);
    params.push(q.from);
  }
  if (q.to) {
    conditions.push(`a.created_at <= $${pIdx++}`);
    params.push(q.to);
  }

  const whereClause = conditions.join(' AND ');

  const [listRes, countRes] = await Promise.all([
    query<TemperatureAlertRow>(
      `SELECT
        a.*,
        s.sensor_id,
        s.location_name,
        u.full_name AS resolved_by_name
       FROM temperature_alerts a
       JOIN sensor_configs s ON s.id = a.sensor_config_id
       LEFT JOIN users u ON u.id = a.resolved_by
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset],
    ),
    query<{ total: string }>(
      `SELECT count(*) AS total
       FROM temperature_alerts a
       WHERE ${whereClause}`,
      params,
    ),
  ]);

  return {
    items: listRes.rows.map(toTemperatureAlertDto),
    meta: {
      page,
      limit,
      total: Number(countRes.rows[0]?.total ?? 0),
    },
  };
}

export async function resolveAlert(
  companyId: string,
  alertId: string,
  userId: string,
  input: ResolveAlertInput,
): Promise<TemperatureAlertDto> {
  const existing = await query<TemperatureAlertRow>(
    `SELECT a.*, s.sensor_id, s.location_name
     FROM temperature_alerts a
     JOIN sensor_configs s ON s.id = a.sensor_config_id
     WHERE a.id = $1 AND a.company_id = $2`,
    [alertId, companyId],
  );

  if (!existing.rows[0]) {
    throw new NotFoundError('Harorat alerti topilmadi');
  }

  const { rows } = await query<TemperatureAlertRow>(
    `UPDATE temperature_alerts SET
      resolved_at = COALESCE(resolved_at, now()),
      resolved_by = COALESCE(resolved_by, $3),
      resolution_note = COALESCE($4, resolution_note)
    WHERE id = $1 AND company_id = $2
    RETURNING *`,
    [alertId, companyId, userId, input.resolutionNote ?? null],
  );

  const updated = rows[0]!;
  const userRes = await query<{ full_name: string }>(`SELECT full_name FROM users WHERE id = $1`, [userId]);

  return toTemperatureAlertDto({
    ...updated,
    sensor_id: existing.rows[0].sensor_id,
    location_name: existing.rows[0].location_name,
    resolved_by_name: userRes.rows[0]?.full_name,
  });
}

export async function getSensorsStatus(companyId: string): Promise<SensorStatusDto[]> {
  const configs = await listSensorConfigs(companyId);

  const results: SensorStatusDto[] = [];
  for (const config of configs) {
    const [latestRes, alertCountRes, statsRes] = await Promise.all([
      query<TemperatureReadingRow>(
        `SELECT r.*, s.sensor_id, s.location_name, u.full_name AS recorded_by_name
         FROM temperature_readings r
         JOIN sensor_configs s ON s.id = r.sensor_config_id
         LEFT JOIN users u ON u.id = r.recorded_by
         WHERE r.company_id = $1 AND r.sensor_config_id = $2
         ORDER BY r.recorded_at DESC
         LIMIT 1`,
        [companyId, config.id],
      ),
      query<{ count: string }>(
        `SELECT count(*) AS count
         FROM temperature_alerts
         WHERE company_id = $1 AND sensor_config_id = $2 AND resolved_at IS NULL`,
        [companyId, config.id],
      ),
      query<{ min_temp: string | null; max_temp: string | null; avg_temp: string | null; count: string }>(
        `SELECT
          min(temperature) AS min_temp,
          max(temperature) AS max_temp,
          avg(temperature) AS avg_temp,
          count(*) AS count
         FROM temperature_readings
         WHERE company_id = $1
           AND sensor_config_id = $2
           AND recorded_at >= now() - interval '24 hours'`,
        [companyId, config.id],
      ),
    ]);

    const stats = statsRes.rows[0];
    results.push({
      sensor: config,
      latestReading: latestRes.rows[0] ? toTemperatureReadingDto(latestRes.rows[0]) : null,
      activeAlertCount: Number(alertCountRes.rows[0]?.count ?? 0),
      stats24h: stats
        ? {
            minTemp: stats.min_temp != null ? Number(stats.min_temp) : null,
            maxTemp: stats.max_temp != null ? Number(stats.max_temp) : null,
            avgTemp: stats.avg_temp != null ? Number(Number(stats.avg_temp).toFixed(2)) : null,
            readingCount: Number(stats.count),
          }
        : undefined,
    });
  }

  return results;
}
