// Build qadami: SQL migratsiyalarni dist'ga ko'chiradi (tsc .sql fayllarni ko'chirmaydi). Cross-platform.
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'src', 'db', 'migrations');
const to = path.join(root, 'dist', 'db', 'migrations');

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
if (existsSync(from)) {
  await cp(from, to, { recursive: true, filter: (src) => !src.endsWith('.gitkeep') });
}
console.log(`migratsiyalar ko'chirildi: ${path.relative(root, to)}`);
