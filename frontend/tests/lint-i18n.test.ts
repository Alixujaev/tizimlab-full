import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// R-I18N-05 isboti: ESLint JSX ichidagi qattiq yozilgan matnni ushlaydi
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: repoRoot });

async function lint(relPath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, relPath) });
  return result!.messages.filter((m) => m.ruleId === 'i18next/no-literal-string');
}

const hardcoded = `export function Bad() {\n  return <div>Salom dunyo</div>;\n}\n`;
const translated = `import { useTranslation } from 'react-i18next';\nexport function Good() {\n  const { t } = useTranslation();\n  return <div className="p-4">{t('app.name')}</div>;\n}\n`;

describe('eslint i18next/no-literal-string', { timeout: 60_000 }, () => {
  it.each(['frontend/src/pages/Fixture.tsx', 'frontend/src/components/Fixture.tsx'])(
    '%s: qattiq matn — xato',
    async (file) => {
      const messages = await lint(file, hardcoded);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.severity).toBe(2);
    },
  );

  it("t() orqali matn va className — xato yo'q", async () => {
    expect(await lint('frontend/src/pages/Fixture.tsx', translated)).toHaveLength(0);
  });
});
