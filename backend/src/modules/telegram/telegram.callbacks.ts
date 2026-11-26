import { randomBytes } from 'node:crypto';
import { query } from '../../config/database.js';
import { roleHasPermission, type PermissionKey } from '../../config/permissions.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { Role } from '../auth/auth.types.js';
import type { NotificationDto } from '../notifications/notifications.types.js';
import { approveProtocol, rejectProtocol } from '../protocols/protocols.service.js';
import { assignSample } from '../samples/samples.service.js';

/**
 * D-171 (TZ §4): Telegram inline callback tugmalari.
 *
 * Xavfsizlik:
 * - `callback_data` = `cb:<16 belgi>` — kriptografik tasodifiy token; amal, parametrlar, egasi va kompaniyasi
 *   faqat DB da (`telegram_callback_tokens`). Token taxmin qilinmaydi va boshqa foydalanuvchiga o'tmaydi.
 * - Har bosishda qayta tekshiriladi: token egasining `telegram_chat_id` = bosgan chat, foydalanuvchi va
 *   kompaniya faol, token kompaniyasi = foydalanuvchi kompaniyasi, rol ruxsati (`permissions.ts`).
 *   Biznes qoidalari (holat mashinasi, tenant) — mavjud servis funksiyalarida (takrorlanmaydi).
 * - Idempotentlik: yakuniy amallar tokeni atomik `used_at` bilan band qilinadi; takror bosish — "allaqachon".
 *   Servis xato bersa band qilish bekor qilinadi (holat o'zgarmagan — qayta urinish xavfsiz).
 */

export type CallbackAction = 'assign_pick' | 'assign' | 'protocol_approve' | 'protocol_reject';
export type BotLang = 'uz' | 'ru' | 'en';

export const CALLBACK_TTL_MS = 72 * 60 * 60 * 1000; // 3 kun
export const PENDING_INPUT_TTL_MS = 10 * 60 * 1000; // sabab yozish uchun 10 daqiqa
const TOKEN_RE = /^cb:([A-Za-z0-9_-]{16})$/;
// Audit yozuvlarida manba ko'rinsin (IP yo'q — so'rov Telegram serveridan).
const TELEGRAM_META = { userAgent: 'telegram-bot' };

const PERMISSION: Record<CallbackAction, PermissionKey> = {
  assign_pick: 'samples:assign',
  assign: 'samples:assign',
  protocol_approve: 'protocols:approve',
  protocol_reject: 'protocols:approve',
};
/** Takror bajarilmasligi kerak bo'lgan amallar (ro'yxat ko'rsatish — qayta bosilishi mumkin). */
const SINGLE_USE: ReadonlySet<CallbackAction> = new Set([
  'assign',
  'protocol_approve',
  'protocol_reject',
]);

export interface CallbackButton {
  text: string;
  callback_data: string;
}

export interface CallbackReply {
  /** `answerCallbackQuery` matni (qisqa, ≤200 belgi). */
  answer: string;
  alert?: boolean;
  /** Chatga qo'shimcha xabar (masalan, kimyogarlar ro'yxati yoki sabab so'rash). */
  message?: { text: string; keyboard?: CallbackButton[][] };
}

const T = {
  unknown: {
    uz: '⚠️ Tugma noto‘g‘ri yoki eskirgan.',
    ru: '⚠️ Кнопка недействительна или устарела.',
    en: '⚠️ The button is invalid or outdated.',
  },
  expired: {
    uz: '⏰ Tugma muddati o‘tgan. Veb-ilovadan foydalaning.',
    ru: '⏰ Срок действия кнопки истёк. Используйте веб-приложение.',
    en: '⏰ This button has expired. Please use the web app.',
  },
  notYours: {
    uz: '⛔ Bu tugma sizning hisobingizga tegishli emas.',
    ru: '⛔ Эта кнопка не относится к вашему аккаунту.',
    en: '⛔ This button does not belong to your account.',
  },
  forbidden: {
    uz: '⛔ Bu amal uchun ruxsatingiz yo‘q.',
    ru: '⛔ У вас нет прав на это действие.',
    en: '⛔ You are not allowed to perform this action.',
  },
  done: {
    uz: 'ℹ️ Bu amal allaqachon bajarilgan.',
    ru: 'ℹ️ Это действие уже выполнено.',
    en: 'ℹ️ This action has already been completed.',
  },
  pickChemist: {
    uz: '👤 Namunani qaysi kimyogarga biriktiramiz?',
    ru: '👤 Какому химику назначить образец?',
    en: '👤 Which chemist should the sample be assigned to?',
  },
  noChemists: {
    uz: '⚠️ Kompaniyada faol kimyogar yo‘q.',
    ru: '⚠️ В компании нет активных химиков.',
    en: '⚠️ There are no active chemists in the company.',
  },
  assigned: { uz: '✅ Namuna biriktirildi', ru: '✅ Образец назначен', en: '✅ Sample assigned' },
  approved: {
    uz: '✅ Protokol tasdiqlandi',
    ru: '✅ Протокол утверждён',
    en: '✅ Protocol approved',
  },
  askReason: {
    uz: '✍️ Rad etish sababini yozib yuboring (kamida 5 belgi). Bekor qilish: /cancel',
    ru: '✍️ Напишите причину отклонения (не менее 5 символов). Отмена: /cancel',
    en: '✍️ Please type the rejection reason (at least 5 characters). Cancel: /cancel',
  },
  reasonShort: {
    uz: '⚠️ Sabab kamida 5 ta belgidan iborat bo‘lishi kerak. Qaytadan yozing yoki /cancel.',
    ru: '⚠️ Причина должна содержать не менее 5 символов. Повторите или /cancel.',
    en: '⚠️ The reason must be at least 5 characters. Try again or /cancel.',
  },
  rejected: {
    uz: '❌ Protokol rad etildi. Kimyogarga sabab bilan qaytarildi.',
    ru: '❌ Протокол отклонён. Возвращён химику с причиной.',
    en: '❌ Protocol rejected and returned to the chemist with the reason.',
  },
  cancelled: { uz: 'Bekor qilindi.', ru: 'Отменено.', en: 'Cancelled.' },
  nothingToCancel: {
    uz: 'Bekor qilinadigan amal yo‘q.',
    ru: 'Нет действия для отмены.',
    en: 'Nothing to cancel.',
  },
  error: {
    uz: '⚠️ Amal bajarilmadi. Keyinroq urinib ko‘ring yoki veb-ilovadan foydalaning.',
    ru: '⚠️ Действие не выполнено. Повторите позже или используйте веб-приложение.',
    en: '⚠️ The action failed. Try again later or use the web app.',
  },
} satisfies Record<string, Record<BotLang, string>>;

export const BUTTON_TEXT = {
  assign: { uz: '👤 Kimyogar biriktirish', ru: '👤 Назначить химика', en: '👤 Assign chemist' },
  approve: { uz: '✅ Tasdiqlash', ru: '✅ Утвердить', en: '✅ Approve' },
  reject: { uz: '❌ Rad etish', ru: '❌ Отклонить', en: '❌ Reject' },
} satisfies Record<string, Record<BotLang, string>>;

function newTokenId(): string {
  // 12 bayt → 16 belgili base64url (96 bit entropiya)
  return randomBytes(12).toString('base64url');
}

export async function createCallbackToken(input: {
  companyId: string;
  userId: string;
  action: CallbackAction;
  payload: Record<string, string>;
  ttlMs?: number;
  now?: Date;
}): Promise<string> {
  const id = newTokenId();
  const now = input.now ?? new Date();
  await query(
    `INSERT INTO telegram_callback_tokens (id, company_id, user_id, action, payload, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.companyId,
      input.userId,
      input.action,
      JSON.stringify(input.payload),
      new Date(now.getTime() + (input.ttlMs ?? CALLBACK_TTL_MS)),
    ],
  );
  return `cb:${id}`;
}

interface Recipient {
  id: string;
  role: Role;
  companyId: string;
  lang: BotLang;
}

/**
 * Xabarnoma uchun callback tugmalari — faqat qabul qiluvchining roli ruxsat bersa.
 * `protocol_submitted` havolasi namunaga (D-13) — tasdiqlanadigan `submitted` protokol shu yerda topiladi.
 */
export async function buildCallbackRows(
  dto: Pick<NotificationDto, 'type' | 'referenceId'>,
  recipient: Recipient,
): Promise<CallbackButton[][]> {
  if (!dto.referenceId) return [];
  const { id: userId, companyId, role, lang } = recipient;

  if (dto.type === 'sample_created' && roleHasPermission(role, 'samples:assign')) {
    const data = await createCallbackToken({
      companyId,
      userId,
      action: 'assign_pick',
      payload: { sampleId: dto.referenceId },
    });
    return [[{ text: BUTTON_TEXT.assign[lang], callback_data: data }]];
  }

  if (dto.type === 'protocol_submitted' && roleHasPermission(role, 'protocols:approve')) {
    const { rows } = await query<{ id: string }>(
      `SELECT p.id FROM protocols p
       WHERE p.sample_id = $1 AND p.company_id = $2 AND p.status = 'submitted'
       ORDER BY p.updated_at DESC LIMIT 1`,
      [dto.referenceId, companyId],
    );
    const protocolId = rows[0]?.id;
    if (!protocolId) return [];
    const [approve, reject] = await Promise.all([
      createCallbackToken({
        companyId,
        userId,
        action: 'protocol_approve',
        payload: { protocolId },
      }),
      createCallbackToken({
        companyId,
        userId,
        action: 'protocol_reject',
        payload: { protocolId },
      }),
    ]);
    return [
      [
        { text: BUTTON_TEXT.approve[lang], callback_data: approve },
        { text: BUTTON_TEXT.reject[lang], callback_data: reject },
      ],
    ];
  }

  return [];
}

interface TokenRow {
  id: string;
  company_id: string;
  user_id: string;
  action: CallbackAction;
  payload: Record<string, string>;
  expires_at: Date;
  used_at: Date | null;
}

interface ActorRow {
  id: string;
  role: Role;
  company_id: string | null;
  telegram_chat_id: string | null;
  telegram_language: string | null;
  is_active: boolean;
  company_active: boolean | null;
}

function langOf(v: string | null | undefined): BotLang {
  return v === 'ru' || v === 'en' ? v : 'uz';
}

/** Chat egasini tekshiradi: hisob bog'langan, faol, kompaniyasi faol va kutilgan kompaniya. */
async function loadActor(userId: string): Promise<ActorRow | null> {
  const { rows } = await query<ActorRow>(
    `SELECT u.id, u.role, u.company_id, u.telegram_chat_id::text AS telegram_chat_id, u.telegram_language,
            u.is_active, c.is_active AS company_active
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

function actorAllowed(
  actor: ActorRow | null,
  chatId: number,
  companyId: string,
): actor is ActorRow {
  return (
    !!actor &&
    actor.telegram_chat_id === String(chatId) &&
    actor.is_active &&
    actor.company_active === true &&
    actor.company_id === companyId
  );
}

/** Domen xatosini foydalanuvchiga tushunarli matnga o'giradi (servis xabarlari o'zbekcha). */
function errorText(err: unknown, lang: BotLang): string {
  if (err instanceof AppError && err.status < 500) return `⚠️ ${err.message}`.slice(0, 200);
  logger.error('Telegram callback amali xatosi', { err });
  return T.error[lang];
}

async function claim(tokenId: string): Promise<boolean> {
  const { rows } = await query(
    `UPDATE telegram_callback_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id`,
    [tokenId],
  );
  return rows.length === 1;
}

async function release(tokenId: string): Promise<void> {
  await query(`UPDATE telegram_callback_tokens SET used_at = NULL WHERE id = $1`, [tokenId]);
}

/** Langni chat bo'yicha aniqlash (token topilmasa ham javob tilida bo'lsin). */
async function chatLang(chatId: number, fallback?: string): Promise<BotLang> {
  const { rows } = await query<{ telegram_language: string | null }>(
    `SELECT telegram_language FROM users WHERE telegram_chat_id = $1`,
    [chatId],
  );
  return langOf(rows[0]?.telegram_language ?? fallback);
}

export async function handleCallback(
  chatId: number,
  data: string,
  opts: { now?: Date; languageCode?: string } = {},
): Promise<CallbackReply> {
  const now = opts.now ?? new Date();
  const match = TOKEN_RE.exec(data);
  if (!match) return { answer: T.unknown[await chatLang(chatId, opts.languageCode)], alert: true };
  const tokenId = match[1]!;

  const { rows } = await query<TokenRow>(`SELECT * FROM telegram_callback_tokens WHERE id = $1`, [
    tokenId,
  ]);
  const token = rows[0];
  if (!token) return { answer: T.unknown[await chatLang(chatId, opts.languageCode)], alert: true };

  const actor = await loadActor(token.user_id);
  const lang = langOf(actor?.telegram_language ?? opts.languageCode);
  if (!actorAllowed(actor, chatId, token.company_id))
    return { answer: T.notYours[lang], alert: true };
  if (!roleHasPermission(actor.role, PERMISSION[token.action])) {
    return { answer: T.forbidden[lang], alert: true };
  }
  if (new Date(token.expires_at) <= now) return { answer: T.expired[lang], alert: true };

  const single = SINGLE_USE.has(token.action);
  if (single && !(await claim(tokenId))) return { answer: T.done[lang], alert: true };

  const user = { id: actor.id, role: actor.role, companyId: token.company_id };
  try {
    switch (token.action) {
      case 'assign_pick': {
        const { rows: chemists } = await query<{ id: string; full_name: string }>(
          `SELECT id, full_name FROM users
           WHERE company_id = $1 AND role = 'chemist' AND is_active = true
           ORDER BY full_name LIMIT 20`,
          [token.company_id],
        );
        if (chemists.length === 0) return { answer: T.noChemists[lang], alert: true };
        const keyboard: CallbackButton[][] = [];
        for (const c of chemists) {
          const cb = await createCallbackToken({
            companyId: token.company_id,
            userId: actor.id,
            action: 'assign',
            payload: { sampleId: token.payload.sampleId!, chemistId: c.id },
            now,
          });
          keyboard.push([{ text: c.full_name.slice(0, 60), callback_data: cb }]);
        }
        return { answer: T.pickChemist[lang], message: { text: T.pickChemist[lang], keyboard } };
      }
      case 'assign': {
        const sample = await assignSample(
          token.company_id,
          actor.id,
          actor.role,
          token.payload.sampleId!,
          { chemistId: token.payload.chemistId! },
          TELEGRAM_META,
        );
        return {
          answer: T.assigned[lang],
          message: { text: `${T.assigned[lang]}: ${sample.substanceName}` },
        };
      }
      case 'protocol_approve': {
        await approveProtocol(token.company_id, user, token.payload.protocolId!, TELEGRAM_META);
        return { answer: T.approved[lang], message: { text: T.approved[lang] } };
      }
      case 'protocol_reject': {
        await query(
          `INSERT INTO telegram_pending_inputs (chat_id, company_id, user_id, action, payload, expires_at)
           VALUES ($1, $2, $3, 'protocol_reject', $4, $5)
           ON CONFLICT (chat_id) DO UPDATE
             SET company_id = EXCLUDED.company_id, user_id = EXCLUDED.user_id, action = EXCLUDED.action,
                 payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, created_at = now()`,
          [
            chatId,
            token.company_id,
            actor.id,
            JSON.stringify({ protocolId: token.payload.protocolId, tokenId }),
            new Date(now.getTime() + PENDING_INPUT_TTL_MS),
          ],
        );
        return { answer: T.askReason[lang], message: { text: T.askReason[lang] } };
      }
    }
  } catch (err) {
    if (single) await release(tokenId);
    return { answer: errorText(err, lang), alert: true };
  }
}

interface PendingRow {
  chat_id: string;
  company_id: string;
  user_id: string;
  action: 'protocol_reject';
  payload: { protocolId: string; tokenId?: string };
  expires_at: Date;
}

/**
 * Matnli xabar: kutilayotgan kiritish bo'lsa (rad etish sababi) — qayta ishlaydi va javob matnini qaytaradi;
 * aks holda `null` (bot boshqa javob bermaydi).
 */
export async function handleTextInput(
  chatId: number,
  text: string,
  opts: { now?: Date } = {},
): Promise<string | null> {
  const now = opts.now ?? new Date();
  const { rows } = await query<PendingRow>(
    `SELECT * FROM telegram_pending_inputs WHERE chat_id = $1`,
    [chatId],
  );
  const pending = rows[0];
  if (!pending) return null;
  if (new Date(pending.expires_at) <= now) {
    await query(`DELETE FROM telegram_pending_inputs WHERE chat_id = $1`, [chatId]);
    return null;
  }

  const actor = await loadActor(pending.user_id);
  const lang = langOf(actor?.telegram_language);
  if (
    !actorAllowed(actor, chatId, pending.company_id) ||
    !roleHasPermission(actor.role, 'protocols:approve')
  ) {
    await query(`DELETE FROM telegram_pending_inputs WHERE chat_id = $1`, [chatId]);
    return T.forbidden[lang];
  }

  const reason = text.trim();
  if (reason.length < 5) return T.reasonShort[lang];

  // Kiritishni atomik olib tashlaymiz — parallel ikki xabardan faqat bittasi rad etadi
  const { rows: taken } = await query(
    `DELETE FROM telegram_pending_inputs WHERE chat_id = $1 RETURNING chat_id`,
    [chatId],
  );
  if (taken.length === 0) return null;

  try {
    await rejectProtocol(
      pending.company_id,
      { id: actor.id, role: actor.role, companyId: pending.company_id },
      pending.payload.protocolId,
      { reason: reason.slice(0, 1000) },
      TELEGRAM_META,
    );
    return T.rejected[lang];
  } catch (err) {
    return errorText(err, lang);
  }
}

/** /cancel — kutilayotgan kiritishni bekor qiladi; rad etish tokeni qayta ishlatilishi uchun bo'shatiladi. */
export async function cancelPendingInput(chatId: number): Promise<string> {
  const lang = await chatLang(chatId);
  const { rows } = await query<{ payload: { tokenId?: string } }>(
    `DELETE FROM telegram_pending_inputs WHERE chat_id = $1 RETURNING payload`,
    [chatId],
  );
  if (rows.length === 0) return T.nothingToCancel[lang];
  if (rows[0]!.payload.tokenId) await release(rows[0]!.payload.tokenId);
  return T.cancelled[lang];
}
