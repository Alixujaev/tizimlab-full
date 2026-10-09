import type pg from 'pg';
import {
  autoCreateProtocolOnAssignment,
  closeOpenProtocolsForSample,
} from '../protocols/protocols.service.js';
import type { SampleRow, SampleStatus } from './samples.types.js';

export interface SampleHooks {
  /**
   * Namunani kimyogarga biriktirilganda chaqiriladi.
   * P5 da bu nuqtada avtomatik protokol (finished_product -> final, boshqalar -> standard) yaratiladi (D-15).
   */
  onSampleAssigned: (
    sample: SampleRow,
    chemistUser: { id: string; fullName: string },
    tx: pg.PoolClient,
  ) => Promise<void>;

  /**
   * Namuna statusi o'zgarganda chaqiriladi.
   * P6 da bu nuqtada xabarnomalar (real-vaqt, in-app, Telegram) yuboriladi (D-13).
   */
  onSampleStatusChanged: (
    sample: SampleRow,
    oldStatus: SampleStatus,
    newStatus: SampleStatus,
    actorId: string,
    tx: pg.PoolClient,
  ) => Promise<void>;

  /**
   * Namuna pasport orqali tasdiqlanganda chaqiriladi.
   * P5 da bu nuqtada ochiq protokollar imzo va xabarnomasiz `approved` ga o'tkaziladi,
   * tracking'ga "pasport orqali yopildi" yoziladi (D-42).
   */
  closeOpenProtocolsForSample: (
    sample: SampleRow,
    actorId: string,
    tx: pg.PoolClient,
  ) => Promise<void>;
}

export const sampleHooks: SampleHooks = {
  async onSampleAssigned(sample, chemistUser, tx) {
    await autoCreateProtocolOnAssignment(
      tx,
      sample.company_id,
      sample.id,
      sample.type,
      sample.assigned_by || chemistUser.id,
    );
  },

  async onSampleStatusChanged(sample, oldStatus, newStatus, actorId, _tx) {
    // P6 integratsiyasi uchun ulanish nuqtasi
    void sample;
    void oldStatus;
    void newStatus;
    void actorId;
  },

  async closeOpenProtocolsForSample(sample, actorId, tx) {
    await closeOpenProtocolsForSample(tx, sample.company_id, sample.id, actorId);
  },
};
