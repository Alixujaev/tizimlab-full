# Qabul qilingan qarorlar

Bu qarorlar `LOYIHA.md` dagi noaniqlik yoki eski holatlarni hal qiladi va spec bilan teng kuchga ega.
Checklist'da ularga `DECISIONS.md D-NN` deb havola qilinadi.

| ID | Qaror |
|---|---|
| D-01 | Toza baseline schema yoziladi (038 migratsiyani ko'chirmaymiz). Eski bazadan ma'lumot ko'chirish ETL skripti P12 da. |
| D-02 | Rad etish oqimi: protokol `rejected` bo'lsa → kimyogar tuzatib qayta yuboradi (rad etilgan protokol draft'ga qaytadi, sabab saqlanadi); namuna `in_progress` ga qaytadi. |
| D-03 | Sensor avtomatik ma'lumot yuborishi (ingest endpoint, API key) KEYINGI versiyaga. Hozir: `sensor_configs` (min/max), qo'lda kiritish (`is_manual`), alertlar. Schema keyin qo'shishga tayyor bo'lsin. |
| D-04 | `low_stock` va `temperature_alert` xabarnomalari kompaniyaning `lab_head` va `admin` rollariga boradi. |
| D-05 | Stabilizatsiya 5 ta standart parametr: Tavsif (Description), Assay, Namlik miqdori (Water content), Qo'shimcha aralashmalar (Related substances), Eruvchanlik (Dissolution). Qo'shish/olib tashlash mumkin. |
| D-06 | Fayl limitlari: protokol fayllari 20MB, generic `files` moduli 50MB; hammasi Cloudflare R2'da; ruxsat etilgan: PDF, .doc, .docx, JPEG, PNG. |
| D-07 | Direktor finalizatsiyasi (`finalized`) faqat protokol statusiga ta'sir qiladi, namuna statusiga emas. Reyestr `approved` namunalardan iborat. |
| D-08 | Reaktiv "xarajat" = `out` tipidagi `reagent_transactions` (narx maydoni yo'q). Xarajat jurnali/ro'yxati shularni kalendar va ro'yxat ko'rinishida ko'rsatadi. |
| D-09 | `protocol_values` jadvali yangi schemaga KIRMAYDI (eski tuzilma; faqat ETL'da kerak bo'lsa ko'rib chiqiladi). |
| D-10 | `user_permissions` resource:action katalogi P2 da tuziladi va foydalanuvchiga tasdiqlatiladi. |
| D-11 | Docker yo'q; `Dockerfile` ixtiyoriy, P12 da. |
| D-12 | Multi-tenancy: ilova darajasida — HAR BIR tenant jadvaliga so'rov `company_id` bo'yicha filtrlanadi; buni tekshiradigan integration test P12 da (lekin har fazada yoziladi). |
| D-13…D-18 | Zaxira (P0.5 uchun ajratilgan; P0.5 repo'da yo'q — foydalanuvchi qarori bilan P1 D-19 dan davom etadi). |
| D-19 | Gate qoidasi (OPEN_QUESTIONS bo'yicha): savol NON-BLOCKING bo'lsa — oqilona default qo'llanadi va yangi D-xx sifatida yoziladi (savol `✅ D-xx` deb belgilanadi); BLOCKING bo'lsa — ish to'xtatiladi va foydalanuvchidan so'raladi. |
| D-20 | Node 24 LTS: `.nvmrc`, `engines`, CI workflow Node 24 ga o'tadi. |
| D-21 | Backend: ESM, `module/moduleResolution: NodeNext`, nisbiy importlarda `.js` kengaytma; dev — `tsx watch`; build — `tsc` + SQL migratsiya fayllarini dist'ga ko'chiruvchi cross-platform node skript. Spec §16 dan farq: `src/app.ts` faqat `createApp()` ni eksport qiladi (testlar uchun), server ishga tushirish `src/server.ts` da. |
| D-22 | API formati: muvaffaqiyat `{ data, meta? }` (ro'yxatda `meta: { page, limit, total }`); xato `{ error: { code, message, details?, requestId } }`. Prefiks `/api/v1`. Pagination: `page` (default 1), `limit` (default 20, max 100). |
| D-23 | Frontend auth: access token faqat xotirada (Zustand, localStorage'ga YOZILMAYDI); sahifa yangilanganda refresh cookie orqali tiklanadi. |
| D-24 | Migratsiyalar faqat oldinga (down yo'q); qo'llangan fayl checksum'i o'zgarsa runner xato beradi. |
| D-25 | (Q-62, gate default) Env nomlari: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (har biri ≥32 belgi), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (production'da majburiy). DB faqat `DATABASE_URL` orqali (lokal ham, cloud ham); SSL — URL'dagi `sslmode` bilan. `DB_*` o'zgaruvchilari yo'q (foydalanuvchi qarori). |
| D-26 | (gate default) Qo'shimcha env (spec'da yo'q): `TEST_DATABASE_URL`, `FRONTEND_URL` (CORS; production'da majburiy), `TRUST_PROXY` (default `false`). `TELEGRAM_BOT_TOKEN` berilsa `TELEGRAM_BOT_USERNAME` majburiy; production'da token bilan `TELEGRAM_WEBHOOK_URL` + `TELEGRAM_WEBHOOK_SECRET` majburiy. JSON body limiti 1MB. |
| D-27 | (Q-66, gate default) Tanlangan til faqat `localStorage` da (`tizimlab.lang`) saqlanadi, bazada emas; `<html lang>` joriy til bilan sinxron. |
| D-28 | (Q-64, gate default) Sidebar: Bosh sahifa, Namunalar, Reyestr, Harorat — 5 ta kompaniya roli; Foydalanuvchilar, Faoliyat — `lab_head`/`director`/`admin`; `super_admin` — faqat Kompaniyalar va Audit jurnali, uning `/` sahifasi `/companies` ga yo'naltiriladi (SuperAdminDashboard). Profil — top bar orqali, barcha rollar uchun. |
| D-29 | (Q-24, Q-36, gate default) Spec'da nomlanmagan yo'llar: `/samples`, `/samples/:id` (namuna sahifasi, `ProtocolSection` shu yerda), `/substances`, `/substances/:id`, `/reagents`, `/stability`, `/stability/:id`. Kompaniya sahifalari `super_admin` ga yopiq. Moddalar/Reaktivlar/Stabilizatsiyaga kirish nuqtalari (ichki havolalar) tegishli fazada. |
