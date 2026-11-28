/**
 * AI smoke-test (D-201) — QO'LDA ishga tushiriladi, CI ga KIRMAYDI (haqiqiy API, pul sarflanadi).
 *
 *   npm run ai:smoke -- --dir <papka> --kind sample|reagent|nd [--provider openai|gemini|anthropic] [--model <id>]
 *   npm run ai:smoke -- --dir <papka> --kind sample --compare openai,gemini
 *   Qo'shimcha: --out <fayl.md> (standart: ai-smoke-report.md), --price-in/--price-out (USD / 1M token)
 *
 * Papkadagi har rasm/PDF (jpg, png, webp, pdf) yuboriladi; `expected.json` bo'lsa maydon bo'yicha aniqlik:
 *   sample/reagent: { "label.jpg": { "name": "Ibuprofen", "series": "B-1", "expiry_date": "2028-04-30" } }
 *     (qiymat — servis normallashtirgan forma qiymati; null — "topilmasligi kerak")
 *   nd:             { "nd.pdf": { "requirements_count": "3", "equipment": "HPLC", "reagents": "Acetonitrile; Water" } }
 * Kalitlar `backend/.env` yoki muhitdan (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY) — hech qayerga
 * yozilmaydi. Konsolga FAQAT o'lchovlar chiqadi (hujjat mazmuni emas); maydon qiymatlari faqat lokal hisobot
 * faylida (`ai-smoke-report.md`, .gitignore da).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { createProvider, DEFAULT_MODELS } from '../backend/src/modules/ai/ai.config.js';
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
  type DocumentResult,
  type NdResult,
} from '../backend/src/modules/ai/ai.schemas.js';
import { callModel, mapDocumentFields } from '../backend/src/modules/ai/ai.service.js';

type Kind = 'sample' | 'reagent' | 'nd';
type RealProvider = 'openai' | 'gemini' | 'anthropic';
const PROVIDERS: RealProvider[] = ['openai', 'gemini', 'anthropic'];
const KEY_ENV: Record<RealProvider, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/** Taxminiy narx (USD / 1M token, standart tarif; rasmiy narxlar sahifasi 2026-11). Noma'lum model — "—". */
const PRICES: Record<string, { in: number; out: number }> = {
  'gpt-6-luna': { in: 0.1, out: 0.5 },
  'gpt-5.6-luna': { in: 0.2, out: 1.2 },
  'gemini-3.1-flash-lite': { in: 0.25, out: 1.5 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5 },
};

const FILE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.log(
    'Qo‘llanishi: npm run ai:smoke -- --dir <papka> --kind sample|reagent|nd ' +
      '[--provider openai|gemini|anthropic] [--model <id>] [--compare openai,gemini] [--out <md>]',
  );
  process.exit(2);
}

const norm = (v: unknown) =>
  v === null || v === undefined ? null : String(v).trim().replace(/\s+/g, ' ').toLowerCase();

interface FileRun {
  file: string;
  provider: RealProvider;
  model: string;
  status: string;
  errorCode: string | null;
  ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  fields: Record<string, string | null>;
  matched: number;
  total: number;
}

function ndFields(r: NdResult): Record<string, string | null> {
  const join = (xs: (string | null)[]) =>
    xs
      .filter((x): x is string => !!x)
      .sort((a, b) => a.localeCompare(b))
      .join('; ') || null;
  return {
    image_quality: r.image_quality,
    requirements_count: String(r.requirements.length),
    equipment: join(
      r.requirements.filter((q) => q.kind === 'equipment').map((q) => q.equipment_category),
    ),
    reagents: join(r.requirements.filter((q) => q.kind === 'reagent').map((q) => q.reagent_name)),
  };
}

function docFields(kind: 'sample' | 'reagent', r: DocumentResult): Record<string, string | null> {
  const out: Record<string, string | null> = { image_quality: r.image_quality };
  for (const [k, v] of Object.entries(mapDocumentFields(kind, r))) {
    out[k] = v.value === null ? null : String(v.value);
    out[`${k}.confidence`] = v.confidence;
  }
  return out;
}

function costOf(
  model: string,
  inTok: number | null,
  outTok: number | null,
  override?: { in: number; out: number },
) {
  const p =
    override ?? PRICES[model] ?? PRICES[Object.keys(PRICES).find((m) => model.startsWith(m)) ?? ''];
  if (!p || inTok === null || outTok === null) return null;
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

const money = (v: number | null) => (v === null ? '—' : `$${v.toFixed(5)}`);
const cell = (v: unknown) =>
  v === null || v === undefined ? '∅' : String(v).replace(/\|/g, '\\|');

async function main(): Promise<void> {
  loadDotenv({ path: resolve(process.cwd(), 'backend/.env'), quiet: true });
  const dir = arg('dir');
  const kind = (arg('kind') ?? 'sample') as Kind;
  if (!dir || !['sample', 'reagent', 'nd'].includes(kind)) usage();
  const compare = arg('compare');
  const providers = (
    compare ? compare.split(',') : [arg('provider') ?? process.env.AI_PROVIDER ?? 'openai']
  ).map((p) => p.trim()) as RealProvider[];
  for (const p of providers) if (!PROVIDERS.includes(p)) usage(`Noma'lum provayder: ${p}`);
  const priceIn = Number(arg('price-in'));
  const priceOut = Number(arg('price-out'));
  const priceOverride =
    Number.isFinite(priceIn) && Number.isFinite(priceOut) && arg('price-in')
      ? { in: priceIn, out: priceOut }
      : undefined;

  const root = resolve(process.cwd(), dir);
  const files = readdirSync(root)
    .filter((f) => FILE_EXT.has(extname(f).toLowerCase()))
    .sort();
  if (!files.length) usage(`Papkada rasm/PDF yo'q: ${dir}`);
  const expectedPath = join(root, 'expected.json');
  const expected: Record<string, Record<string, unknown>> = existsSync(expectedPath)
    ? (JSON.parse(readFileSync(expectedPath, 'utf8')) as Record<string, Record<string, unknown>>)
    : {};

  const clients = providers.map((name) => {
    const apiKey = process.env[KEY_ENV[name]];
    if (!apiKey) usage(`${KEY_ENV[name]} kerak (backend/.env yoki muhit)`);
    // AI_MODEL faqat bitta provayder rejimida yoki u AI_PROVIDER ga mos bo'lsa qo'llanadi
    const model =
      (!compare ? arg('model') : undefined) ??
      (process.env.AI_PROVIDER === name || (!compare && !process.env.AI_PROVIDER)
        ? process.env.AI_MODEL
        : undefined) ??
      DEFAULT_MODELS[name];
    if (!model) usage(`${name}: model kerak (--model yoki AI_MODEL)`);
    return createProvider(name, { apiKey, model });
  });

  const runs: FileRun[] = [];
  for (const file of files) {
    const buffer = readFileSync(join(root, file));
    let validated;
    try {
      validated = assertAiFile(
        { originalname: file, buffer, size: buffer.length },
        30 * 1024 * 1024,
        kind === 'nd' ? AI_MAX_PDF_PAGES.nd : AI_MAX_PDF_PAGES.document,
      );
    } catch (err) {
      console.log(
        `${file}: o'tkazib yuborildi (${(err as { code?: string }).code ?? 'fayl xatosi'})`,
      );
      continue;
    }
    for (const client of clients) {
      const started = Date.now();
      const outcome =
        kind === 'nd'
          ? await callModel(
              client,
              validated,
              { system: ND_SYSTEM_PROMPT, instruction: ND_INSTRUCTION, jsonSchema: ND_JSON_SCHEMA },
              ndResultSchema,
            )
          : await callModel(
              client,
              validated,
              {
                system: DOCUMENT_SYSTEM_PROMPT,
                instruction: DOCUMENT_INSTRUCTION,
                jsonSchema: DOCUMENT_JSON_SCHEMA,
              },
              documentResultSchema,
            );
      const ms = Date.now() - started;
      const fields = !outcome.data
        ? {}
        : kind === 'nd'
          ? ndFields(outcome.data as NdResult)
          : docFields(kind, outcome.data as DocumentResult);
      const exp = expected[file] ?? {};
      const keys = Object.keys(exp);
      const matched =
        outcome.status !== 'ok' ? 0 : keys.filter((k) => norm(exp[k]) === norm(fields[k])).length;
      const run: FileRun = {
        file,
        provider: client.name as RealProvider,
        model: outcome.model,
        status: outcome.status,
        errorCode: outcome.errorCode,
        ms,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        cost: costOf(outcome.model, outcome.inputTokens, outcome.outputTokens, priceOverride),
        fields,
        matched,
        total: keys.length,
      };
      runs.push(run);
      // Konsol — faqat o'lchovlar (hujjat mazmuni yo'q)
      console.log(
        `[${run.provider}] ${file}: ${run.status}${run.errorCode ? ` (${run.errorCode})` : ''}, ${ms} ms, ` +
          `tokenlar ${run.inputTokens ?? '—'}/${run.outputTokens ?? '—'}, ${money(run.cost)}` +
          (run.total ? `, aniqlik ${matched}/${run.total}` : ''),
      );
    }
  }

  const out = resolve(process.cwd(), arg('out') ?? 'ai-smoke-report.md');
  writeFileSync(out, report(kind, providers, runs, expected), 'utf8');
  console.log(`Hisobot: ${out}`);
}

function report(
  kind: Kind,
  providers: RealProvider[],
  runs: FileRun[],
  expected: Record<string, Record<string, unknown>>,
): string {
  const lines: string[] = [
    `# AI smoke hisobot — ${new Date().toISOString()}`,
    '',
    `Tur: \`${kind}\`; provayderlar: ${providers.join(', ')}; fayllar: ${new Set(runs.map((r) => r.file)).size}.`,
    '',
    '> Lokal fayl — hujjat qiymatlari bor, commit qilinmaydi va ulashilmaydi.',
    '',
    '## Umumiy',
    '',
    '| Provayder | Model | OK / jami | Aniqlik | O‘rtacha vaqt | Tokenlar (kirish/chiqish) | Taxminiy narx |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const p of providers) {
    const rs = runs.filter((r) => r.provider === p);
    if (!rs.length) continue;
    const ok = rs.filter((r) => r.status === 'ok').length;
    const m = rs.reduce((a, r) => a + r.matched, 0);
    const t = rs.reduce((a, r) => a + r.total, 0);
    const sum = (f: (r: FileRun) => number | null) => rs.reduce((a, r) => a + (f(r) ?? 0), 0);
    const costs = rs.map((r) => r.cost);
    lines.push(
      `| ${p} | ${rs[0]!.model} | ${ok}/${rs.length} | ${t ? `${m}/${t} (${Math.round((m / t) * 100)}%)` : '—'} | ` +
        `${Math.round(sum((r) => r.ms) / rs.length)} ms | ${sum((r) => r.inputTokens)}/${sum((r) => r.outputTokens)} | ` +
        `${costs.every((c) => c === null) ? '—' : money(sum((r) => r.cost))} |`,
    );
  }
  lines.push('', '## Fayllar', '');
  lines.push(
    '| Fayl | Provayder | Holat | Vaqt | Tokenlar | Narx | Aniqlik |',
    '|---|---|---|---|---|---|---|',
  );
  for (const r of runs) {
    lines.push(
      `| ${cell(r.file)} | ${r.provider} | ${r.status}${r.errorCode ? ` (${r.errorCode})` : ''} | ${r.ms} ms | ` +
        `${r.inputTokens ?? '—'}/${r.outputTokens ?? '—'} | ${money(r.cost)} | ${r.total ? `${r.matched}/${r.total}` : '—'} |`,
    );
  }
  lines.push('', '## Maydonlar (yonma-yon)', '');
  for (const file of [...new Set(runs.map((r) => r.file))]) {
    const rs = runs.filter((r) => r.file === file);
    const exp = expected[file] ?? {};
    const keys = [...new Set([...Object.keys(exp), ...rs.flatMap((r) => Object.keys(r.fields))])];
    lines.push(`### ${cell(file)}`, '');
    lines.push(`| Maydon | Kutilgan | ${rs.map((r) => r.provider).join(' | ')} |`);
    lines.push(`|---|---|${rs.map(() => '---').join('|')}|`);
    for (const k of keys) {
      const has = k in exp;
      const vals = rs.map((r) => {
        const v = cell(r.fields[k]);
        if (!has) return v;
        return `${norm(exp[k]) === norm(r.fields[k]) ? '✓' : '✗'} ${v}`;
      });
      lines.push(`| ${k} | ${has ? cell(exp[k]) : ''} | ${vals.join(' | ')} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

void main();
