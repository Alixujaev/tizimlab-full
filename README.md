# TizimLab (LabControl)

Farmatsevtika laboratoriyalari uchun LIMS — namuna tahlili, protokollar, reaktiv zaxirasi, harorat monitoringi
va stabilizatsiya tekshiruvlari. Ko'p-kompaniyali (multi-tenant) SaaS.

- To'liq hujjat: [`docs/LOYIHA.md`](docs/LOYIHA.md)
- Bo'limlarga ajratilgan spec, qarorlar, ochiq savollar, checklist: [`docs/spec/`](docs/spec/README.md)
- Claude Code / dasturchilar uchun qoidalar: [`CLAUDE.md`](CLAUDE.md)

## Holat

**P0 — poydevor.** Hozircha faqat tooling (TypeScript, ESLint, Prettier, Vitest) va hujjatlar bor.
Backend (Express) va frontend (Vite + React) skeleti P1 fazasida qo'shiladi; shu sababli hozir
`npm run build` faqat tip tekshiruvi qiladi, `npm run dev` esa xabar chiqaradi.

## Talablar

- Node.js 22 LTS (`.nvmrc`; `nvm use` yoki `fnm use`)
- npm 10+
- PostgreSQL (lokal yoki cloud) — P1 dan boshlab kerak
- Docker ishlatilmaydi

## O'rnatish

```bash
git clone <repo-url> tizimlab
cd tizimlab
npm install
```

Muhit o'zgaruvchilari (P1 dan boshlab kerak):

```bash
cp backend/.env.example backend/.env    # Windows PowerShell: Copy-Item backend/.env.example backend/.env
```

So'ng `backend/.env` ichidagi qiymatlarni to'ldiring. `.env` faylini hech qachon commit qilmang.

## Buyruqlar (repo ildizidan)

| Buyruq              | Vazifasi                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Backend va frontendni parallel ishga tushiradi (`concurrently`)   |
| `npm run build`     | Ikkala workspace'ni build qiladi                                  |
| `npm run lint`      | ESLint                                                            |
| `npm run typecheck` | `tsc --noEmit` (ikkala workspace)                                 |
| `npm run test`      | Vitest (ikkala workspace)                                         |
| `npm run check`     | lint + typecheck + test — commit/PR oldidan yashil bo'lishi shart |
| `npm run format`    | Prettier bilan formatlash                                         |

Bitta workspace uchun: `npm run test -w backend`, `npm run typecheck -w frontend`.

## Tuzilma

```
backend/    Express + TypeScript + PostgreSQL (raw pg) — src/ tuzilmasi spec §16 bo'yicha
frontend/   React + TypeScript + Vite + Tailwind (P1 da)
docs/       LOYIHA.md va docs/spec/
.github/    CI (Node 22: npm ci → check → build)
```

## Deploy

Hosting-agnostik: barcha sozlamalar `.env` orqali, `npm run build` + `npm start`. Batafsil — P12.
