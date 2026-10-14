import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// D-153/D-158 isboti: UI faqat tokenlar va @/ui komponentlaridan — tasodifiy stil va native element 0
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const files = walk(srcDir).map((file) => ({
  rel: path.relative(srcDir, file).split(path.sep).join('/'),
  code: readFileSync(file, 'utf8'),
}));
const sourceFiles = files.filter((f) => !f.rel.endsWith('.css'));
const outsideUi = sourceFiles.filter((f) => !f.rel.startsWith('ui/'));

const PALETTE =
  /\b(?:bg|text|border|ring|divide|from|to|via|fill|stroke|outline|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;
const ARBITRARY_HEX = /-\[#[0-9a-fA-F]{3,8}\]/;
const ARBITRARY_PX = /-\[-?\d+(?:\.\d+)?px\]/;
const NATIVE_ELEMENT = /<(select|button|input|textarea|table)[\s>/]/;
const BROWSER_DIALOG = /\b(?:window\.)?(alert|confirm|prompt)\(/;

const offenders = (list: typeof files, re: RegExp) =>
  list.filter((f) => re.test(f.code)).map((f) => f.rel);

describe('UI tizimi qoidalari (statik tekshiruv)', () => {
  it("Tailwind standart palitrasi klasslari yo'q (faqat semantik tokenlar)", () => {
    expect(offenders(sourceFiles, PALETTE)).toEqual([]);
  });

  it("arbitrary hex rang va px qiymatlar yo'q", () => {
    expect(offenders(sourceFiles, ARBITRARY_HEX)).toEqual([]);
    expect(offenders(sourceFiles, ARBITRARY_PX)).toEqual([]);
  });

  it('hex ranglar faqat tokens.css da', () => {
    const hex = /#[0-9a-fA-F]{6}\b/;
    expect(offenders(files, hex).filter((f) => f !== 'styles/tokens.css')).toEqual([]);
  });

  it('src/ui dan tashqarida native element va brauzer dialoglari 0 ta', () => {
    expect(offenders(outsideUi, NATIVE_ELEMENT)).toEqual([]);
    expect(offenders(outsideUi, BROWSER_DIALOG)).toEqual([]);
  });
});
