import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

/** Imzolangan URL amal qilish muddati — 5 daqiqa (D-61, Q-53). */
export const SIGNED_URL_TTL_SECONDS = 300;

export interface SignedUrlOptions {
  /** Tayyor `Content-Disposition` qiymati (asl nom tozalangan, `contentDisposition()` dan). */
  contentDisposition: string;
  contentType: string;
  expiresIn: number;
}

/**
 * Ob'ekt xotirasi adapteri (spec §12). Ishlab chiqarishda R2, testlarda — xotiradagi implementatsiya
 * (`tests/helpers/memoryStorage.ts`); testlar hech qachon haqiqiy R2 ga ulanmaydi.
 */
export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  getSignedUrl(key: string, opts: SignedUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
}

/** R2 sozlanmagan (development) — fayl endpointlari 503 qaytaradi (D-121). Sir qiymatlari xabarga tushmaydi. */
export class StorageUnavailableError extends AppError {
  constructor() {
    super(
      503,
      'STORAGE_UNAVAILABLE',
      'Fayl xotirasi (R2) sozlanmagan: R2_* muhit o‘zgaruvchilarini to‘ldiring',
    );
  }
}

export function requireStorage(storage: FileStorage | null | undefined): FileStorage {
  if (!storage) throw new StorageUnavailableError();
  return storage;
}

export type R2Env = Pick<
  Env,
  'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY' | 'R2_BUCKET' | 'R2_ENDPOINT'
>;

export function createR2Storage(
  env: Required<{ [K in keyof R2Env]: NonNullable<R2Env[K]> }>,
): FileStorage {
  const client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  const Bucket = env.R2_BUCKET;
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async getSignedUrl(key, opts) {
      const cmd = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentDisposition: opts.contentDisposition,
        ResponseContentType: opts.contentType,
      });
      return presign(client, cmd, { expiresIn: opts.expiresIn });
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
  };
}

/** Barcha R2_* berilgan bo'lsa R2 adapteri, aks holda `null` (production'da env.ts buni oldindan majburlaydi). */
export function storageFromEnv(env: R2Env): FileStorage | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_ENDPOINT) {
    return null;
  }
  return createR2Storage({
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_ENDPOINT,
  });
}
