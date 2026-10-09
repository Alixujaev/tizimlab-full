import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type express from 'express';
import type { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import {
  closeSocketServer,
  createSocketServer,
  NOTIFICATION_EVENT,
} from '../src/realtime/socket.js';
import { TEST_AUTH_CONFIG, testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('Socket.IO: JWT handshake, user:<id> xonalari, real vaqtli push (P6, spec §9)', () => {
  let db: Db;
  let app: express.Express;
  let http: HttpServer;
  let io: Server;
  let url: string;
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  const open: Socket[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    http = createServer(app);
    io = createSocketServer(http, { auth: TEST_AUTH_CONFIG });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;

    const a = await createCompany();
    const b = await createCompany();
    const specs: [string, TestUser['role'], typeof a | null][] = [
      ['kontrolyor', 'kontrolyor', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['chemistB', 'chemist', b],
      ['superAdmin', 'super_admin', null],
    ];
    for (const [name, role, company] of specs) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
  });

  afterEach(() => {
    for (const s of open.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await closeSocketServer(io);
    await db.teardown();
  });

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  function client(token?: string): Socket {
    const s = connect(url, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    open.push(s);
    return s;
  }

  /** Ulanish natijasi: `'connected'` yoki handshake xato kodi. */
  function outcome(s: Socket): Promise<string> {
    return new Promise((resolve) => {
      s.once('connect', () => resolve('connected'));
      s.once('connect_error', (err) => resolve(err.message));
    });
  }

  async function connected(who: string): Promise<{ socket: Socket; received: NotificationDto[] }> {
    const socket = client(tokens[who]);
    const received: NotificationDto[] = [];
    socket.on(NOTIFICATION_EVENT, (n: NotificationDto) => received.push(n));
    expect(await outcome(socket)).toBe('connected');
    return { socket, received };
  }

  describe('handshake (R-NOTIF-19, R-AUTH-15)', () => {
    it('tokensiz va yaroqsiz token bilan ulanish rad etiladi', async () => {
      expect(await outcome(client())).toBe('UNAUTHORIZED');
      expect(await outcome(client('not-a-jwt'))).toBe('UNAUTHORIZED');
    });

    it('super_admin (kompaniyasiz) ulana olmaydi', async () => {
      expect(await outcome(client(tokens.superAdmin))).toBe('COMPANY_REQUIRED');
    });

    it('logout qilingan sessiya tokeni bilan ulanish rad etiladi (REST bilan bir xil sessiya tekshiruvi)', async () => {
      const u = await createUser({
        role: 'chemist',
        company: { id: users.chemist1!.companyId!, name: '', slug: '' },
      });
      const { accessToken } = await loginAs(app, u);
      expect(await outcome(client(accessToken))).toBe('connected');
      await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`);
      expect(await outcome(client(accessToken))).not.toBe('connected');
    });
  });

  describe('push faqat qabul qiluvchining user:<id> xonasiga (R-NOTIF-14, R-NOTIF-15, R-NOTIF-16, R-ARCH-16)', () => {
    it('biriktirilgan kimyogar notification:new oladi; shu kompaniyaning boshqa kimyogari va boshqa kompaniya olmaydi', async () => {
      const c1 = await connected('chemist1');
      const c2 = await connected('chemist2');
      const cb = await connected('chemistB');
      const lh = await connected('labHead');

      const sample = await request(app)
        .post('/api/v1/samples')
        .set(auth('kontrolyor'))
        .send({ type: 'raw_material', substanceName: 'Ibuprofen', lotNumber: 'L-9' });
      const sampleId = sample.body.data.id as string;
      const assigned = new Promise<void>((resolve) =>
        c1.socket.once(NOTIFICATION_EVENT, () => resolve()),
      );
      const res = await request(app)
        .post(`/api/v1/samples/${sampleId}/assign`)
        .set(auth('labHead'))
        .send({ chemistId: users.chemist1!.id });
      expect(res.status).toBe(200);
      await assigned;
      // Boshqalarga kechikib kelishi mumkin bo'lgan hodisani kutish
      await new Promise((r) => setTimeout(r, 150));

      expect(c1.received).toHaveLength(1);
      expect(c1.received[0]).toMatchObject({
        type: 'sample_assigned',
        referenceId: sampleId,
        isRead: false,
        message: 'Ibuprofen',
      });
      expect(c2.received).toEqual([]);
      expect(cb.received).toEqual([]);
      // Harakat egasi (lab_head) ham olmaydi
      expect(lh.received).toEqual([]);
    });
  });
});
