/**
 * P18 AI smoke-test — QO'LDA ishga tushiriladi, CI ga KIRMAYDI (haqiqiy Claude API, pul sarflanadi).
 *
 *   npm run ai:smoke -- --file ./label.jpg [--kind sample|reagent|nd]
 *
 * Kalit va model `backend/.env` dan (ANTHROPIC_API_KEY, AI_MODEL) yoki muhitdan o'qiladi; hech qayerga
 * saqlanmaydi va chiqarilmaydi. Natija: xom javob sxemadan o'tdimi, normallashtirilgan forma maydonlari, tokenlar.
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { createAnthropicAiClient, AiUpstreamError } from '../backend/src/modules/ai/ai.client.js';
import { AI_MAX_PDF_PAGES, assertAiFile } from '../backend/src/modules/ai/ai.files.js';
import {
  DOCUMENT_INSTRUCTION,
  DOCUMENT_SYSTEM_PROMPT,
  ND_INSTRUCTION,
  ND_SYSTEM_PROMPT,
} from '../backend/src/modules/ai/ai.prompts.js';
import {
  DOCUMENT_JSON_SCHEMA,
  documentResultSchema,
  ND_JSON_SCHEMA,
  ndResultSchema,
} from '../backend/src/modules/ai/ai.schemas.js';
import { mapDocumentFields } from '../backend/src/modules/ai/ai.service.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  loadDotenv({ path: resolve(process.cwd(), 'backend/.env'), quiet: true });
  const filePath = arg('file');
  const kind = (arg('kind') ?? 'sample') as 'sample' | 'reagent' | 'nd';
  if (!filePath || !['sample', 'reagent', 'nd'].includes(kind)) {
    console.log('Qo‘llanishi: npm run ai:smoke -- --file <rasm|pdf> [--kind sample|reagent|nd]');
    process.exit(2);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model) {
    console.error('ANTHROPIC_API_KEY va AI_MODEL kerak (backend/.env yoki muhit).');
    process.exit(2);
  }

  const buffer = readFileSync(resolve(process.cwd(), filePath));
  const file = assertAiFile(
    { originalname: basename(filePath), buffer, size: buffer.length },
    30 * 1024 * 1024,
    kind === 'nd' ? AI_MAX_PDF_PAGES.nd : AI_MAX_PDF_PAGES.document,
  );
  const client = createAnthropicAiClient({ apiKey, model });
  const started = Date.now();
  try {
    const res = await client.extract({
      system: kind === 'nd' ? ND_SYSTEM_PROMPT : DOCUMENT_SYSTEM_PROMPT,
      instruction: kind === 'nd' ? ND_INSTRUCTION : DOCUMENT_INSTRUCTION,
      file: { mediaType: file.mime, data: file.buffer },
      jsonSchema: kind === 'nd' ? ND_JSON_SCHEMA : DOCUMENT_JSON_SCHEMA,
    });
    console.log(
      `Model: ${res.model}; tokenlar: kirish ${res.inputTokens}, chiqish ${res.outputTokens}; ${Date.now() - started} ms`,
    );
    if (kind === 'nd') {
      const parsed = ndResultSchema.safeParse(res.json);
      console.log(parsed.success ? 'Sxema: OK' : 'Sxema: MOS EMAS');
      console.log(JSON.stringify(parsed.success ? parsed.data : res.json, null, 2));
      return;
    }
    const parsed = documentResultSchema.safeParse(res.json);
    if (!parsed.success) {
      console.log('Sxema: MOS EMAS (servisda status=failed bo‘ladi)');
      console.log(JSON.stringify(res.json, null, 2));
      return;
    }
    console.log(`Sxema: OK; rasm sifati: ${parsed.data.image_quality}`);
    console.table(
      Object.entries(mapDocumentFields(kind, parsed.data)).map(([field, v]) => ({
        field,
        value: v.value,
        confidence: v.confidence,
      })),
    );
  } catch (err) {
    if (err instanceof AiUpstreamError) {
      console.error(`AI xatosi: ${err.code}${err.httpStatus ? ` (HTTP ${err.httpStatus})` : ''}`);
      process.exit(1);
    }
    throw err;
  }
}

void main();
