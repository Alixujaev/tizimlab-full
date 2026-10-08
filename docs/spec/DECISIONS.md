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
| D-30 | (Q-03) Farq — o'chirish: faqat `admin` o'chiradi va faqat hech bir namuna bog'lanmagan moddani (bog'langan bo'lsa 409); `lab_head` yaratadi va tahrirlaydi. |
| D-31 | (Q-04) Reyestr kompaniyaning barcha `approved` namunalarini (tafsilotlari bilan) barcha kompaniya rollariga ko'rsatadi; "faqat o'ziniki / biriktirilgan" cheklovi faqat Namunalar bo'limiga tegishli. |
| D-32 | (Q-05) Faqat qo'shimcha (grant): effektiv ruxsat = rol ruxsatlari ∪ individual ruxsatlar; "olib tashlash" = individual grant'ni o'chirish, rol ruxsatini deny qilib bo'lmaydi. |
| D-33 | (Q-07) chemist — biriktirilgan namunalar statuslar bo'yicha; kontrolyor (Inspector) — o'z namunalari; lab_head — biriktirish/tasdiq kutayotganlar, harorat alertlari, `low_stock`, `is_expired`, stabilizatsiya muddatlari; director — statuslar bo'yicha umumiy sonlar va yakunlanmagan protokollar; `admin` — LabHead dashboardi. |
| D-34 | (Q-08) Faqat nofaollashtirish (`is_active=false`), jismoniy o'chirish yo'q; nofaol kompaniya foydalanuvchilari login qila olmaydi, faol sessiyalari darhol bekor qilinadi; qayta faollashtirish mumkin. |
| D-35 | (Q-09) `super_admin` CLI skript bilan yaratiladi (`npm run` buyrug'i, parol interaktiv/env'dan emas); kompaniya yaratishda `super_admin` shu kompaniyaning birinchi `admin` foydalanuvchisini ham yaratadi, boshqa foydalanuvchilarni yaratmaydi. |
| D-36 | (Q-14) Yuborish faqat `in_progress` dan (va D-14 bo'yicha `rejected` dan); `stopped` namunani avval davom ettirish kerak. |
| D-37 | (Q-15) `lab_head` `in_progress`, `stopped`, `rejected` holatlarida qayta biriktira oladi; mavjud protokol(lar) saqlanadi va yangi kimyogarga o'tadi; yangi kimyogarga `sample_assigned`, tracking'ga yoziladi. |
| D-38 | (Q-16) Faqat biriktirilgan kimyogar (spec bo'yicha); davom ettirishda sabab ixtiyoriy; `stopped` namunada protokol fayli yuklanmaydi. |
| D-39 | (Q-17) Pasport `rejected` (sabab majburiy, ≥5 belgi), namuna `pending_assignment` da qoladi, yuklagan foydalanuvchi qayta yuklay oladi; `reagent`/`standard_substance` namunasiga kimyogar biriktirilmaydi. |
| D-40 | (Q-18) `chemist` yuklay oladi (`pending` holatda), `director` yuklay olmaydi (protokol pasportidagi R-PROTO-33 bilan mos). |
| D-41 | (Q-19) Holatsiz qo'shimcha hujjat — `reviewPassport` faqat `reagent`/`standard_substance` uchun (R-PASS-14 bilan mos). |
| D-42 | (Q-21) Yangi status qo'shilmaydi: ochiq protokollar `approved` ga o'tkaziladi, imzo va xabarnomasiz, tracking'ga "pasport orqali yopildi" deb yoziladi. |
| D-43 | (Q-22) Soft-delete (`deleted_at`): namuna barcha ro'yxatlardan yashiriladi, protokol/fayllar/stabilizatsiya saqlanadi, audit'ga yoziladi; `lab_head` va `admin` qila oladi; faol stabilizatsiyasi bor namunani o'chirib bo'lmaydi. |
| D-44 | (Q-23) `finished_product` — `final` protokol fayli (D-15); pasport orqali tasdiqlangan namuna — namuna pasporti fayli. |
| D-45 | (Q-28) Yuborishni faqat biriktirilgan kimyogar qiladi; `lab_head`/`admin` fayl yuklay oladi, lekin yubormaydi. |
| D-46 | (Q-30) Imzo — `protocol_signatures` yozuvi (foydalanuvchi, rol, harakat, vaqt), parol qayta kiritilmaydi; rad etilganda oldingi imzolar tarix sifatida saqlanadi, qayta yuborishda yangi imzo qo'shiladi. |
| D-47 | (Q-31) Asosiy fayl faqat `draft`/`rejected` da yuklanadi/almashtiriladi; `submitted`/`approved`/`finalized` da hamma fayllar qulflangan; pasport va qo'shimcha fayllarni yuklagan foydalanuvchi yoki `lab_head`/`admin` o'chiradi. |
| D-48 | (Q-32) Protokolni ko'ra oladigan har kim, istalgan statusda; tarkib: namuna (tur, modda, lot, seriya, kod), protokol roli va holati, imzolar (kim/rol/vaqt), rad etish sababi (bo'lsa); so'rov paytidagi UI tilida. |
| D-49 | (Q-33) `protocol_files` (qo'shimcha fayllar) faqat `finished_product` protokollariga biriktiriladi (spec §4); boshqa protokollarga — yo'q. |
| D-50 | (Q-34) Reyestrda: `/registry` da "yakunlanmagan" filtri, `/registry/:id` da protokol uchun "Yakunlash" tugmasi; yangi sahifa qo'shilmaydi. |
| D-51 | (Q-38) Matritsa bo'yicha: "To'liq" rollar (`lab_head`, `admin`) reaktiv, barcha tranzaksiyalar va hujjatlarni boshqaradi; "Ko'rish" rollar faqat ko'radi (`out` yozolmaydi); xarajat sahifalari reaktivlarni ko'ra oladigan barcha rollarga faqat o'qish uchun. |
| D-52 | (Q-40) Sensor: nomi, joyi (xona); o'qishni faqat "To'liq" rollar (`lab_head`, `admin`) kiritadi; namlik uchun ixtiyoriy alohida min/max; alertni yopish yo'q; chegaradan chiqqan har o'qish uchun alert. |
| D-53 | (Q-41) Checkpoint'ga (ixtiyoriy `assigned_to`) — D-13 dagi "checkpointga biriktirilgan kimyogar" bilan mos; study'da alohida mas'ul maydoni yo'q. |
| D-54 | (Q-42) Stabilizatsiya boshlash matritsasi bilan bir xil: `lab_head`, `director`, `admin` qo'shadi/o'zgartiradi/o'chiradi; natijasi bor checkpointni o'chirib bo'lmaydi. |
| D-55 | (Q-43) Birinchi natija kiritilganda avtomatik `in_progress`; `completed` — barcha parametrlar to'ldirilgach "Yakunlash" tugmasi bilan; `pending` dan ham `overdue` bo'lishi mumkin. |
| D-56 | (Q-44) Statuslar `active` / `completed`; barcha checkpointlar `completed` bo'lganda avtomatik `completed`; bekor qilish yo'q. |
| D-57 | (Q-45) Qo'lda tanlanadi (`specification` erkin matn); `initial_value` study yaratishda parametr bo'yicha qo'lda kiritiladi va checkpointlarga ko'chadi. |
| D-58 | (Q-47) Yo'q: bitta namunada bir vaqtda ko'pi bilan bitta `active` study. |
| D-59 | (Q-49) Bitta va "hammasini" o'qilgan deb belgilash, bell'da o'qilmaganlar soni; o'chirish va avtomatik tozalash yo'q. |
| D-60 | (Q-51) Bitta `audit_log`: login/logout/muvaffaqiyatsiz login, CRUD, status o'tishlari, fayl yuklash/o'chirish, ruxsat o'zgarishlari; audit jurnali (`super_admin`, barcha kompaniyalar) va faoliyat jurnali (kompaniya ichida) shu jadvaldan; filtrlar: sana, foydalanuvchi, harakat; eksport yo'q, muddatsiz saqlanadi. |
| D-61 | (Q-53) Protokol, pasport va reaktiv hujjatlari o'z jadval ustunlari bilan; generic `files` moduli faqat umumiy yuklash/yuklab olish servisi (R2 kaliti + metadata), alohida UI'siz; yuklab olish backend orqali stream yoki 5 daqiqalik imzolangan URL. |
| D-62 | (Audit, eski sxema) Yangi tizimda audit yozuviga (`old_values`/`new_values` yoki shunga o'xshash ustunlarga) yozishdan oldin sezgir ustunlar olib tashlanadi: `password_hash` va token/token hash'lari (eski sxemada `users.password_hash`, `sessions.token_hash`, `telegram_link_tokens.token`). Eski `audit_logs` tarixini ETL (P12) da ko'chirish varianti — `SCHEMA_DIFF.md` "Audit" bo'limida, foydalanuvchi qarori kutilmoqda. |
| D-63 | (ETL, audit tarixi) Eski `audit_logs` YANGI audit jadvaliga KO'CHIRILMAYDI; eski baza dump'i arxiv sifatida saqlanadi. Har bir ko'chirilgan namuna va protokol uchun ETL BITTA sintetik tracking voqea yozadi: "legacy'dan ko'chirildi", joriy status, asl `created_at`/`updated_at` (eski sxemada `sample_tracking` yo'qligi sababli). |
| D-64 | (Audit mexanizmi) Yangi audit ilova darajasida yoziladi (DB trigger EMAS): servis qatlami audit yozuvini o'zgartirish bilan BIR tranzaksiyada yozadi; `user_id`, `company_id`, `ip_address`, `user_agent` to'ldiriladi. D-60 va D-62 amal qiladi. (Mexanizm shu qaror bilan hal — alohida savol ochilmaydi.) |
| D-65 | (P11, Telegram link token) Link token bazada SHA-256 xesh sifatida saqlanadi (xom token emas), bir martalik va qisqa muddatli; aniq muddat P11 da hal qilinadi (Q-55). |
