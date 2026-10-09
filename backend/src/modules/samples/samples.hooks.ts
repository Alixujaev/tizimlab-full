import type pg from 'pg';
import {
  notifySampleAssigned,
  notifySampleDecision,
} from '../notifications/notifications.events.js';
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
   * `approved`/`rejected` ga o'tishda xabarnoma yuboriladi (D-13). Protokol orqali o'tishlar
   * `protocolHooks` da (namuna statusi protokol servisida yangilanadi).
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
    await notifySampleAssigned(tx, sample, sample.assigned_by);
  },

  async onSampleStatusChanged(sample, oldStatus, newStatus, actorId, tx) {
    if (oldStatus === newStatus) return;
    if (newStatus === 'approved' || newStatus === 'rejected') {
      await notifySampleDecision(tx, sample, newStatus, actorId);
    }
  },

  async closeOpenProtocolsForSample(sample, actorId, tx) {
    await closeOpenProtocolsForSample(tx, sample.company_id, sample.id, actorId);
  },
};
