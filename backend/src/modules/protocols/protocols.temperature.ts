import type pg from 'pg';
import { NotFoundError } from '../../utils/errors.js';
import { ANALYTICS_TZ } from '../analytics/analytics.period.js';

/**
 * D-173 (TZ §3.5): protokol rasmiylashtirilganda (kimyogar yuborganda) tanlangan xona (sensor) bo'yicha
 * tahlil sanasiga eng yaqin harorat o'qishi protokolga JSON snapshot sifatida ko'chiriladi.
 *
 * - Tahlil sanasi: so'rovdagi `analysisDate` → namunaning `analysis_end` → bugun (Asia/Tashkent).
 * - Mo'ljal: shu kunning 12:00 (Toshkent); oyna ±`SNAPSHOT_WINDOW_HOURS` — undan uzoq o'qish olinmaydi.
 * - Xona tanlanmasa `no_room`, oynada o'qish bo'lmasa `no_reading` ogohlantirishi saqlanadi
 *   (yuborish bloklanmaydi — laboratoriya harorat yozuvini keyin to'ldirishi mumkin, lekin protokolda iz qoladi).
 */
export const SNAPSHOT_WINDOW_HOURS = 24;

export type TemperatureWarning = 'no_room' | 'no_reading';

export interface TemperatureSnapshot {
  readingId: string;
  sensorConfigId: string;
  sensorId: string;
  locationName: string;
  temperature: number;
  humidity: number | null;
  recordedAt: string;
  isManual: boolean;
  /** O'qish chegaradan chiqqanmi (sensor chegaralari bo'yicha, o'qish vaqtidagi holat). */
  alertTriggered: boolean;
  analysisDate: string;
  capturedAt: string;
}

export interface SnapshotResult {
  sensorConfigId: string | null;
  snapshot: TemperatureSnapshot | null;
  warning: TemperatureWarning | null;
}

interface ReadingRow {
  id: string;
  temperature: string;
  humidity: string | null;
  recorded_at: Date;
  is_manual: boolean;
  alert_triggered: boolean;
}

export async function captureTemperatureSnapshot(
  client: pg.PoolClient,
  input: {
    companyId: string;
    sensorConfigId: string | null | undefined;
    analysisDate: string;
    now?: Date;
  },
): Promise<SnapshotResult> {
  if (!input.sensorConfigId) return { sensorConfigId: null, snapshot: null, warning: 'no_room' };

  // Tenant: sensor shu kompaniyaniki bo'lishi shart (boshqasi — 404, mavjudligi oshkor qilinmaydi)
  const sensorRes = await client.query<{ id: string; sensor_id: string; location_name: string }>(
    `SELECT id, sensor_id, location_name FROM sensor_configs WHERE id = $1 AND company_id = $2`,
    [input.sensorConfigId, input.companyId],
  );
  const sensor = sensorRes.rows[0];
  if (!sensor) throw new NotFoundError('Xona (sensor) topilmadi');

  const { rows } = await client.query<ReadingRow>(
    `WITH target AS (SELECT (($1::date + time '12:00') AT TIME ZONE $2) AS t)
     SELECT r.id, r.temperature::text, r.humidity::text, r.recorded_at, r.is_manual, r.alert_triggered
     FROM temperature_readings r, target
     WHERE r.sensor_config_id = $3 AND r.company_id = $4
       AND r.recorded_at BETWEEN target.t - make_interval(hours => $5) AND target.t + make_interval(hours => $5)
     ORDER BY abs(extract(epoch FROM (r.recorded_at - target.t))), r.recorded_at DESC
     LIMIT 1`,
    [input.analysisDate, ANALYTICS_TZ, sensor.id, input.companyId, SNAPSHOT_WINDOW_HOURS],
  );
  const reading = rows[0];
  if (!reading) return { sensorConfigId: sensor.id, snapshot: null, warning: 'no_reading' };

  return {
    sensorConfigId: sensor.id,
    warning: null,
    snapshot: {
      readingId: reading.id,
      sensorConfigId: sensor.id,
      sensorId: sensor.sensor_id,
      locationName: sensor.location_name,
      temperature: Number(reading.temperature),
      humidity: reading.humidity === null ? null : Number(reading.humidity),
      recordedAt: new Date(reading.recorded_at).toISOString(),
      isManual: reading.is_manual,
      alertTriggered: reading.alert_triggered,
      analysisDate: input.analysisDate,
      capturedAt: (input.now ?? new Date()).toISOString(),
    },
  };
}

/** Tahlil sanasi: so'rov → namuna `analysis_end` → bugun (Toshkent). */
export async function resolveAnalysisDate(
  client: pg.PoolClient,
  sampleId: string,
  requested: string | null | undefined,
): Promise<string> {
  if (requested) return requested;
  const { rows } = await client.query<{ d: string }>(
    `SELECT COALESCE(analysis_end, (now() AT TIME ZONE $2)::date)::text AS d FROM samples WHERE id = $1`,
    [sampleId, ANALYTICS_TZ],
  );
  return rows[0]!.d;
}
