import type pg from 'pg';
import { query } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import type { DownloadLink } from '../files/files.service.js';
import type { FileStorage } from '../files/files.storage.js';
import { contentDisposition } from '../files/files.validation.js';
import type { ProtocolRow } from '../protocols/protocols.types.js';
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
    if (!storage) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Fayl saqlash xizmati ulanmagan');

    const { rows } = await query<ProtocolRow>(
      `SELECT * FROM protocols
       WHERE sample_id = $1 AND company_id = $2 AND protocol_role = 'final'`,
      [sample.id, sample.company_id],
    );
    const protocol = rows[0];
    if (!protocol || !protocol.file_path || !protocol.file_name) return null;

    const disposition = contentDisposition(protocol.file_name);
    const url = await storage.getSignedUrl(protocol.file_path, {
      contentDisposition: disposition,
      contentType: protocol.file_mime ?? 'application/octet-stream',
      expiresIn: 300,
    });
    return { url, expiresIn: 300 };
  },

  async assertNoActiveStability(sample, tx) {
    const { rows } = await tx.query(
      `SELECT id FROM stability_studies
       WHERE sample_id = $1 AND company_id = $2 AND status = 'active'
       LIMIT 1`,
      [sample.id, sample.company_id],
    );
    if (rows.length > 0) {
      throw new AppError(409, 'ACTIVE_STABILITY', 'Faol stabilizatsiya tekshiruvi mavjud namunani o‘chirib bo‘lmaydi');
    }
  },
};
