# CLAUDE.md — TizimLab (LabControl)

## Loyiha

TizimLab — farmatsevtika laboratoriyalari uchun ko'p-kompaniyali (multi-tenant) LIMS SaaS: namuna qabul qilishdan
tahlil, protokol tasdiqlash, reyestr arxivigacha; reaktiv zaxirasi, harorat monitoringi, stabilizatsiya tekshiruvlari,
real vaqtli va Telegram xabarnomalari. Loyiha noldan qayta quriladi. Yagona haqiqat manbai — `docs/LOYIHA.md`
(bo'laklari `docs/spec/`), unga teng kuchli — `docs/spec/DECISIONS.md`.

## Stack (o'zgartirilmaydi)

- **Backend:** Node.js 22 + Express + TypeScript, PostgreSQL (raw `pg`, ORM YO'Q), Zod, Socket.IO, grammy,
  Cloudflare R2 (`@aws-sdk/client-s3`), multer, docx, winston, helmet, bcrypt, jsonwebtoken.
- **Frontend:** React + TypeScript + Vite + Tailwind, React Query, Zustand, axios, i18next (uz/ru/en).
- **Tooling:** npm workspaces, Vitest, ESLint (flat), Prettier, GitHub Actions.
- Docker YO'Q. Hosting-agnostik: hammasi `.env` orqali, `npm run build` + `npm start`.
- Muhit Windows: skriptlar cross-platform (bash-only buyruq yo'q; env uchun `cross-env`).

## Repo tuzilmasi

```
backend/src/
  app.ts                 # entry: middleware, routerlar, Socket.IO, bot
  config/                # database.ts (pool, query, withTransaction), env.ts (Zod), swagger.ts
  middleware/            # authenticate.ts (requireRole/Company/Permission), sessionTimeout.ts, errorHandler.ts
  modules/<modul>/       # auth admin companies substances protocols samples reagents temperature
                         # stability notifications dashboard files audit telegram
  realtime/socket.ts     # Socket.IO, JWT handshake, user:<id> xonalar
  jobs/                  # stabilityAlertJob.ts (6 soat)
  db/migrations/         # 001_*.sql, 002_*.sql ...
  utils/                 # logger.ts (winston), docxExport.ts
backend/tests/           # unit + integration testlar
frontend/src/            # api/ hooks/ lib/ pages/ store/ i18n/locales/ components/ types/
docs/LOYIHA.md           # to'liq spec (o'zgartirilmaydi)
docs/spec/               # bo'limlar, DECISIONS, OPEN_QUESTIONS, SPEC_CHECKLIST
```

## Buyruqlar (ildizdan)

```
npm run dev        # backend + frontend parallel
npm run build      # ikkala workspace
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest
npm run check      # lint + typecheck + test — har ish oxirida YASHIL bo'lishi shart
```

Bitta workspace: `npm run test -w backend`.

## Kod konvensiyalari

### Backend

- Har modul to'rt fayl:
  - `*.router.ts` — Express Router + Swagger annotatsiya, middleware zanjiri;
  - `*.controller.ts` — so'rovni parse/validate (Zod) qiladi va service'ni chaqiradi; SQL yo'q;
  - `*.service.ts` — BARCHA SQL va biznes-logika, domen xato klassi (masalan `SampleError`) bilan;
  - `*.schemas.ts` — Zod sxemalar (body, params, query).
- Raw SQL faqat service'da, faqat parametrlashtirilgan (`$1, $2`). String konkatenatsiya/interpolatsiya bilan SQL YO'Q.
- Ko'p-bosqichli yozuvlar (status + tracking + notification va h.k.) `withTransaction()` ichida.
- Multi-tenancy: HAR BIR tenant jadvaliga so'rov `company_id` bo'yicha filtrlanadi (`company_id` tokendan, body'dan emas).
- Himoya: `authenticate` → `requireCompany` → `requireRole(...)` / `requirePermission(resource, action)`.
  Ruxsat backend'da majburlanadi; UI'da yashirish yetarli emas.
- Xatolar domen xato klassi orqali `errorHandler` ga; javobda ichki tafsilot/stack yo'q.
- Migratsiyalar: raqamlangan SQL (`NNN_nom.sql`), `schema_migrations` orqali kuzatiladi.
  Qo'llangan migratsiya faylini HECH QACHON o'zgartirma — yangi migratsiya qo'sh.

### Frontend

- API funksiyalari `src/api/<modul>.ts`, axios instance `src/api/client.ts`.
- Har modul uchun React Query hook `src/hooks/`.
- Barcha foydalanuvchiga ko'rinadigan matn `t('key')` orqali; kalit `uz.json`, `ru.json`, `en.json` uchalasiga qo'shiladi.
  JSX ichida qattiq yozilgan matn YO'Q.
- Global holat — Zustand (`store/`), server holati — React Query.

### Umumiy

- TypeScript `strict`; `any` faqat asoslangan holda.
- Kod izohlari asosan o'zbek tilida, faqat foyda bersa (nima emas — nega).
- Xavfsizlik: sirlarni (token, parol, kalit) logga yozma; `.env` ni commit qilma; yangi env o'zgaruvchi
  `backend/.env.example` va `config/env.ts` ga qo'shiladi.

## Testlar

- Har yangi funksiya uchun Vitest testlari: service logikasi, validatsiya chegaralari, status o'tishlari,
  rol ruxsatlari (ruxsat VA taqiq), kompaniyalararo izolyatsiya (DECISIONS D-12).
- Integration testlar `TEST_DATABASE_URL` bazasida ishlaydi.

## Ish tartibi (har faza)

1. Avval o'qi: tegishli `docs/spec/*` fayllari, `DECISIONS.md`, `OPEN_QUESTIONS.md` va
   `SPEC_CHECKLIST.md` dagi shu faza (`| Pn |`) qatorlari.
2. Reja tuz (qaysi checklist ID'lar yopiladi, qaysi fayllar, qaysi testlar).
3. Kod + testlar. Har checklist qatori uchun kamida bitta test.
4. Oxirida `npm run check` YASHIL bo'lsin.
5. `SPEC_CHECKLIST.md` holatini yangila: `[x]` faqat kod + test bo'lsa; qisman bo'lsa `[~]`. Statistikani qayta hisobla.
6. Spec'da yo'q narsani o'zingdan qo'shma. Noaniqlik bo'lsa — `OPEN_QUESTIONS.md` ga yoz va to'xta / so'ra.
7. Commit: `<tur>(pN): <qisqa tavsif>` (masalan `feat(p4): sample status machine`).

## Qilma

- Docker / docker-compose (D-11; `Dockerfile` faqat P12 da, ixtiyoriy).
- Sensor avtomatik ingest endpointi / API key (D-03 — keyingi versiya).
- ORM yoki query builder (Prisma, TypeORM, Knex, Drizzle...).
- `protocol_values` jadvali (D-09).
- Spec'da yoki DECISIONS'da yo'q funksiyalar, sahifalar, rollar, xabarnoma turlari.
- `docs/LOYIHA.md` ni tahrirlash.
