// Foydalanish: `npm run create-super-admin -w backend` (D-35, D-94).
// Parol faqat interaktiv, yashirin kiritiladi — argument yoki env orqali EMAS (shell tarixiga tushmasin).
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import type pg from 'pg';
import { z } from 'zod';
import { closePool, initDb, query } from '../config/database.js';
import { loadEnv } from '../config/env.js';
import { emailSchema } from '../modules/auth/auth.schemas.js';
import { assertPasswordPolicy, hashPassword } from '../modules/auth/password.js';
import { ConflictError, ValidationError } from '../utils/errors.js';

export interface SuperAdminInput {
  email: string;
  fullName: string;
  password: string;
}

const fullNameSchema = z.string().trim().min(1, 'Ism kiritilmagan').max(255);

/** Testlar va CI uchun funksiya; interaktiv qism — `main()`. Qaytaradi: yaratilgan foydalanuvchi id'si. */
export async function createSuperAdmin(
  db: pg.Pool | undefined,
  input: SuperAdminInput,
): Promise<string> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) throw new ValidationError("Email formati noto'g'ri");
  const fullName = fullNameSchema.safeParse(input.fullName);
  if (!fullName.success) throw new ValidationError(fullName.error.issues[0]?.message);
  assertPasswordPolicy(input.password);

  const passwordHash = await hashPassword(input.password);
  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, company_id)
       VALUES ($1, $2, $3, 'super_admin', NULL) RETURNING id`,
      [email.data, passwordHash, fullName.data],
      db,
    );
    return rows[0]!.id;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictError(`Bu email bilan foydalanuvchi allaqachon mavjud: ${email.data}`);
    }
    throw err;
  }
}

const NEWLINE = '\n';
const KEY_ENTER = new Set(['\r', '\n']);
const KEY_CTRL_C = '\u0003';
const KEY_BACKSPACE = new Set(['\u007f', '\b']);

export const RAW_MODE_ERROR_MESSAGE =
  "Terminalda yashirin kiritish (raw mode) qo'llab-quvvatlanmaydi. Iltimos, PowerShell yoki cmd'da ishga tushiring.";

export function assertRawModeSupported(stdin: NodeJS.ReadStream = process.stdin): void {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error(RAW_MODE_ERROR_MESSAGE);
  }
}

/** TTY'da (raw mode) belgilarni ko'rsatmasdan bir qator o'qiydi. */
export function readHiddenTty(
  prompt: string,
  stdin: NodeJS.ReadStream = process.stdin,
  stdout: NodeJS.WriteStream = process.stdout,
): Promise<string> {
  assertRawModeSupported(stdin);
  stdout.write(prompt);
  try {
    stdin.setRawMode(true);
  } catch {
    throw new Error(RAW_MODE_ERROR_MESSAGE);
  }
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.off('data', onData);
      try {
        stdin.setRawMode(false);
      } catch {
        // e'tiborsiz qoldirish
      }
      stdin.pause();
    };
    function onData(chunk: string) {
      for (const ch of chunk) {
        if (KEY_ENTER.has(ch)) {
          cleanup();
          stdout.write(NEWLINE);
          resolve(value);
          return;
        }
        if (ch === KEY_CTRL_C) {
          cleanup();
          reject(new Error('Bekor qilindi'));
          return;
        }
        if (KEY_BACKSPACE.has(ch)) value = value.slice(0, -1);
        else value += ch;
      }
    }
    stdin.on('data', onData);
  });
}

/** Interaktiv ma'lumotlarni o'qiydi. Raw mode bo'lmasa parolni ekranga chiqarmasdan to'xtaydi. */
export async function readInputs(
  stdin: NodeJS.ReadStream = process.stdin,
  stdout: NodeJS.WriteStream = process.stdout,
): Promise<SuperAdminInput & { confirm: string }> {
  assertRawModeSupported(stdin);
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string) => {
    stdout.write(prompt);
    const next = await lines.next();
    if (next.done) throw new ValidationError("Kiritish to'liq emas");
    return next.value;
  };
  try {
    const email = await ask('Email: ');
    const fullName = await ask("To'liq ism: ");
    rl.close();
    const password = await readHiddenTty('Parol: ', stdin, stdout);
    const confirm = await readHiddenTty('Parolni takrorlang: ', stdin, stdout);
    return { email, fullName, password, confirm };
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = initDb(env.DATABASE_URL);
  try {
    const { confirm, ...input } = await readInputs();
    if (input.password !== confirm) throw new ValidationError('Parollar mos emas');
    const id = await createSuperAdmin(pool, input);
    process.stdout.write(`super_admin yaratildi: ${id}${NEWLINE}`);
  } finally {
    await closePool();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    // Faqat xabar — kiritilgan qiymatlar chiqarilmaydi
    console.error(err instanceof Error ? err.message : 'Xatolik');
    process.exitCode = 1;
  });
}
