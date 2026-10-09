import type pg from 'pg';
import type { DownloadLink } from '../files/files.service.js';
import type { FileStorage } from '../files/files.storage.js';
import type { SampleRow } from '../samples/samples.types.js';

export interface RegistryHooks {
  /**
   * `finished_product` uchun `final` protokol faylining yuklab olish havolasi (D-44).
   * P5 da protocols jadvali bilan ulanadi; hozir protokol yo'q — `null` (→ 404).
   */
  getFinalProtocolFile: (
    sample: SampleRow,
    storage: FileStorage | null,
  ) => Promise<DownloadLink | null>;

  /**
   * Faol stabilizatsiyasi bor namunani reyestrdan o'chirish rad etiladi (D-43, R-REG-15).
   * P9 da stability_studies jadvali bilan ulanadi; hozir jadval yo'q — tekshiruv bo'sh.
   */
  assertNoActiveStability: (sample: SampleRow, tx: pg.PoolClient) => Promise<void>;
}

export const registryHooks: RegistryHooks = {
  async getFinalProtocolFile(sample, storage) {
    // P5 integratsiyasi uchun ulanish nuqtasi
    void sample;
    void storage;
    return null;
  },

  async assertNoActiveStability(sample, _tx) {
    // P9 integratsiyasi uchun ulanish nuqtasi
    void sample;
  },
};
