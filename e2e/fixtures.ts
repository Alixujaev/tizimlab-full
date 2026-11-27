import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expect,
  request,
  test as base,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { parse as parseDotenv } from 'dotenv';
import pg from 'pg';
import { SLOTS, type RoleKey, type SeedState, type SeedUser, type World } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND = `http://localhost:${process.env.E2E_BACKEND_PORT ?? '4100'}`;

let cached: SeedState | null = null;
export function seedState(): SeedState {
  cached ??= JSON.parse(readFileSync(path.join(here, '.state', 'seed.json'), 'utf8')) as SeedState;
  return cached;
}

/**
 * Joriy test slotining foydalanuvchisi (D-89: ≤3 sessiya — parallel testlar bir foydalanuvchini bo'lishmaydi).
 */
export function who(role: RoleKey): SeedUser {
  return seedState().users[role][slot()]!;
}

/** Parallel slot (0..SLOTS-1). Ko'proq worker berilsa — jim ulashish o'rniga aniq xato. */
function slot(): number {
  const i = base.info().parallelIndex;
  if (i >= SLOTS)
    throw new Error(
      `E2E: workers soni ${SLOTS} dan oshmasligi kerak (seed slotlari), parallelIndex=${i}`,
    );
  return i;
}

/** Joriy slotning A kompaniyasi "dunyosi" (xona, apparat, ND, reaktiv, stabilizatsiya). */
export function world(): World {
  return seedState().worlds[slot()]!;
}

/** Parallel testlar bir-biriga xalaqit bermasligi uchun noyob qo'shimcha. */
export const uniq = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** UI orqali kirish (haqiqiy login formasi) — keyin bosh sahifa yuklanguncha kutiladi. */
export async function login(page: Page, role: RoleKey): Promise<void> {
  const s = seedState();
  await page.goto('/login');
  await page.getByLabel('Email').fill(who(role).email);
  await page.getByLabel('Parol', { exact: true }).fill(s.password);
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export interface Api {
  ctx: APIRequestContext;
  get<T = unknown>(url: string): Promise<T>;
  post<T = unknown>(url: string, data?: unknown): Promise<T>;
  put<T = unknown>(url: string, data?: unknown): Promise<T>;
  upload<T = unknown>(
    url: string,
    file: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<T>;
  raw: (
    method: 'get' | 'post',
    url: string,
    data?: unknown,
  ) => Promise<{ status: number; body: unknown }>;
}

const apiCache = new Map<string, Promise<Api>>();

/**
 * Tayyorgarlik/tekshiruv uchun API mijozi (rol tokeni bilan). UI sinalayotgan qadamlar UI orqali bajariladi.
 * Bir test ichida rol uchun bitta sessiya qayta ishlatiladi (D-89 limitini UI login bilan birga ham oshirmaydi).
 */
export function apiAs(role: RoleKey): Promise<Api> {
  const key = `${base.info().testId}:${base.info().retry}:${role}`;
  let api = apiCache.get(key);
  if (!api) {
    api = createApi(role);
    apiCache.set(key, api);
  }
  return api;
}

async function createApi(role: RoleKey): Promise<Api> {
  const s = seedState();
  const anon = await request.newContext({ baseURL: BACKEND });
  const res = await anon.post('/api/v1/auth/login', {
    data: { email: who(role).email, password: s.password },
  });
  expect(res.status(), `login ${role}`).toBe(200);
  const token = ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
  await anon.dispose();
  const ctx = await request.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  const unwrap = async <T>(
    r: Awaited<ReturnType<APIRequestContext['get']>>,
    what: string,
  ): Promise<T> => {
    const body = r.status() === 204 ? {} : await r.json();
    expect(r.ok(), `${what} → ${r.status()} ${JSON.stringify(body)}`).toBe(true);
    return (body as { data: T }).data;
  };
  return {
    ctx,
    get: async (url) => unwrap(await ctx.get(`/api/v1${url}`), `GET ${url}`),
    post: async (url, data) =>
      unwrap(await ctx.post(`/api/v1${url}`, { data: data ?? {} }), `POST ${url}`),
    put: async (url, data) => unwrap(await ctx.put(`/api/v1${url}`, { data }), `PUT ${url}`),
    upload: async (url, file) =>
      unwrap(await ctx.post(`/api/v1${url}`, { multipart: { file } }), `UPLOAD ${url}`),
    raw: async (method, url, data) => {
      const r =
        method === 'get'
          ? await ctx.get(`/api/v1${url}`)
          : await ctx.post(`/api/v1${url}`, { data: data ?? {} });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },
  };
}

/** Matn qatlamli kichik PDF (protokol/peak fayllari uchun). */
export function pdf(text: string): Buffer {
  const lines: string[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + w.length < 60) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const esc = (x: string) => x.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 12 Tf 14 TL 50 750 Td ${lines.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((b, i) => {
    offs.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${b}\nendobj\n`;
  });
  const x = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/**
 * Rol uchun alohida brauzer konteksti (cookie/xotira ajratilgan) va kirilgan sahifa.
 * `realtime: true` — Socket.IO ulanishi tasdiqlanguncha (`40` connect paketi) kutiladi: shundan keyingi
 * xabarnoma albatta real vaqtda keladi (poyga yo'q).
 */
export async function pageAs(
  browser: Browser,
  role: RoleKey,
  opts: { realtime?: boolean } = {},
): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const connected = opts.realtime
    ? new Promise<void>((resolve) => {
        page.on('websocket', (ws) => {
          if (!ws.url().includes('/socket.io/')) return;
          ws.on('framereceived', (f) => {
            if (typeof f.payload === 'string' && f.payload.startsWith('40')) resolve();
          });
        });
      })
    : Promise.resolve();
  await login(page, role);
  await connected;
  return page;
}

/** Real vaqtli xabarnoma toasti (sahifa yangilanmasdan, Socket.IO orqali). */
export function realtimeToast(page: Page, title: string | RegExp, text: string): Locator {
  return page
    .getByRole('region', { name: /Xabarlar/ })
    .getByRole('listitem')
    .filter({ hasText: title })
    .filter({ hasText: text });
}

/**
 * Dizayn tizimi Select'i (combobox tugma + portal ichidagi listbox): yorliq bo'yicha ochiladi, variant nomi bilan tanlanadi.
 * `scope` — modal yoki sahifa; variantlar portalda bo'lgani uchun sahifa darajasida qidiriladi.
 */
export async function pick(
  scope: Page | Locator,
  label: string | RegExp,
  option: string | RegExp,
): Promise<void> {
  const page = 'page' in scope ? scope.page() : scope;
  await scope.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

/** FileButton/yashirin input: tugma bosilganda ochiladigan fayl tanlash oynasiga fayl beriladi. */
export async function chooseFile(
  trigger: Locator,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const chooser = trigger.page().waitForEvent('filechooser');
  await trigger.click();
  await (await chooser).setFiles(file);
}

export const pdfFile = (name: string, text: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: pdf(text),
});

/** ISO (YYYY-MM-DD) → UI kiritish formati (KK.OO.YYYY). */
export const uzDate = (iso: string) => iso.split('-').reverse().join('.');

/** DatePicker: matn kiritiladi va fokus chiqqanda qabul qilinadi. */
export async function typeDate(input: Locator, iso: string): Promise<void> {
  await input.fill(uzDate(iso));
  await input.press('Tab');
}

/** Bildirishnoma qo'ng'irog'ini ochib, `text` li elementni kutadi; `click` bo'lsa unga o'tadi, aks holda yopadi. */
export async function expectNotification(
  page: Page,
  title: string | RegExp,
  text: string,
  opts: { click?: boolean } = {},
): Promise<void> {
  await page.getByRole('button', { name: 'Bildirishnomalar' }).click();
  const item = page
    .getByRole('list', { name: 'Bildirishnomalar' })
    .getByRole('listitem')
    .filter({ hasText: title })
    .filter({ hasText: text });
  await expect(item.first()).toBeVisible();
  if (opts.click) await item.first().click();
  else await page.keyboard.press('Escape');
}

/** Toshkent bo'yicha sana (YYYY-MM-DD), `offset` kun bilan. */
export const tashkentDay = (offset = 0) =>
  new Date(Date.now() + 5 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------
// Tayyorgarlik (API orqali) — sinalayotgan qadamdan OLDINGI holatni tez yaratish uchun.

export interface PreparedSample {
  sampleId: string;
  protocolId: string;
  name: string;
}

/**
 * Namuna: kontrolyor yaratadi → lab_head kimyogarga biriktiradi → (ixtiyoriy) kimyogar asosiy fayl yuklaydi.
 * `until` — qaysi bosqichgacha olib borish.
 */
export async function prepareSample(opts: {
  prefix: string;
  /** Aniq modda nomi (masalan RAG manbasi bilan bir xil modda); bo'lmasa `prefix` dan noyob nom. */
  name?: string;
  type?: string;
  chemist?: RoleKey;
  until: 'assigned' | 'uploaded' | 'submitted' | 'approved';
  fileText?: string;
  submit?: Record<string, unknown>;
}): Promise<PreparedSample> {
  const name = opts.name ?? uniq(opts.prefix);
  const kontrolyor = await apiAs('kontrolyor');
  const sample = await kontrolyor.post<{ id: string }>('/samples', {
    type: opts.type ?? 'raw_material',
    substanceName: name,
    serialNumber: `SER-${name}`,
    lotNumber: `LOT-${name}`,
  });
  const labHead = await apiAs('labHead');
  const chemistKey = opts.chemist ?? 'chemist';
  await labHead.post(`/samples/${sample.id}/assign`, { chemistId: who(chemistKey).id });
  const protocols = await labHead.get<Array<{ id: string }>>(`/protocols/sample/${sample.id}`);
  const protocolId = protocols[0]!.id;
  const chemist = await apiAs(chemistKey);
  if (opts.until !== 'assigned') {
    await chemist.upload(
      `/protocols/${protocolId}/file`,
      pdfFile(`${name}.pdf`, opts.fileText ?? `${name} tahlil hisoboti`),
    );
  }
  if (opts.until === 'submitted' || opts.until === 'approved') {
    await chemist.post(`/protocols/${protocolId}/submit`, opts.submit ?? {});
  }
  if (opts.until === 'approved') await labHead.post(`/protocols/${protocolId}/approve`);
  return { sampleId: sample.id, protocolId, name };
}

// ---------------------------------------------------------------------------------------------
// Faqat o'qish uchun DB kirishi (e2e sxema) — fon jarayonlari (RAG indeksi) tugaganini kutish uchun.

let pool: pg.Pool | null = null;
function db(): pg.Pool {
  if (!pool) {
    const envFile = path.join(here, '..', 'backend', '.env');
    const local = existsSync(envFile) ? parseDotenv(readFileSync(envFile)) : {};
    const url = process.env.E2E_DATABASE_URL || local.E2E_DATABASE_URL;
    pool = new pg.Pool({ connectionString: url, options: '-c search_path=e2e,public', max: 2 });
  }
  return pool;
}

/** RAG worker (15 s interval) manbani indekslaguncha kutadi — chunk paydo bo'lishi bo'yicha (sleep emas, poll). */
export async function waitForIndexed(sourceId: string): Promise<void> {
  await expect
    .poll(
      async () =>
        Number(
          (
            await db().query<{ n: string }>(
              `SELECT count(*)::text AS n FROM doc_chunks WHERE source_id = $1`,
              [sourceId],
            )
          ).rows[0]!.n,
        ),
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBeGreaterThan(0);
}

export type RoleKeyExport = RoleKey;
export const test = base;
export { expect };
