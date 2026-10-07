# CLAUDE.md — TizimLab (LabControl)

## Loyiha

TizimLab — farmatsevtika laboratoriyalari uchun ko'p-kompaniyali (multi-tenant) LIMS SaaS: namuna qabul qilishdan
tahlil, protokol tasdiqlash, reyestr arxivigacha; reaktiv zaxirasi, harorat monitoringi, stabilizatsiya tekshiruvlari,
real vaqtli va Telegram xabarnomalari. Loyiha noldan qayta quriladi. Yagona haqiqat manbai — `docs/LOYIHA.md`
(bo'laklari `docs/spec/`), unga teng kuchli — `docs/spec/DECISIONS.md`.

## Stack (o'zgartirilmaydi)

- **Backend:** Node.js 24 + Express 5 + TypeScript (ESM), PostgreSQL (raw `pg`, ORM YO'Q), Zod, Socket.IO, grammy,
  Cloudflare R2 (`@aws-sdk/client-s3`), multer, docx, winston, helmet, bcrypt, jsonwebtoken.
- **Frontend:** React + TypeScript + Vite + Tailwind, React Router, React Query, Zustand, axios, i18next (uz/ru/en), sonner.
- **Tooling:** npm workspaces, Vitest (+ supertest, Testing Library), ESLint (flat), Prettier, GitHub Actions.
- Docker YO'Q. Hosting-agnostik: hammasi `.env` orqali, `npm run build` + `npm start`.
- Muhit Windows: skriptlar cross-platform (bash-only buyruq yo'q; env uchun `cross-env`, fayl ishlari node skriptda).

## Repo tuzilmasi

```
backend/src/
  app.ts                 # createApp() — faqat ilovani yig'adi (D-21)
  server.ts              # loadEnv → initDb → listen, graceful shutdown
  config/                # env.ts (Zod), database.ts (pool, query, withTransaction), swagger.ts
  middleware/            # validate, requestId, notFound, errorHandler (+ P2: authenticate, sessionTimeout)
  modules/<modul>/       # auth admin companies substances protocols samples reagents temperature
                         # stability notifications dashboard files audit telegram
  db/migrator.ts, cli.ts # migratsiya runner; db/migrations/NNN_nom.sql
  utils/                 # errors.ts, http.ts (sendOk/sendPaginated), pagination.ts, logger.ts
backend/tests/           # Vitest + supertest; helpers/db.ts (describeDb, createIsolatedDb)
frontend/src/            # api/ hooks/ lib/ store/ i18n/ config/ components/{ui,layout,routing} pages/ types/ router.tsx
docs/spec/               # bo'limlar, DECISIONS, OPEN_QUESTIONS, SPEC_CHECKLIST
scripts/                 # checklist-stats.mjs
```

## Buyruqlar (ildizdan)

```
npm run dev              # backend (tsx watch) + frontend (vite) parallel
npm run build            # backend: tsc + migratsiyalarni dist'ga; frontend: vite build
npm start                # backend dist'dan
npm run lint | typecheck | test
npm run check            # lint + typecheck + test — har ish oxirida YASHIL bo'lishi shart
npm run migrate -w backend          # migratsiyalarni qo'llash (migrate:status — holat)
npm run test -w backend -- tests/app.test.ts   # bitta fayl
npm run checklist:stats  # SPEC_CHECKLIST statistikasini qayta hisoblash
```

## Kod konvensiyalari

### Backend

- ESM: nisbiy importlarda `.js` kengaytma (`import { query } from '../config/database.js'`); `import type` tiplar uchun.
- Har modul to'rt fayl: `*.router.ts` (Router + `@openapi` annotatsiya, middleware zanjiri),
  `*.controller.ts` (`validate()` natijasi `req.validated` dan, service chaqiradi, SQL yo'q),
  `*.service.ts` (BARCHA SQL va biznes-logika, `AppError` dan meros domen xatolari), `*.schemas.ts` (Zod).
- Raw SQL faqat service'da, faqat parametrlashtirilgan (`$1, $2`). String konkatenatsiya/interpolatsiya bilan SQL YO'Q.
- Ko'p-bosqichli yozuvlar `withTransaction()` ichida.
- Multi-tenancy: HAR BIR tenant jadvaliga so'rov `company_id` bo'yicha filtrlanadi (`company_id` tokendan, body'dan emas).
- Himoya (P2 dan): `authenticate` → `requireCompany` → `requireRole(...)` / `requirePermission(resource, action)`.
  Ruxsat backend'da majburlanadi; UI'da yashirish yetarli emas.
- **API formati (D-22):** prefiks `/api/v1`; muvaffaqiyat `sendOk(res, data)` → `{ data }`,
  ro'yxat `sendPaginated(res, items, { page, limit, total })` → `{ data, meta }`; xato — `AppError` tashlanadi,
  `errorHandler` → `{ error: { code, message, details?, requestId } }`. Ro'yxat query'si `paginationQuerySchema` ni kengaytiradi.
- Migratsiyalar (D-24): `NNN_nom.sql`, faqat oldinga, `schema_migrations` da checksum bilan.
  Qo'llangan faylni HECH QACHON o'zgartirma — yangi migratsiya qo'sh.
- Logger: `utils/logger.ts`; sezgir kalitlar (password, token, secret, cookie, authorization) avtomatik yashiriladi,
  lekin baribir body/sarlavhalarni loglama.

### Frontend

- Import alias `@/` (`src/`). API funksiyalari `src/api/<modul>.ts`, faqat `apiClient` orqali.
- Har modul uchun React Query hook `src/hooks/`. Xatolar global toast orqali (`lib/queryClient.ts`).
- Access token faqat Zustand'da (D-23) — `localStorage`/`sessionStorage` ga sir yozilmaydi.
- Barcha ko'rinadigan matn `t('key')`; kalit `uz.json`, `ru.json`, `en.json` UCHALASIGA qo'shiladi (parity testi bor).
  ESLint `i18next/no-literal-string` pages/components'da xato beradi.
- Yangi sahifa: `router.tsx` dagi to'g'ri `RoleRoute` guruhiga; menyu elementi bo'lsa — `config/navigation.ts`.

### Umumiy

- TypeScript `strict`; `any` faqat asoslangan holda.
- Kod izohlari asosan o'zbek tilida, faqat foyda bersa (nima emas — nega).
- Sirlarni logga yozma; `.env` ni commit qilma; yangi env o'zgaruvchi `backend/.env.example` va `config/env.ts` ga birga.

## Testlar

- Har yangi funksiya uchun Vitest testlari: service logikasi, validatsiya chegaralari, status o'tishlari,
  rol ruxsatlari (ruxsat VA taqiq), kompaniyalararo izolyatsiya (D-12).
- DB testlari `describeDb` + `createIsolatedDb()` (har test alohida sxemada) bilan; `TEST_DATABASE_URL`
  (`backend/.env`) yo'q bo'lsa lokal'da skip, CI'da majburiy.
- HTTP testlari: `testApp()` / `miniApp()` (`backend/tests/helpers/app.ts`) + supertest.
- Frontend: Testing Library, `renderAt(path)` / `loginAs(role)` (`frontend/tests/helpers.tsx`), axios uchun `axios-mock-adapter`.

## Ish tartibi (har faza)

1. Avval o'qi: tegishli `docs/spec/*`, `DECISIONS.md`, `OPEN_QUESTIONS.md` va `SPEC_CHECKLIST.md` dagi shu faza qatorlari.
2. Reja tuz (qaysi checklist ID'lar, fayllar, testlar) va tasdiqlat.
3. Kod + testlar. Har checklist qatori uchun kamida bitta test.
4. Oxirida `npm run check` YASHIL bo'lsin.
5. `SPEC_CHECKLIST.md`: `[x]` faqat kod + test bo'lsa, qisman — `[~]` (sababi "Holat izohlari" da);
   `npm run checklist:stats`. Mavjud qatorlar matni/ID'si o'zgartirilmaydi.
6. Gate (D-19): ochiq savol NON-BLOCKING bo'lsa — default qo'lla, D-xx yoz, savolni `✅ D-xx` qil;
   BLOCKING bo'lsa — to'xta va so'ra. Spec'da yo'q narsani o'zingdan qo'shma.
7. Commit: `<tur>(pN): <qisqa tavsif>` (masalan `feat(p4): sample status machine`).

## Qilma

- Docker / docker-compose (D-11; `Dockerfile` faqat P12 da, ixtiyoriy).
- Sensor avtomatik ingest endpointi / API key (D-03 — keyingi versiya).
- ORM yoki query builder (Prisma, TypeORM, Knex, Drizzle...).
- `protocol_values` jadvali (D-09).
- Spec'da yoki DECISIONS'da yo'q funksiyalar, sahifalar, rollar, xabarnoma turlari.
- `docs/LOYIHA.md` ni tahrirlash.
