import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import uz from '@/i18n/locales/uz.json';

// Koddagi har bir statik t('...') kaliti uchala tilda bor (standart qiymatga tayanmaydi)
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const lookup = (dict: object, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      dict,
    );

const keys = new Set<string>();
for (const file of walk(srcDir)) {
  for (const m of readFileSync(file, 'utf8').matchAll(
    /\bt\(\s*(['"])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\1/g,
  )) {
    keys.add(m[2]!);
  }
}

describe('i18n kalitlari to‘liqligi', () => {
  it('kalitlar topildi', () => {
    expect(keys.size).toBeGreaterThan(300);
  });

  it.each([
    ['uz', uz],
    ['ru', ru],
    ['en', en],
  ] as const)('%s: koddagi barcha statik kalitlar matn sifatida mavjud', (_lng, dict) => {
    const missing = [...keys].filter((k) => typeof lookup(dict, k) !== 'string');
    expect(missing).toEqual([]);
  });
});
