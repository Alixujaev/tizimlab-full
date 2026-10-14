// SPEC_CHECKLIST.md statistikasini qayta hisoblaydi: `npm run checklist:stats`.
// Jadval qatorlari formatini, ID unikalligini va fazalarni tekshiradi; "## Statistika" bo'limini qayta yozadi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'docs/spec/SPEC_CHECKLIST.md');
const PHASES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13'];
const STATES = ['[ ]', '[~]', '[x]'];
const ROW = /^\| (R-[A-Z0-9]+-\d+) \| (.+?) \| (.+?) \| (P\d+) \| (\[.\]) \|$/;

const src = fs
  .readFileSync(file, 'utf8')
  .replace(/\n## Statistika[\s\S]*$/, '\n')
  .replace(/\n+$/, '\n');

const sections = new Map();
const byPhase = new Map(PHASES.map((p) => [p, Object.fromEntries(STATES.map((s) => [s, 0]))]));
const ids = new Set();
const errors = [];
let current = null;
let total = 0;

for (const line of src.split('\n')) {
  const heading = /^## (.+)$/.exec(line);
  if (heading) {
    current = heading[1];
    continue;
  }
  if (!line.startsWith('| R-')) continue;
  const m = ROW.exec(line);
  if (!m) {
    errors.push(`Noto'g'ri qator: ${line}`);
    continue;
  }
  const [, id, , , phase, state] = m;
  if (ids.has(id)) errors.push(`Takroriy ID: ${id}`);
  ids.add(id);
  if (!PHASES.includes(phase)) errors.push(`Noma'lum faza: ${id} ${phase}`);
  if (!STATES.includes(state)) errors.push(`Noma'lum holat: ${id} ${state}`);
  total++;
  const sec = sections.get(current) ?? Object.fromEntries(STATES.map((s) => [s, 0]));
  sec[state]++;
  sections.set(current, sec);
  byPhase.get(phase)[state]++;
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const row = (name, c) => {
  const n = c['[ ]'] + c['[~]'] + c['[x]'];
  return `| ${name} | ${n} | ${c['[x]']} | ${c['[~]']} | ${c['[ ]']} |\n`;
};
const sum = (list) =>
  list.reduce(
    (acc, c) => {
      for (const s of STATES) acc[s] += c[s];
      return acc;
    },
    Object.fromEntries(STATES.map((s) => [s, 0])),
  );
const head = (title) => `| ${title} | Jami | [x] | [~] | [ ] |\n|---|---|---|---|---|\n`;

let out =
  "\n## Statistika\n\n_`npm run checklist:stats` bilan hisoblanadi — qo'lda tahrirlamang._\n\n### Bo'limlar bo'yicha\n\n" +
  head("Bo'lim");
for (const [name, c] of sections) out += row(name, c);
out += row('**Jami**', sum([...sections.values()]));
out += "\n### Fazalar bo'yicha\n\n" + head('Faza');
for (const p of PHASES) out += row(p, byPhase.get(p));
out += row('**Jami**', sum([...byPhase.values()]));

fs.writeFileSync(file, src + out);
const totals = sum([...byPhase.values()]);
console.log(
  `checklist: ${total} qator — [x] ${totals['[x]']}, [~] ${totals['[~]']}, [ ] ${totals['[ ]']}`,
);
