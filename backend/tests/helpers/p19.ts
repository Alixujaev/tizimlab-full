import type express from 'express';
import request from 'supertest';
import { query } from '../../src/config/database.js';
import type { TestCompany, TestUser } from './auth.js';
import { textPdf } from './pdf.js';

/**
 * P19 testlari uchun: namuna → biriktirish → asosiy fayl (+ peak fayllari) → yuborish → (ixtiyoriy) tasdiqlash.
 * `who` — tokenlar lug'ati kalitlari: kontrolyor, labHead, chemist (kompaniya qo'shimchasi bilan).
 */
export interface Actors {
  tokens: Record<string, string>;
  users: Record<string, TestUser>;
}

export async function protocolFlow(
  app: express.Express,
  actors: Actors,
  opts: {
    suffix?: string;
    substanceName?: string;
    serialNumber?: string;
    mainText?: string;
    peaks?: { name: string; text?: string; body?: Buffer }[];
    approve?: boolean;
    equipmentId?: string | null;
    analysisDate?: string;
  } = {},
): Promise<{ sampleId: string; protocolId: string; peakFileIds: string[] }> {
  const sfx = opts.suffix ?? '';
  const auth = (who: string) => ({ Authorization: `Bearer ${actors.tokens[`${who}${sfx}`]}` });
  const s = await request(app)
    .post('/api/v1/samples')
    .set(auth('kontrolyor'))
    .send({
      type: 'raw_material',
      substanceName: opts.substanceName ?? 'Ibuprofen',
      serialNumber: opts.serialNumber ?? null,
    })
    .expect(201);
  const sampleId = s.body.data.id as string;
  await request(app)
    .post(`/api/v1/samples/${sampleId}/assign`)
    .set(auth('labHead'))
    .send({ chemistId: actors.users[`chemist${sfx}`]!.id })
    .expect(200);
  const list = await request(app).get(`/api/v1/protocols/sample/${sampleId}`).set(auth('chemist'));
  const protocolId = list.body.data[0].id as string;
  await request(app)
    .post(`/api/v1/protocols/${protocolId}/file`)
    .set(auth('chemist'))
    .attach('file', textPdf(opts.mainText ?? `${opts.substanceName ?? 'Ibuprofen'} assay protocol result conforms`), 'protocol.pdf')
    .expect(200);
  const peakFileIds: string[] = [];
  for (const p of opts.peaks ?? []) {
    const up = await request(app)
      .post(`/api/v1/protocols/${protocolId}/peaks`)
      .set(auth('chemist'))
      .attach('file', p.body ?? textPdf(p.text ?? `Chromatogram ${p.name}`), p.name)
      .expect(201);
    peakFileIds.push(up.body.data.id as string);
  }
  await request(app)
    .post(`/api/v1/protocols/${protocolId}/submit`)
    .set(auth('chemist'))
    .send({ equipmentId: opts.equipmentId ?? null, analysisDate: opts.analysisDate ?? '2026-03-10' })
    .expect(200);
  if (opts.approve !== false) {
    await request(app).post(`/api/v1/protocols/${protocolId}/approve`).set(auth('labHead')).expect(200);
  }
  return { sampleId, protocolId, peakFileIds };
}

/** Tasdiqlangan peak qatorlarini to'g'ridan-to'g'ri yozadi (solishtirish testlari uchun). */
export async function seedPeaks(
  company: TestCompany,
  protocolId: string,
  fileId: string,
  rows: { name?: string | null; rt: number; areaPercent?: number; tailing?: number; plates?: number }[],
  status: 'draft' | 'confirmed' = 'confirmed',
): Promise<void> {
  for (const r of rows) {
    await query(
      `INSERT INTO peak_results (company_id, protocol_id, protocol_file_id, peak_name, retention_time, area_percent,
                                 tailing, plates, status, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 = 'confirmed' THEN now() END)`,
      [company.id, protocolId, fileId, r.name ?? null, r.rt, r.areaPercent ?? null, r.tailing ?? null, r.plates ?? null, status],
    );
  }
}
