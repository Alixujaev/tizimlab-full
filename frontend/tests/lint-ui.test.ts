import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// D-158 isboti: sahifa/komponentlarda native element va brauzer dialoglari lint xatosi, src/ui ichida ruxsat
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: repoRoot });
const RULES = new Set(['no-restricted-syntax', 'no-restricted-globals']);

async function lint(relPath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, relPath) });
  return result!.messages.filter((m) => RULES.has(m.ruleId ?? ''));
}

const nativeElements = `export function Bad() {
  return (
    <form>
      <select />
      <button type="button" />
      <input />
      <textarea />
      <table />
    </form>
  );
}
`;

const dialogs = `export function bad() {
  window.alert('x');
  if (confirm('y')) prompt('z');
}
`;

const allowed = `import { Button, Select } from '@/ui';
export function Good() {
  return <Button>OK</Button>;
}
export const S = Select;
`;

describe('eslint: native UI elementlari taqiqi (D-158)', { timeout: 60_000 }, () => {
  it.each(['frontend/src/pages/Fixture.tsx', 'frontend/src/components/Fixture.tsx'])(
    '%s: select/button/input/textarea/table — har biri xato',
    async (file) => {
      const messages = await lint(file, nativeElements);
      expect(messages).toHaveLength(5);
      expect(messages.every((m) => m.severity === 2)).toBe(true);
    },
  );

  it('alert/confirm/prompt — xato', async () => {
    const messages = await lint('frontend/src/pages/Fixture.tsx', dialogs);
    expect(messages).toHaveLength(3);
  });

  it("src/ui ichida native element ruxsat (komponentlar o'zi quradi)", async () => {
    expect(await lint('frontend/src/ui/atoms/Fixture/Fixture.tsx', nativeElements)).toHaveLength(0);
  });

  it("@/ui komponentlari — xato yo'q", async () => {
    expect(await lint('frontend/src/pages/Fixture.tsx', allowed)).toHaveLength(0);
  });
});
