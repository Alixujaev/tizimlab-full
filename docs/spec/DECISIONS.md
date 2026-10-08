# Qabul qilingan qarorlar

Bu qarorlar `LOYIHA.md` dagi noaniqlik yoki eski holatlarni hal qiladi va spec bilan teng kuchga ega.
Checklist'da ularga `DECISIONS.md D-NN` deb havola qilinadi.

| ID | Qaror |
|---|---|
| D-01 | Toza baseline schema yoziladi (038 migratsiyani ko'chirmaymiz). Eski bazadan ma'lumot ko'chirish ETL skripti P12 da. |
| D-02 | Rad etish oqimi: protokol `rejected` bo'lsa → kimyogar tuzatib qayta yuboradi (rad etilgan protokol draft'ga qaytadi, sabab saqlanadi); namuna `in_progress` ga qaytadi. → O'ZGARTIRILDI: D-14 |
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
| D-13 | (Q-48) Xabarnoma qabul qiluvchilari: `sample_assigned` → biriktirilgan kimyogar; `protocol_submitted` → kompaniyaning barcha `lab_head`'lari; `protocol_approved` / `protocol_rejected` → namunaga biriktirilgan kimyogar (`sample.assigned_to`); `sample_approved` / `sample_rejected` → namunani yaratgan kontrolyor va biriktirilgan kimyogar; `temperature_alert`, `low_stock` → `lab_head` + `admin` (D-04); `stability_due_soon` / `stability_overdue` → checkpointga biriktirilgan kimyogar (bor bo'lsa) + kompaniyaning `lab_head`'lari. Harakatni bajargan foydalanuvchining o'ziga xabar yuborilmaydi. Faqat o'sha kompaniya foydalanuvchilariga. |
| D-14 | (Q-13; D-02 ni o'zgartiradi) Rad etish oqimi: `lab_head` rad etganda protokol `rejected`, namuna `rejected` holatida qoladi (sabab saqlanadi, tracking'ga yoziladi; `sample_rejected` va `protocol_rejected` xabarnomalari yuboriladi). Kimyogar faylni yangilab qayta yuborsa: protokol `rejected → submitted`, namuna `rejected → submitted`. Bu yangi o'tish status machine'ga qo'shiladi. D-02 ning "draft'ga qaytadi / in_progress ga qaytadi" qismi bekor. |
| D-15 | (Q-27) `finished_product`: biriktirilganda `final` protokol draft avtomatik yaratiladi; `in_process` ixtiyoriy — `lab_head` yoki biriktirilgan kimyogar namuna `approved` bo'lguncha yaratadi. Bir namunada har `protocol_role` bo'yicha ko'pi bilan bitta protokol. Namuna `final` protokol yuborilganda `submitted`, tasdiqlanganda `approved` bo'ladi; `in_process` protokol namuna statusiga ta'sir qilmaydi. Boshqa turlar uchun biriktirilganda `standard` protokol avtomatik yaratiladi (spec §3). |
| D-16 | (Q-01, Q-02) Foydalanuvchi boshqaruvi: `admin` — to'liq. `lab_head` — faqat `kontrolyor` va `chemist` rollaridagi foydalanuvchilarni yaratadi/tahrirlaydi/parolini tiklaydi. `user_permissions`'ni faqat `admin` boshqaradi. `director` — faqat ko'radi. |
| D-17 | (Q-11) Namunada muddat maydoni yo'q. §0 dagi "muddati o'tayotgan namunalar" = reaktiv `expires_at` (`is_expired`, dashboard) va stabilizatsiya muddatlari. Yangi xabarnoma turi qo'shilmaydi. |
| D-18 | (Q-62) Env nomlari qabul qilindi: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`. (D-25 bilan bir xil; to'liq tafsilot D-25 da.) |
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
