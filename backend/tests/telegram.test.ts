import { createHash, createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/database.js';
import { createNotification, setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import {
  clearReplayCache,
  generateLinkToken,
  getTelegramStatus,
  linkTelegramAccount,
  sendTelegramNotification,
  unlinkByChatId,
  unlinkTelegram,
} from '../src/modules/telegram/telegram.service.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

const BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz01234567';
const BOT_USERNAME = 'tizimlab_bot';

const sha256 = (str: string) => createHash('sha256').update(str).digest('hex');

function makeInitData(
  botToken: string,
  user: { id: number; first_name?: string; username?: string },
  authDate: number = Math.floor(Date.now() / 1000),
  tamperHash?: boolean,
): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', JSON.stringify(user));

  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  let hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (tamperHash) {
    hash = hash.replace(/^./, hash[0] === 'a' ? 'b' : 'a');
  }

  params.set('hash', hash);
  return params.toString();
}

describeDb('P11 — Telegram integratsiyasi va bot (TEST_DATABASE_URL)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await setupAuthDb();
  });

  afterAll(async () => {
    await db.teardown();
  });

  beforeEach(() => {
    clearReplayCache();
  });

  describe('1. Bog\'lash tokeni yaratish va xesh saqlanishi (R-TG-07, R-TG-08, D-65)', () => {
    it('link-token yaratiladi, bazada FAQAT sha256 xesh saqlanadi, xom token bazada yo\'q', async () => {
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });

      const linkData = await generateLinkToken(user.id, company.id, BOT_USERNAME);

      expect(linkData.token).toBeDefined();
      expect(linkData.token).toHaveLength(64); // 32 bytes hex
      expect(linkData.botUsername).toBe(BOT_USERNAME);
      expect(linkData.linkUrl).toBe(`https://t.me/${BOT_USERNAME}?start=${linkData.token}`);
      expect(linkData.expiresInSeconds).toBe(900);

      // Bazani tekshiramiz: telegram_link_tokens jadvalida token_hash qidiriladi
      const expectedHash = sha256(linkData.token);
      const { rows } = await query<{ token_hash: string }>(
        `SELECT token_hash FROM telegram_link_tokens WHERE user_id = $1`,
        [user.id],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.token_hash).toBe(expectedHash);
      // Xom token bazada ochiq saqlanmasligi shart (D-65)!
      expect(rows[0]?.token_hash).not.toBe(linkData.token);

      // Bazada xom token bormi deb to'liq matnli tekshiruv
      const rawMatch = await query(
        `SELECT id FROM telegram_link_tokens WHERE token_hash = $1`,
        [linkData.token],
      );
      expect(rawMatch.rows).toHaveLength(0);
    });

    it('API: POST /telegram/link-token autentifikatsiyalangan foydalanuvchiga token qaytaradi', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });
      const auth = await loginAs(app, user);

      const res = await request(app)
        .post('/api/v1/telegram/link-token')
        .set('Authorization', `Bearer ${auth.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.linkUrl).toContain(BOT_USERNAME);
      expect(res.body.data.expiresInSeconds).toBe(900);
    });

    it('API: ruxsatsiz so\'rov 401 qaytaradi', async () => {
      const { app } = testApp();
      const res = await request(app).post('/api/v1/telegram/link-token');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Bot /start bilan bog\'lash oqimi va bir martalik token (R-TG-08, R-TG-09, D-65)', () => {
    it('yaroqli token bilan bog\'lanadi, audit_log yoziladi, ikkinchi marta ALREADY_USED bo\'ladi', async () => {
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });
      const linkData = await generateLinkToken(user.id, company.id, BOT_USERNAME);

      // 1-marta ulash
      const tgChatId = 777001;
      const res1 = await linkTelegramAccount(linkData.token, {
        id: tgChatId,
        username: 'chemist_tg',
        language_code: 'uz',
      });

      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.user.id).toBe(user.id);
        expect(res1.user.fullName).toBe(user.fullName);
      }

      // users jadvali yangilanganini tekshirish
      const { rows: userRows } = await query<{
        telegram_chat_id: string;
        telegram_username: string;
        telegram_linked_at: Date;
      }>(`SELECT telegram_chat_id, telegram_username, telegram_linked_at FROM users WHERE id = $1`, [
        user.id,
      ]);
      expect(Number(userRows[0]?.telegram_chat_id)).toBe(tgChatId);
      expect(userRows[0]?.telegram_username).toBe('chemist_tg');
      expect(userRows[0]?.telegram_linked_at).not.toBeNull();

      // Audit log yozilganini tekshirish
      const audit = await query(
        `SELECT * FROM audit_log WHERE table_name = 'users' AND record_id = $1 AND action = 'telegram_link'`,
        [user.id],
      );
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);

      // 2-marta o'sha tokenni ishlatish -> bir martalik tekshiruvi: ALREADY_USED
      const res2 = await linkTelegramAccount(linkData.token, {
        id: tgChatId,
        username: 'chemist_tg',
      });
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.reason).toBe('ALREADY_USED');
      }
    });

    it('noto\'g\'ri token -> INVALID_TOKEN', async () => {
      const res = await linkTelegramAccount('invalid_hex_token_1234567890abcdef', {
        id: 999111,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.reason).toBe('INVALID_TOKEN');
      }
    });

    it('muddati o\'tgan token -> EXPIRED', async () => {
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });
      const rawToken = 'expired_token_test_0123456789abcdef0123456789abcdef';
      const tokenHash = sha256(rawToken);

      // 1 soat oldin muddati o'tgan token qo'shamiz
      await query(
        `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() - interval '1 hour')`,
        [user.id, tokenHash],
      );

      const res = await linkTelegramAccount(rawToken, { id: 888222 });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.reason).toBe('EXPIRED');
      }
    });
  });

  describe('3. Telegram holati va uzish (unlink) — tenant izolyatsiyasi bilan (R-USER-13, R-USER-14)', () => {
    it('GET /telegram/status va POST /telegram/unlink muvaffaqiyatli ishlaydi', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });
      const auth = await loginAs(app, user);

      // Dastlab ulanmagan
      const res1 = await request(app)
        .get('/api/v1/telegram/status')
        .set('Authorization', `Bearer ${auth.accessToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.data.linked).toBe(false);

      // Ulash
      const linkData = await generateLinkToken(user.id, company.id, BOT_USERNAME);
      await linkTelegramAccount(linkData.token, { id: 555333, username: 'test_link' });

      // Endi ulangan
      const res2 = await request(app)
        .get('/api/v1/telegram/status')
        .set('Authorization', `Bearer ${auth.accessToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.linked).toBe(true);
      expect(res2.body.data.telegramChatId).toBe(555333);
      expect(res2.body.data.telegramUsername).toBe('test_link');

      // Uzish (unlink)
      const res3 = await request(app)
        .post('/api/v1/telegram/unlink')
        .set('Authorization', `Bearer ${auth.accessToken}`);
      expect(res3.status).toBe(200);
      expect(res3.body.data.success).toBe(true);

      // Holat qayta ulanmagan bo'ladi
      const res4 = await request(app)
        .get('/api/v1/telegram/status')
        .set('Authorization', `Bearer ${auth.accessToken}`);
      expect(res4.status).toBe(200);
      expect(res4.body.data.linked).toBe(false);

      // Audit log yozilgan
      const audit = await query(
        `SELECT * FROM audit_log WHERE table_name = 'users' AND record_id = $1 AND action = 'telegram_unlink'`,
        [user.id],
      );
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('tenant izolyatsiyasi: unlink boshqa kompaniya foydalanuvchisiga ta\'sir qila olmaydi', async () => {
      const companyA = await createCompany({ name: 'Kompaniya A' });
      const companyB = await createCompany({ name: 'Kompaniya B' });

      await createUser({ role: 'chemist', company: companyA, email: 'usera@lims.uz' });
      const userB = await createUser({ role: 'chemist', company: companyB, email: 'userb@lims.uz' });

      // userB ni ulaymiz
      const tokenB = await generateLinkToken(userB.id, companyB.id);
      await linkTelegramAccount(tokenB.token, { id: 444111 });

      // userA ning kompaniyasi ostida userB ni uzishga urinish xato (NotFoundError)
      await expect(unlinkTelegram(userB.id, companyA.id)).rejects.toThrow();

      // userB ning holati saqlanib qolgan
      const statusB = await getTelegramStatus(userB.id, companyB.id);
      expect(statusB.linked).toBe(true);
      expect(statusB.telegramChatId).toBe(444111);
    });

    it('bot /unlink buyrug\'i chat_id bo\'yicha akkauntni uzadi', async () => {
      const company = await createCompany();
      const user = await createUser({ role: 'lab_head', company });
      const token = await generateLinkToken(user.id, company.id);
      await linkTelegramAccount(token.token, { id: 333222 });

      const res = await unlinkByChatId(333222);
      expect(res.success).toBe(true);

      const status = await getTelegramStatus(user.id, company.id);
      expect(status.linked).toBe(false);
    });
  });

  describe('4. WebApp autentifikatsiya — HMAC, auth_date va replay himoyasi (R-TG-10, R-TG-11, R-TG-12)', () => {
    it('to\'g\'ri HMAC va ulangan akkaunt bilan muvaffaqiyatli kiradi, JWT va sessiya qaytadi', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });
      const token = await generateLinkToken(user.id, company.id);
      const tgChatId = 12345678;
      await linkTelegramAccount(token.token, { id: tgChatId, username: 'webapp_user' });

      const initData = makeInitData(BOT_TOKEN, { id: tgChatId, username: 'webapp_user' });

      const res = await request(app)
        .post('/api/v1/telegram/webapp-auth')
        .send({ initData });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.id).toBe(user.id);
      expect(res.body.data.user.email).toBe(user.email);
      // Refresh cookie o'rnatilgan
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(String(cookies)).toContain('refresh_token=');

      // Audit log tekshiruvi: login_telegram yozilgan
      const audit = await query(
        `SELECT * FROM audit_log WHERE user_id = $1 AND action = 'login_telegram'`,
        [user.id],
      );
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('noto\'g\'ri HMAC imzo rad etiladi (401)', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const tgChatId = 12345679;
      // Buzilgan imzo
      const invalidInitData = makeInitData(
        BOT_TOKEN,
        { id: tgChatId, username: 'bad_hmac' },
        Math.floor(Date.now() / 1000),
        true, // tamperHash
      );

      const res = await request(app)
        .post('/api/v1/telegram/webapp-auth')
        .send({ initData: invalidInitData });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('HMAC');
    });

    it('eskirgan auth_date rad etiladi (401)', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const tgChatId = 12345680;
      // 2 kun oldingi sana
      const oldTimestamp = Math.floor(Date.now() / 1000) - 2 * 86400;
      const expiredInitData = makeInitData(BOT_TOKEN, { id: tgChatId }, oldTimestamp);

      const res = await request(app)
        .post('/api/v1/telegram/webapp-auth')
        .send({ initData: expiredInitData });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('eskirgan');
    });

    it('replay himoyasi: ayni bir initData takror ishlatilganda rad etiladi (401)', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const company = await createCompany();
      const user = await createUser({ role: 'chemist', company });
      const token = await generateLinkToken(user.id, company.id);
      const tgChatId = 12345681;
      await linkTelegramAccount(token.token, { id: tgChatId });

      const initData = makeInitData(BOT_TOKEN, { id: tgChatId });

      // 1-marta muvaffaqiyat
      const res1 = await request(app)
        .post('/api/v1/telegram/webapp-auth')
        .send({ initData });
      expect(res1.status).toBe(200);

      // 2-marta xuddi shu initData bilan so'rov -> replay himoyasi (401)
      const res2 = await request(app)
        .post('/api/v1/telegram/webapp-auth')
        .send({ initData });
      expect(res2.status).toBe(401);
      expect(res2.body.error.code).toBe('UNAUTHORIZED');
      expect(res2.body.error.message).toContain('replay');
    });

    it('ulanmagan Telegram akkaunti bilan kirish rad etiladi (401)', async () => {
      const { app } = testApp({
        env: { TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_BOT_USERNAME: BOT_USERNAME },
      });
      const unlinkedChatId = 99999999;
      const initData = makeInitData(BOT_TOKEN, { id: unlinkedChatId });

      const res = await request(app)
        .post('/api/v1/telegram/webapp-auth')
        .send({ initData });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('ulanmagan');
    });
  });

  describe('5. P6 Xabarnomalarini Telegramga yuborish (R-TG-13, R-NOTIF-20, R-NOTIF-21)', () => {
    it('ulangan foydalanuvchiga xabar yuboriladi, formatlash tilga mos', async () => {
      const company = await createCompany();
      const chemist = await createUser({ role: 'chemist', company });
      const link = await generateLinkToken(chemist.id, company.id);
      const tgChatId = 777333;
      await linkTelegramAccount(link.token, { id: tgChatId, language_code: 'uz' });

      const mockSendMessage = vi.fn().mockResolvedValue(true);
      const mockSender = { sendMessage: mockSendMessage };

      const dto = {
        id: 'notif-1',
        type: 'sample_assigned' as const,
        title: 'Yangi namuna',
        message: 'Aspirin lot-123 biriktirildi',
        referenceId: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      await sendTelegramNotification(chemist.id, dto, mockSender);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        tgChatId,
        expect.stringContaining('Yangi namuna biriktirildi'),
        { parse_mode: 'HTML' },
      );
    });

    it('ulanmagan foydalanuvchiga Telegram xabar yuborilmaydi', async () => {
      const company = await createCompany();
      const chemist = await createUser({ role: 'chemist', company });
      const mockSendMessage = vi.fn().mockResolvedValue(true);

      const dto = {
        id: 'notif-2',
        type: 'sample_assigned' as const,
        title: 'Yangi namuna',
        message: 'Paratsetamol',
        referenceId: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      await sendTelegramNotification(chemist.id, dto, { sendMessage: mockSendMessage });
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('Telegram yuborishdagi tarmoq xatosi asosiy oqimni buzmaydi (fire-and-forget)', async () => {
      const company = await createCompany();
      const chemist = await createUser({ role: 'chemist', company });
      const link = await generateLinkToken(chemist.id, company.id);
      await linkTelegramAccount(link.token, { id: 888777 });

      const faultySender = {
        sendMessage: vi.fn().mockRejectedValue(new Error('Telegram 500 Network Timeout')),
      };

      const dto = {
        id: 'notif-3',
        type: 'protocol_approved' as const,
        title: 'Protokol tasdiqlandi',
        message: 'PR-100',
        referenceId: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // Xato tashlanmasligi kerak!
      await expect(
        sendTelegramNotification(chemist.id, dto, faultySender),
      ).resolves.toBeUndefined();
    });

    it('createNotification P6 oqimida Telegram kanali chaqiriladi', async () => {
      const company = await createCompany();
      const head = await createUser({ role: 'lab_head', company });
      const chemist = await createUser({ role: 'chemist', company });
      const link = await generateLinkToken(chemist.id, company.id);
      await linkTelegramAccount(link.token, { id: 666555 });

      const channelFn = vi.fn();
      setNotificationChannel('test_tg', channelFn);

      try {
        await createNotification(db.pool, {
          companyId: company.id,
          type: 'sample_assigned',
          title: 'Namuna biriktirildi',
          message: 'Tahlil uchun namuna',
          actorId: head.id,
          context: { assignedTo: chemist.id },
        });

        expect(channelFn).toHaveBeenCalledWith(
          chemist.id,
          expect.objectContaining({ type: 'sample_assigned' }),
        );
      } finally {
        setNotificationChannel('test_tg', null);
      }
    });
  });

  describe('6. Webhook himoyasi (R-TG-15, R-TG-16)', () => {
    it('noto\'g\'ri secret 401 qaytaradi, to\'g\'ri secret 200 qaytaradi', async () => {
      const { app } = testApp({
        env: {
          TELEGRAM_BOT_TOKEN: BOT_TOKEN,
          TELEGRAM_WEBHOOK_URL: 'https://api.tizimlab.uz/api/v1/telegram/webhook',
          TELEGRAM_WEBHOOK_SECRET: 'super-secret-token-1234567890abcdef',
        },
      });

      // Secret'siz yoki noto'g'ri secret
      const resBad = await request(app)
        .post('/api/v1/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'wrong-secret')
        .send({ update_id: 100 });
      expect(resBad.status).toBe(401);

      // To'g'ri secret
      const resGood = await request(app)
        .post('/api/v1/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', 'super-secret-token-1234567890abcdef')
        .send({ update_id: 100 });
      expect(resGood.status).toBe(200);
    });
  });
});
