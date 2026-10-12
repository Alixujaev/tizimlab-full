import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { query, withTransaction } from '../../config/database.js';
import { NotFoundError, UnauthorizedError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { writeAudit } from '../audit/audit.service.js';
import { loginViaTelegram } from '../auth/auth.service.js';
import type { AuthConfig, RequestMeta } from '../auth/auth.types.js';
import type { NotificationDto } from '../notifications/notifications.types.js';
import type {
  LinkTokenDto,
  TelegramStatusDto,
  TelegramUserData,
  WebAppAuthResult,
} from './telegram.types.js';

const sha256 = (val: string): string => createHash('sha256').update(val).digest('hex');

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 daqiqa
export const INIT_DATA_MAX_AGE_SECONDS = 86400; // 24 soat

// Replay himoyasi uchun xotiradagi kesh: hash -> yaroqlilik muddati (ms)
const replayCache = new Map<string, number>();

/** Testlar uchun replay keshni tozalash */
export function clearReplayCache(): void {
  replayCache.clear();
}

/** Davriy tozalash (xotira sizib ketmasligi uchun) */
function pruneReplayCache(): void {
  const now = Date.now();
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= now) {
      replayCache.delete(key);
    }
  }
}

/**
 * 1. Bog'lash tokeni yaratish (R-TG-07, R-TG-08, D-65).
 * Xom token FAQAT foydalanuvchiga qaytariladi, bazada FAQAT SHA-256 xesh saqlanadi.
 */
export async function generateLinkToken(
  userId: string,
  companyId: string | null,
  botUsername?: string | null,
): Promise<LinkTokenDto> {
  // Tenant tekshiruvi: foydalanuvchi joriy kompaniyaga tegishli ekanligini tasdiqlash
  const userCheck = await query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2::uuid) AND is_active = true`,
    [userId, companyId],
  );
  if (!userCheck.rows[0]) {
    throw new NotFoundError('Foydalanuvchi topilmadi');
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

  await query(
    `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  const cleanUsername = botUsername?.replace(/^@/, '') ?? null;
  const linkUrl = cleanUsername ? `https://t.me/${cleanUsername}?start=${rawToken}` : null;

  return {
    token: rawToken,
    botUsername: cleanUsername,
    linkUrl,
    expiresInSeconds: Math.floor(LINK_TOKEN_TTL_MS / 1000),
  };
}

/**
 * 2. Foydalanuvchining Telegram holati (tenant izolyatsiyasi bilan).
 */
export async function getTelegramStatus(
  userId: string,
  companyId: string | null,
): Promise<TelegramStatusDto> {
  const { rows } = await query<{
    telegram_chat_id: string | null;
    telegram_username: string | null;
    telegram_linked_at: Date | null;
    telegram_language: string | null;
  }>(
    `SELECT telegram_chat_id, telegram_username, telegram_linked_at, telegram_language
     FROM users
     WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2::uuid)`,
    [userId, companyId],
  );

  const user = rows[0];
  if (!user) {
    throw new NotFoundError('Foydalanuvchi topilmadi');
  }

  return {
    linked: user.telegram_chat_id !== null,
    telegramChatId: user.telegram_chat_id ? Number(user.telegram_chat_id) : null,
    telegramUsername: user.telegram_username,
    linkedAt: user.telegram_linked_at ? user.telegram_linked_at.toISOString() : null,
    language: user.telegram_language ?? 'uz',
  };
}

/**
 * 3. Telegram bog'lanishini uzish (foydalanuvchi o'zi, tenant izolyatsiyasi bilan).
 */
export async function unlinkTelegram(
  userId: string,
  companyId: string | null,
  meta: RequestMeta = { ip: null, userAgent: null },
): Promise<{ success: true }> {
  const { rows } = await query<{ id: string; company_id: string | null; telegram_chat_id: string | null }>(
    `UPDATE users
     SET telegram_chat_id = NULL, telegram_linked_at = NULL, telegram_username = NULL
     WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2::uuid)
     RETURNING id, company_id, telegram_chat_id`,
    [userId, companyId],
  );

  const user = rows[0];
  if (!user) {
    throw new NotFoundError('Foydalanuvchi topilmadi');
  }

  await writeAudit(undefined, {
    tableName: 'users',
    recordId: userId,
    action: 'telegram_unlink',
    userId,
    companyId: user.company_id,
    newValues: { telegram_chat_id: null },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { success: true };
}

/**
 * 4. Bot `/unlink` buyrug'i orqali chat_id bo'yicha uzish.
 */
export async function unlinkByChatId(
  chatId: number,
): Promise<{ success: boolean; user?: { id: string; fullName: string } }> {
  const { rows } = await query<{ id: string; company_id: string | null; full_name: string }>(
    `UPDATE users
     SET telegram_chat_id = NULL, telegram_linked_at = NULL, telegram_username = NULL
     WHERE telegram_chat_id = $1
     RETURNING id, company_id, full_name`,
    [chatId],
  );

  const user = rows[0];
  if (!user) return { success: false };

  await writeAudit(undefined, {
    tableName: 'users',
    recordId: user.id,
    action: 'telegram_unlink',
    userId: user.id,
    companyId: user.company_id,
    newValues: { telegram_chat_id: null, source: 'telegram_bot' },
  });

  return { success: true, user: { id: user.id, fullName: user.full_name } };
}

export type LinkAccountResult =
  | { success: true; user: { id: string; fullName: string; role: string; companyName: string | null } }
  | { success: false; reason: 'INVALID_TOKEN' | 'ALREADY_USED' | 'EXPIRED' };

/**
 * 5. Bot `/start <token>` bilan bog'lash oqimi (D-65, R-TG-08, R-TG-09).
 * - sha256(rawToken) tekshiriladi
 * - bir martalik: used_at IS NULL
 * - muddati: expires_at > now()
 */
export async function linkTelegramAccount(
  rawToken: string,
  tgUser: { id: number; username?: string; language_code?: string },
): Promise<LinkAccountResult> {
  const tokenHash = sha256(rawToken);

  return withTransaction(async (client) => {
    // Token qatorini bloklaymiz
    const { rows: tokenRows } = await client.query<{
      id: string;
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, used_at
       FROM telegram_link_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash],
    );

    const tokenRow = tokenRows[0];
    if (!tokenRow) {
      return { success: false, reason: 'INVALID_TOKEN' };
    }

    if (tokenRow.used_at !== null) {
      return { success: false, reason: 'ALREADY_USED' };
    }

    if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      return { success: false, reason: 'EXPIRED' };
    }

    // Bir martalik: used_at ni hozirgi vaqtga belgilash
    await client.query(
      `UPDATE telegram_link_tokens SET used_at = now() WHERE id = $1`,
      [tokenRow.id],
    );

    // Agar bu telegram_chat_id boshqa foydalanuvchiga ulangan bo'lsa, eskisini bo'shatamiz
    await client.query(
      `UPDATE users
       SET telegram_chat_id = NULL, telegram_linked_at = NULL, telegram_username = NULL
       WHERE telegram_chat_id = $1 AND id <> $2`,
      [tgUser.id, tokenRow.user_id],
    );

    const lang = tgUser.language_code?.startsWith('ru')
      ? 'ru'
      : tgUser.language_code?.startsWith('en')
        ? 'en'
        : 'uz';

    const { rows: updatedUsers } = await client.query<{
      id: string;
      full_name: string;
      role: string;
      company_id: string | null;
      company_name: string | null;
    }>(
      `UPDATE users u
       SET telegram_chat_id = $1,
           telegram_linked_at = now(),
           telegram_username = $2,
           telegram_language = $3
       FROM companies c
       WHERE u.id = $4 AND (u.company_id = c.id OR u.company_id IS NULL)
       RETURNING u.id, u.full_name, u.role, u.company_id, c.name AS company_name`,
      [tgUser.id, tgUser.username ?? null, lang, tokenRow.user_id],
    );

    const user = updatedUsers[0];
    if (!user) {
      return { success: false, reason: 'INVALID_TOKEN' };
    }

    await writeAudit(client, {
      tableName: 'users',
      recordId: user.id,
      action: 'telegram_link',
      userId: user.id,
      companyId: user.company_id,
      newValues: {
        telegram_chat_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        language: lang,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        companyName: user.company_name,
      },
    };
  });
}

/**
 * 6. Chat ID bo'yicha foydalanuvchini olish (bot buyruqlari uchun).
 */
export async function getUserByChatId(chatId: number): Promise<{
  id: string;
  fullName: string;
  email: string;
  role: string;
  companyName: string | null;
  linkedAt: Date;
  language: string;
} | null> {
  const { rows } = await query<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    company_name: string | null;
    telegram_linked_at: Date;
    telegram_language: string | null;
  }>(
    `SELECT u.id, u.full_name, u.email, u.role, c.name AS company_name,
            u.telegram_linked_at, u.telegram_language
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.telegram_chat_id = $1 AND u.is_active = true`,
    [chatId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    companyName: row.company_name,
    linkedAt: row.telegram_linked_at,
    language: row.telegram_language ?? 'uz',
  };
}

/**
 * 7. Telegram WebApp initData HMAC tekshiruvi, auth_date va replay himoyasi (R-TG-10, R-TG-11).
 */
export function validateInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number; checkReplay?: boolean } = {},
): { telegramUser: TelegramUserData; authDate: number } {
  if (!initData || typeof initData !== 'string') {
    throw new UnauthorizedError("initData bo'sh yoki yaroqsiz");
  }
  if (!botToken) {
    throw new UnauthorizedError('Telegram bot tokeni sozlanmagan');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new UnauthorizedError("initData ichida 'hash' topilmadi");
  }

  const authDateStr = params.get('auth_date');
  if (!authDateStr) {
    throw new UnauthorizedError("initData ichida 'auth_date' topilmadi");
  }

  const authDate = Number(authDateStr);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? 86400; // 24 soat

  if (isNaN(authDate) || authDate <= 0) {
    throw new UnauthorizedError("initData ichidagi 'auth_date' noto'g'ri");
  }
  if (now - authDate > maxAge) {
    throw new UnauthorizedError("Telegram initData muddati o'tgan (auth_date eskirgan)");
  }
  if (authDate > now + 300) {
    throw new UnauthorizedError("Telegram initData vaqti noto'g'ri (kelajak)");
  }

  // Replay himoyasi
  const checkReplay = options.checkReplay ?? true;
  if (checkReplay) {
    pruneReplayCache();
    if (replayCache.has(hash)) {
      throw new UnauthorizedError(
        "Ushbu Telegram avtorizatsiya ma'lumotlari allaqachon ishlatilgan (replay himoyasi)",
      );
    }
  }

  // Telegram HMAC-SHA256 tekshiruvi:
  // 1) `hash` maydonini olib tashlaymiz
  // 2) Qolgan kalitlarni alifbo bo'yicha saralaymiz
  // 3) 'key=value' larni '\n' bilan birlashtiramiz
  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k !== 'hash') {
      pairs.push(`${k}=${v}`);
    }
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  // Secret key: HMAC-SHA256("WebAppData", botToken)
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
  const providedBuffer = Buffer.from(hash, 'hex');

  if (
    calculatedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(calculatedBuffer, providedBuffer)
  ) {
    throw new UnauthorizedError("Telegram imzo tekshiruvi muvaffaqiyatsiz (HMAC mos kelmadi)");
  }

  if (checkReplay) {
    replayCache.set(hash, Date.now() + maxAge * 1000);
  }

  const userJson = params.get('user');
  if (!userJson) {
    throw new UnauthorizedError("initData ichida 'user' ma'lumoti topilmadi");
  }

  let telegramUser: TelegramUserData;
  try {
    telegramUser = JSON.parse(userJson) as TelegramUserData;
  } catch {
    throw new UnauthorizedError("initData 'user' JSON formati noto'g'ri");
  }

  if (!telegramUser.id) {
    throw new UnauthorizedError("Telegram user id topilmadi");
  }

  return { telegramUser, authDate };
}

/**
 * DB asosidagi initData replay himoyasi (013_telegram_hardening, used_init_data jadvali).
 * Atomik INSERT ON CONFLICT DO NOTHING: parallel so'rovda faqat bittasi o'tadi.
 */
export async function consumeInitDataHash(
  hash: string,
  authDate: Date,
  expiresAt: Date,
): Promise<boolean> {
  const res = await query(
    `INSERT INTO used_init_data (hash, auth_date, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (hash) DO NOTHING
     RETURNING id`,
    [hash, authDate, expiresAt],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * 8. WebApp orqali to'liq autentifikatsiya va sessiya ochish (R-TG-10, R-TG-11, R-TG-12).
 * DB darajasidagi initData replay himoyasi bilan: parallel so'rovlarda faqat bitta tranzaksiya o'tadi.
 */
export async function authenticateWebApp(
  cfg: AuthConfig,
  initData: string,
  botToken: string,
  meta: RequestMeta = { ip: null, userAgent: null },
): Promise<WebAppAuthResult> {
  const { telegramUser, authDate } = validateInitData(initData, botToken, { checkReplay: false });
  const authDateObj = new Date(authDate * 1000);
  const expiresAtObj = new Date(authDateObj.getTime() + INIT_DATA_MAX_AGE_SECONDS * 1000);
  const dataHash = sha256(initData);

  const consumed = await consumeInitDataHash(dataHash, authDateObj, expiresAtObj);
  if (!consumed) {
    throw new UnauthorizedError(
      "Ushbu Telegram avtorizatsiya ma'lumotlari allaqachon ishlatilgan (replay himoyasi)",
    );
  }

  return loginViaTelegram(cfg, telegramUser.id, meta);
}

// ------------------ Telegram xabarnoma yuborish (R-TG-13, R-NOTIF-20, R-NOTIF-21) ------------------

const NOTIFICATION_TITLES: Record<string, Record<'uz' | 'ru' | 'en', string>> = {
  sample_assigned: {
    uz: 'Yangi namuna biriktirildi',
    ru: 'Назначен новый образец',
    en: 'New sample assigned',
  },
  sample_approved: {
    uz: 'Namuna tasdiqlandi',
    ru: 'Образец утвержден',
    en: 'Sample approved',
  },
  sample_rejected: {
    uz: 'Namuna rad etildi',
    ru: 'Образец отклонен',
    en: 'Sample rejected',
  },
  protocol_submitted: {
    uz: 'Protokol tasdiqlashga yuborildi',
    ru: 'Протокол отправлен на утверждение',
    en: 'Protocol submitted for approval',
  },
  protocol_approved: {
    uz: 'Protokol tasdiqlandi',
    ru: 'Протокол утвержден',
    en: 'Protocol approved',
  },
  protocol_rejected: {
    uz: 'Protokol rad etildi',
    ru: 'Протокол отклонен',
    en: 'Protocol rejected',
  },
  temperature_alert: {
    uz: 'Harorat/namlik ogohlantirishi',
    ru: 'Предупреждение температуры/влажности',
    en: 'Temperature/humidity alert',
  },
  low_stock: {
    uz: "Reaktiv qoldig'i kamaydi",
    ru: 'Низкий остаток реактива',
    en: 'Low reagent stock',
  },
  stability_due_soon: {
    uz: 'Stabilizatsiya muddati yaqin',
    ru: 'Срок стабильности приближается',
    en: 'Stability checkpoint due soon',
  },
  stability_overdue: {
    uz: "Stabilizatsiya muddati o'tdi",
    ru: 'Срок стабильности просрочен',
    en: 'Stability checkpoint overdue',
  },
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatTelegramNotification(dto: NotificationDto, lang: 'uz' | 'ru' | 'en'): string {
  const title = NOTIFICATION_TITLES[dto.type]?.[lang] ?? dto.title;
  return `🔔 <b>${escapeHtml(title)}</b>\n\n${escapeHtml(dto.message)}`;
}

export interface TelegramSender {
  sendMessage(chatId: number, text: string, options?: { parse_mode?: string }): Promise<unknown>;
}

let activeSender: TelegramSender | null = null;

export function setTelegramSender(sender: TelegramSender | null): void {
  activeSender = sender;
}

/**
 * P6 createNotification fire-and-forget kanali.
 * Foydalanuvchi ulanmagan bo'lsa yoki Telegram xato bersa — asosiy oqim to'xtamaydi.
 */
export async function sendTelegramNotification(
  userId: string,
  dto: NotificationDto,
  customSender?: TelegramSender | null,
  companyId?: string | null,
): Promise<boolean> {
  const sender = customSender !== undefined ? customSender : activeSender;
  if (!sender) return false;

  try {
    const { rows } = await query<{
      telegram_chat_id: string | null;
      telegram_language: string | null;
    }>(
      `SELECT telegram_chat_id, telegram_language
       FROM users
       WHERE id = $1 AND telegram_chat_id IS NOT NULL AND is_active = true
         AND ($2::uuid IS NULL OR company_id = $2)`,
      [userId, companyId ?? null],
    );

    const user = rows[0];
    if (!user || !user.telegram_chat_id) return false;

    const lang = (user.telegram_language === 'ru' || user.telegram_language === 'en'
      ? user.telegram_language
      : 'uz') as 'uz' | 'ru' | 'en';

    const text = formatTelegramNotification(dto, lang);
    await sender.sendMessage(Number(user.telegram_chat_id), text, { parse_mode: 'HTML' });
    return true;
  } catch (err) {
    logger.error('Telegramga xabarnoma yuborishda xatolik:', { err, userId, notificationId: dto.id });
    return false;
  }
}
