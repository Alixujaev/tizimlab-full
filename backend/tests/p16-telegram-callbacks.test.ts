/* eslint-disable @typescript-eslint/no-explicit-any */
import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/database.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import { createTelegramBot } from '../src/modules/telegram/telegram.bot.js';
import {
  buildCallbackRows,
  cancelPendingInput,
  createCallbackToken,
  handleCallback,
  handleTextInput,
} from '../src/modules/telegram/telegram.callbacks.js';
import {
  getNotificationActionUrl,
  sendTelegramNotification,
  type TelegramSender,
} from '../src/modules/telegram/telegram.service.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

/** P16 / TZ §4 — Telegram callback tugmalari (D-171, R-P16-13..18). */

describe('deep link: reaktiv xabarnomalari reaktiv sahifasiga (R-P16-18)', () => {
  const dto = (type: string, referenceId: string | null): NotificationDto =>
    ({ id: 'n', type, title: 't', message: 'm', referenceId, isRead: false, createdAt: '' }) as any;

  it('reagent_* va low_stock → /reagents/:id, startapp=reagent_<id>; sample_created → /samples/:id', () => {
    for (const type of ['reagent_expiring', 'reagent_pending_approval', 'low_stock']) {
      expect(getNotificationActionUrl(dto(type, 'r1'), 'https://lab.example.uz')).toEqual({
        path: '/reagents/r1',
        url: 'https://lab.example.uz/reagents/r1?startapp=reagent_r1',
        startapp: 'reagent_r1',
      });
    }
    expect(getNotificationActionUrl(dto('sample_created', 's1'), 'https://x.uz')?.path).toBe(
      '/samples/s1',
    );
    expect(getNotificationActionUrl(dto('reagent_expiring', null), 'https://x.uz')?.path).toBe(
      '/reagents',
    );
  });
});

describeDb('Telegram callback tugmalari', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const storage = new MemoryStorage();
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  const chat: Record<string, number> = {
    labHead: 7001,
    labHead2: 7002,
    chemist1: 7003,
    director: 7004,
    labHeadB: 7101,
  };

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    const a = await createCompany({ name: 'TG Alpha' });
    const b = await createCompany({ name: 'TG Beta' });
    for (const [name, role, company] of [
      ['kontrolyor', 'kontrolyor', a],
      ['labHead', 'lab_head', a],
      ['labHead2', 'lab_head', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['chemistOff', 'chemist', a],
      ['director', 'director', a],
      ['labHeadB', 'lab_head', b],
      ['chemistB', 'chemist', b],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
    await query(`UPDATE users SET is_active = false WHERE id = $1`, [users.chemistOff!.id]);
    for (const [name, chatId] of Object.entries(chat)) {
      await query(
        `UPDATE users SET telegram_chat_id = $1, telegram_language = 'uz' WHERE id = $2`,
        [chatId, users[name]!.id],
      );
    }
  });
  afterAll(() => db.teardown());

  beforeEach(async () => {
    storage.reset();
    await query('DELETE FROM telegram_pending_inputs');
    await query('DELETE FROM telegram_callback_tokens');
  });

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function newSample(): Promise<string> {
    const res = await request(app)
      .post('/api/v1/samples')
      .set(auth('kontrolyor'))
      .send({ type: 'raw_material', substanceName: 'Ibuprofen', lotNumber: 'L-TG' });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function submitted(): Promise<{ sampleId: string; protocolId: string }> {
    const sampleId = await newSample();
    await request(app)
      .post(`/api/v1/samples/${sampleId}/assign`)
      .set(auth('labHead'))
      .send({ chemistId: users.chemist1!.id })
      .expect(200);
    const list = await request(app)
      .get(`/api/v1/protocols/sample/${sampleId}`)
      .set(auth('chemist1'));
    const protocolId = list.body.data[0].id as string;
    await request(app)
      .post(`/api/v1/protocols/${protocolId}/file`)
      .set(auth('chemist1'))
      .attach('file', fixtures.pdf(), 'main.pdf')
      .expect(200);
    await request(app)
      .post(`/api/v1/protocols/${protocolId}/submit`)
      .set(auth('chemist1'))
      .expect(200);
    return { sampleId, protocolId };
  }

  const status = async (table: 'samples' | 'protocols', id: string) =>
    (await query<{ status: string }>(`SELECT status::text FROM ${table} WHERE id = $1`, [id]))
      .rows[0]!.status;

  function capture(): {
    sender: TelegramSender;
    sent: { chatId: number; text: string; opts: any }[];
  } {
    const sent: { chatId: number; text: string; opts: any }[] = [];
    return {
      sent,
      sender: {
        sendMessage: async (chatId, text, opts) => {
          sent.push({ chatId, text, opts });
        },
      },
    };
  }

  const dtoFor = (type: string, referenceId: string): NotificationDto =>
    ({
      id: 'n1',
      type,
      title: 't',
      message: 'Ibuprofen',
      referenceId,
      isRead: false,
      createdAt: '',
    }) as any;

  it('R-P16-13: sample_created xabarida lab_head uchun imzolangan qisqa callback tugmasi; callback_data da ID yo‘q', async () => {
    const sampleId = await newSample();
    const { sender, sent } = capture();
    const ok = await sendTelegramNotification(
      users.labHead!.id,
      dtoFor('sample_created', sampleId),
      sender,
      users.labHead!.companyId,
      'https://lab.example.uz',
    );
    expect(ok).toBe(true);
    const kb = sent[0]!.opts.reply_markup.inline_keyboard as any[][];
    expect(kb[0]![0]).toMatchObject({
      web_app: { url: `https://lab.example.uz/samples/${sampleId}?startapp=sample_${sampleId}` },
    });
    const data = kb[1]![0].callback_data as string;
    expect(data).toMatch(/^cb:[A-Za-z0-9_-]{16}$/);
    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    expect(data).not.toContain(sampleId.slice(0, 8));
    expect(kb[1]![0].text).toBe('👤 Kimyogar biriktirish');
  });

  it('R-P16-13: ruxsati yo‘q rolga (chemist, director) callback tugmalari qo‘shilmaydi', async () => {
    const sampleId = await newSample();
    for (const who of ['chemist1', 'director'] as const) {
      const rows = await buildCallbackRows(
        { type: 'sample_created', referenceId: sampleId },
        {
          id: users[who]!.id,
          role: users[who]!.role,
          companyId: users[who]!.companyId!,
          lang: 'uz',
        },
      );
      expect(rows).toEqual([]);
    }
    const { protocolId } = await submitted();
    void protocolId;
    const rows = await buildCallbackRows(
      { type: 'protocol_submitted', referenceId: (await submitted()).sampleId },
      {
        id: users.director!.id,
        role: 'director',
        companyId: users.director!.companyId!,
        lang: 'uz',
      },
    );
    expect(rows).toEqual([]);
  });

  it('R-P16-14: biriktirish oqimi — kimyogarlar ro‘yxati (faqat faol, o‘z kompaniyasi) → tanlash → namuna in_progress', async () => {
    const sampleId = await newSample();
    const [[btn] = []] = await buildCallbackRows(
      { type: 'sample_created', referenceId: sampleId },
      { id: users.labHead!.id, role: 'lab_head', companyId: users.labHead!.companyId!, lang: 'uz' },
    );
    const pick = await handleCallback(chat.labHead!, btn!.callback_data);
    // Har tugma ortidagi kimyogar — token payload'idan (callback_data da ID yo'q)
    const buttons = await Promise.all(
      pick.message!.keyboard!.map(async (r) => {
        const { rows } = await query<{ payload: { chemistId: string } }>(
          `SELECT payload FROM telegram_callback_tokens WHERE id = $1`,
          [r[0]!.callback_data.slice(3)],
        );
        return { btn: r[0]!, chemistId: rows[0]!.payload.chemistId };
      }),
    );
    expect(buttons.map((b) => b.chemistId).sort()).toEqual(
      [users.chemist1!.id, users.chemist2!.id].sort(),
    );

    const chemistBtn = buttons.find((b) => b.chemistId === users.chemist1!.id)!.btn;
    const res = await handleCallback(chat.labHead!, chemistBtn.callback_data);
    expect(res.answer).toBe('✅ Namuna biriktirildi');
    const row = await query<{ status: string; assigned_to: string; assigned_by: string }>(
      `SELECT status::text, assigned_to, assigned_by FROM samples WHERE id = $1`,
      [sampleId],
    );
    expect(row.rows[0]).toEqual({
      status: 'in_progress',
      assigned_to: users.chemist1!.id,
      assigned_by: users.labHead!.id,
    });

    // Audit manbasi — telegram-bot
    const audit = await query<{ user_agent: string }>(
      `SELECT user_agent FROM audit_log WHERE table_name = 'samples' AND record_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [sampleId, users.labHead!.id],
    );
    expect(audit.rows[0]?.user_agent).toBe('telegram-bot');

    // R-P16-16: takroriy bosish idempotent
    const again = await handleCallback(chat.labHead!, chemistBtn.callback_data);
    expect(again.answer).toBe('ℹ️ Bu amal allaqachon bajarilgan.');
    // "Ro'yxatni ko'rsatish" tugmasi qayta bosilishi mumkin
    expect(
      (await handleCallback(chat.labHead!, btn!.callback_data)).message?.keyboard?.length,
    ).toBe(2);
  });

  it('R-P16-15: protokolni tasdiqlash; parallel ikki bosishdan faqat bittasi bajariladi', async () => {
    const { sampleId, protocolId } = await submitted();
    const [[approve] = []] = await buildCallbackRows(
      { type: 'protocol_submitted', referenceId: sampleId },
      { id: users.labHead!.id, role: 'lab_head', companyId: users.labHead!.companyId!, lang: 'uz' },
    );
    expect(approve!.text).toBe('✅ Tasdiqlash');
    const results = await Promise.all([
      handleCallback(chat.labHead!, approve!.callback_data),
      handleCallback(chat.labHead!, approve!.callback_data),
    ]);
    expect(results.map((r) => r.answer).sort()).toEqual(
      ['✅ Protokol tasdiqlandi', 'ℹ️ Bu amal allaqachon bajarilgan.'].sort(),
    );
    expect(await status('protocols', protocolId)).toBe('approved');
    const sigs = await query(
      `SELECT 1 FROM protocol_signatures WHERE protocol_id = $1 AND action = 'approved'`,
      [protocolId],
    );
    expect(sigs.rows).toHaveLength(1);
  });

  it('R-P16-15: rad etish — sabab keyingi xabardan; qisqa sabab rad, to‘g‘risi protokolni sabab bilan rad etadi', async () => {
    const { sampleId, protocolId } = await submitted();
    const [[, reject] = []] = await buildCallbackRows(
      { type: 'protocol_submitted', referenceId: sampleId },
      { id: users.labHead!.id, role: 'lab_head', companyId: users.labHead!.companyId!, lang: 'uz' },
    );
    const ask = await handleCallback(chat.labHead!, reject!.callback_data);
    expect(ask.message?.text).toContain('Rad etish sababini');

    expect(await handleTextInput(chat.labHead!, 'yoq')).toContain('kamida 5');
    expect(await status('protocols', protocolId)).toBe('submitted');
    // Boshqa chat matni bu kiritishga ta'sir qilmaydi
    expect(await handleTextInput(chat.labHead2!, 'Peaklar mos emas')).toBeNull();

    expect(await handleTextInput(chat.labHead!, 'Peaklar standartga mos emas')).toContain(
      'rad etildi',
    );
    const p = await query<{ status: string; rejection_reason: string }>(
      `SELECT status::text, rejection_reason FROM protocols WHERE id = $1`,
      [protocolId],
    );
    expect(p.rows[0]).toEqual({
      status: 'rejected',
      rejection_reason: 'Peaklar standartga mos emas',
    });
    // Kiritish tugadi — keyingi matn e'tiborsiz
    expect(await handleTextInput(chat.labHead!, 'yana bir matn')).toBeNull();
  });

  it('R-P16-15: /cancel kutilayotgan rad etishni bekor qiladi va tugmani qayta ishlatish mumkin', async () => {
    const { sampleId, protocolId } = await submitted();
    const [[, reject] = []] = await buildCallbackRows(
      { type: 'protocol_submitted', referenceId: sampleId },
      { id: users.labHead!.id, role: 'lab_head', companyId: users.labHead!.companyId!, lang: 'uz' },
    );
    await handleCallback(chat.labHead!, reject!.callback_data);
    expect(await cancelPendingInput(chat.labHead!)).toBe('Bekor qilindi.');
    expect(await handleTextInput(chat.labHead!, 'Sabab yetarli uzun')).toBeNull();
    expect(await status('protocols', protocolId)).toBe('submitted');
    expect((await handleCallback(chat.labHead!, reject!.callback_data)).message?.text).toContain(
      'Rad etish sababini',
    );
    expect(await cancelPendingInput(chat.labHead!)).toBe('Bekor qilindi.');
    expect(await cancelPendingInput(chat.labHead!)).toBe('Bekor qilinadigan amal yo‘q.');
  });

  it('R-P16-16: domen xatosi tushunarli matn bilan; token bo‘shatiladi (holat o‘zgarmagan)', async () => {
    const { sampleId, protocolId } = await submitted();
    const [[approve] = []] = await buildCallbackRows(
      { type: 'protocol_submitted', referenceId: sampleId },
      { id: users.labHead!.id, role: 'lab_head', companyId: users.labHead!.companyId!, lang: 'uz' },
    );
    // Veb orqali boshqa lab_head allaqachon tasdiqladi
    await request(app)
      .post(`/api/v1/protocols/${protocolId}/approve`)
      .set(auth('labHead2'))
      .expect(200);
    const res = await handleCallback(chat.labHead!, approve!.callback_data);
    expect(res.alert).toBe(true);
    expect(res.answer.startsWith('⚠️ ')).toBe(true);
    const tok = await query<{ used_at: Date | null }>(
      `SELECT used_at FROM telegram_callback_tokens WHERE id = $1`,
      [approve!.callback_data.slice(3)],
    );
    expect(tok.rows[0]!.used_at).toBeNull();
  });

  describe('R-P16-17: xavfsizlik — chat bog‘lanishi, rol, tenant, muddat', () => {
    async function assignPickToken(): Promise<{ data: string; sampleId: string }> {
      const sampleId = await newSample();
      const data = await createCallbackToken({
        companyId: users.labHead!.companyId!,
        userId: users.labHead!.id,
        action: 'assign_pick',
        payload: { sampleId },
      });
      return { data, sampleId };
    }

    it('boshqa chat (o‘sha kompaniyaning boshqa lab_head) tokenni ishlata olmaydi', async () => {
      const { data } = await assignPickToken();
      const res = await handleCallback(chat.labHead2!, data);
      expect(res).toMatchObject({
        answer: '⛔ Bu tugma sizning hisobingizga tegishli emas.',
        alert: true,
      });
      expect(res.message).toBeUndefined();
    });

    it('boshqa kompaniya chatidan — rad, namuna o‘zgarmaydi', async () => {
      const sampleId = await newSample();
      const data = await createCallbackToken({
        companyId: users.labHead!.companyId!,
        userId: users.labHead!.id,
        action: 'assign',
        payload: { sampleId, chemistId: users.chemistB!.id },
      });
      expect((await handleCallback(chat.labHeadB!, data)).answer).toContain('tegishli emas');
      expect(await status('samples', sampleId)).toBe('pending_assignment');
    });

    it('token kompaniyasi foydalanuvchi kompaniyasiga mos kelmasa — rad', async () => {
      const { data } = await assignPickToken();
      await query(`UPDATE telegram_callback_tokens SET company_id = $1 WHERE id = $2`, [
        users.labHeadB!.companyId,
        data.slice(3),
      ]);
      expect((await handleCallback(chat.labHead!, data)).answer).toContain('tegishli emas');
    });

    it('kimyogar B kompaniyasidan bo‘lsa servis rad etadi (404) — tenant servisda ham', async () => {
      const sampleId = await newSample();
      const data = await createCallbackToken({
        companyId: users.labHead!.companyId!,
        userId: users.labHead!.id,
        action: 'assign',
        payload: { sampleId, chemistId: users.chemistB!.id },
      });
      const res = await handleCallback(chat.labHead!, data);
      expect(res.answer).toBe('⚠️ Kimyogar topilmadi');
      expect(await status('samples', sampleId)).toBe('pending_assignment');
    });

    it('rol o‘zgarsa (lab_head → chemist) eski tugma ishlamaydi', async () => {
      const { data } = await assignPickToken();
      await query(`UPDATE users SET role = 'chemist' WHERE id = $1`, [users.labHead!.id]);
      try {
        expect((await handleCallback(chat.labHead!, data)).answer).toBe(
          '⛔ Bu amal uchun ruxsatingiz yo‘q.',
        );
      } finally {
        await query(`UPDATE users SET role = 'lab_head' WHERE id = $1`, [users.labHead!.id]);
      }
    });

    it('nofaol foydalanuvchi yoki uzilgan Telegram — rad', async () => {
      const { data } = await assignPickToken();
      await query(`UPDATE users SET telegram_chat_id = NULL WHERE id = $1`, [users.labHead!.id]);
      try {
        expect((await handleCallback(chat.labHead!, data)).answer).toContain('tegishli emas');
      } finally {
        await query(`UPDATE users SET telegram_chat_id = $1 WHERE id = $2`, [
          chat.labHead,
          users.labHead!.id,
        ]);
      }
    });

    it('muddati o‘tgan token va noto‘g‘ri/soxta callback_data', async () => {
      const { data } = await assignPickToken();
      const later = new Date(Date.now() + 73 * 3600_000);
      expect((await handleCallback(chat.labHead!, data, { now: later })).answer).toContain(
        'muddati o‘tgan',
      );
      for (const bad of [
        'cb:short',
        'xx:AAAAAAAAAAAAAAAA',
        'cb:AAAAAAAAAAAAAAAA',
        `cb:${'A'.repeat(17)}`,
      ]) {
        expect((await handleCallback(chat.labHead!, bad)).answer).toBe(
          '⚠️ Tugma noto‘g‘ri yoki eskirgan.',
        );
      }
    });

    it('ruxsatsiz rolga atayin yaratilgan token ham ishlamaydi (director tasdiqlay olmaydi)', async () => {
      const { protocolId } = await submitted();
      const data = await createCallbackToken({
        companyId: users.director!.companyId!,
        userId: users.director!.id,
        action: 'protocol_approve',
        payload: { protocolId },
      });
      expect((await handleCallback(chat.director!, data)).answer).toBe(
        '⛔ Bu amal uchun ruxsatingiz yo‘q.',
      );
      expect(await status('protocols', protocolId)).toBe('submitted');
    });
  });

  it('bot integratsiyasi: callback_query → answerCallbackQuery va kimyogarlar ro‘yxati xabari', async () => {
    const sampleId = await newSample();
    const data = await createCallbackToken({
      companyId: users.labHead!.companyId!,
      userId: users.labHead!.id,
      action: 'assign_pick',
      payload: { sampleId },
    });
    const bot = createTelegramBot('123456789:ABCdefGHIjklMNOpqrsTUVwxyz01234567');
    (bot as any).botInfo = { id: 1, is_bot: true, first_name: 'B', username: 'b_bot' };
    const calls: { method: string; payload: any }[] = [];
    bot.api.config.use((_prev, method, payload) => {
      calls.push({ method, payload });
      return Promise.resolve({ ok: true, result: true as any });
    });
    await bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'q1',
        chat_instance: 'ci',
        from: { id: chat.labHead!, is_bot: false, first_name: 'L', language_code: 'uz' },
        message: {
          message_id: 5,
          date: 0,
          chat: { id: chat.labHead!, type: 'private', first_name: 'L' },
        },
        data,
      },
    } as any);
    const answer = calls.find((c) => c.method === 'answerCallbackQuery');
    expect(answer?.payload).toMatchObject({
      callback_query_id: 'q1',
      text: expect.stringContaining('kimyogarga'),
    });
    const msg = calls.find((c) => c.method === 'sendMessage');
    expect(msg?.payload.reply_markup.inline_keyboard.length).toBe(2);

    // Oddiy matn — kutilayotgan kiritish yo'q bo'lsa bot jim
    calls.length = 0;
    await bot.handleUpdate({
      update_id: 2,
      message: {
        message_id: 6,
        date: 0,
        chat: { id: chat.labHead!, type: 'private', first_name: 'L' },
        from: { id: chat.labHead!, is_bot: false, first_name: 'L' },
        text: 'salom',
      },
    } as any);
    expect(calls.filter((c) => c.method === 'sendMessage')).toHaveLength(0);
    void vi;
  });
});
