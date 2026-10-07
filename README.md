# TizimLab (LabControl)

Farmatsevtika laboratoriyalari uchun LIMS — namuna tahlili, protokollar, reaktiv zaxirasi, harorat monitoringi
va stabilizatsiya tekshiruvlari. Ko'p-kompaniyali (multi-tenant) SaaS.

- To'liq hujjat: [`docs/LOYIHA.md`](docs/LOYIHA.md)
- Bo'limlarga ajratilgan spec, qarorlar, ochiq savollar, checklist: [`docs/spec/`](docs/spec/README.md)
- Claude Code / dasturchilar uchun qoidalar: [`CLAUDE.md`](CLAUDE.md)

## Holat

**P1 — poydevor.** Backend (Express 5, env validatsiya, PostgreSQL pool, migratsiya runner, xato formati, logger, Swagger)
va frontend (Vite + React + Tailwind, axios client, auth store, i18n, layout, router) skeleti tayyor.
Biznes funksiyalari (auth, namunalar, ...) keyingi fazalarda.

## Talablar

- Node.js 24 LTS (`.nvmrc`; `nvm use` yoki `fnm use`)
- npm 11+
- PostgreSQL 15+ (lokal yoki cloud: Neon/Railway/Supabase)
- Docker ishlatilmaydi

## O'rnatish

```bash
git clone <repo-url> tizimlab
cd tizimlab
npm install
cp backend/.env.example backend/.env    # Windows PowerShell: Copy-Item backend/.env.example backend/.env
```

`backend/.env` ni to'ldiring:

- `DATABASE_URL` — ish bazasi (cloud uchun oxiriga `?sslmode=require`);
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — har biri kamida 32 belgi:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;
- `TEST_DATABASE_URL` — testlar uchun ALOHIDA baza (masalan `.../tizimlab_test`). Bo'lmasa DB testlari lokal'da o'tkazib yuboriladi.

`.env` faylini hech qachon commit qilmang. Noto'g'ri yoki yetishmayotgan o'zgaruvchi bo'lsa server ularning
nomlarini chiqarib to'xtaydi.

Bazani tayyorlash:

```bash
npm run migrate -w backend          # migratsiyalarni qo'llash
npm run migrate:status -w backend   # holat
```

## Ishga tushirish

```bash
npm run dev      # backend http://localhost:4000, frontend http://localhost:5173 (/api va /socket.io proxy)
```

Tekshirish: `http://localhost:4000/health` → `{ "data": { "status": "ok", "db": "up" } }`;
Swagger (faqat development): `http://localhost:4000/docs`.

Production:

```bash
npm ci
npm run build
npm run migrate:dist -w backend     # devDependency'larsiz migratsiya
NODE_ENV=production npm start       # Windows: $env:NODE_ENV="production"; npm start
```

Frontend `frontend/dist/` — istalgan statik hostingga; `/api` so'rovlari backend'ga yo'naltirilishi kerak.

## Buyruqlar (repo ildizidan)

| Buyruq                    | Vazifasi                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| `npm run dev`             | Backend va frontendni parallel ishga tushiradi                    |
| `npm run build`           | Backend (`dist/`) va frontend (`frontend/dist/`) build            |
| `npm start`               | Backend'ni `dist/` dan ishga tushiradi                            |
| `npm run lint`            | ESLint                                                            |
| `npm run typecheck`       | `tsc --noEmit` (ikkala workspace)                                 |
| `npm run test`            | Vitest (ikkala workspace)                                         |
| `npm run check`           | lint + typecheck + test — commit/PR oldidan yashil bo'lishi shart |
| `npm run format`          | Prettier                                                          |
| `npm run checklist:stats` | `docs/spec/SPEC_CHECKLIST.md` statistikasini yangilash            |

## Tuzilma

```
backend/    Express 5 + TypeScript (ESM) + PostgreSQL (raw pg)
frontend/   React + TypeScript + Vite + Tailwind
docs/       LOYIHA.md va docs/spec/
scripts/    yordamchi skriptlar
.github/    CI (Node 24 + Postgres: npm ci → check → build)
```
