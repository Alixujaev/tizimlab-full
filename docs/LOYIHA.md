# TizimLab (LabControl) — To'liq loyiha hujjati

**Pharmaceutical LIMS** (Laboratory Information Management System) — farmatsevtika laboratoriyalari uchun namuna tahlili, protokol boshqaruvi, reaktiv zaxirasi, harorat monitoringi va stabilizatsiya tekshiruvlarini avtomatlashtiradigan **ko'p-kompaniyali (multi-tenant) SaaS tizimi**.

---

## 0. Loyiha maqsadi

Farmatsevtika laboratoriyasida namuna (xom ashyo, tayyor mahsulot, reaktiv, standart modda) qabul qilinishidan tortib, tahlil qilinib, tasdiqlanib, arxivlanguncha bo'lgan butun jarayon qog'ozda yoki tarqoq Excel fayllarda yuritiladi — bu esa nazoratni qiyinlashtiradi, muddatlar chalkashadi, kim nima qilganini kuzatib bo'lmaydi.

TizimLab shu jarayonni bitta raqamli tizimga jamlaydi:

- Har bir namuna va protokol uchun **aniq status va tarix** (kim, qachon, nima qildi).
- Rollarga qarab **ruxsatlar** — kontrolyor faqat kiritadi, kimyogar tahlil qiladi, lab boshlig'i tasdiqlaydi, direktor yakunlaydi.
- **Avtomatik eslatmalar** — muddati o'tayotgan namunalar, kam qolgan reaktivlar, chegaradan chiqqan harorat, stabilizatsiya muddatlari — ekranda, real vaqtda va Telegram orqali.
- **Bitta tizim — ko'p kompaniya**: platforma bir nechta laboratoriya/zavodga bir vaqtda xizmat qiladi, har birining ma'lumoti izolyatsiyalangan (multi-tenant arxitektura).

---

## Mundarija

1. [Foydalanuvchi rollari](#1-foydalanuvchi-rollari)
2. [Ko'p-kompaniyali arxitektura (multi-tenancy)](#2-kop-kompaniyali-arxitektura-multi-tenancy)
3. [Namunalar va Reyestr](#3-namunalar-va-reyestr)
4. [Protokollar](#4-protokollar)
5. [Moddalar (Substances)](#5-moddalar-substances)
6. [Reaktivlar va Xarajat jurnali](#6-reaktivlar-va-xarajat-jurnali)
7. [Harorat monitoringi](#7-harorat-monitoringi)
8. [Stabilizatsiya tekshiruvi](#8-stabilizatsiya-tekshiruvi)
9. [Xabarnomalar — real vaqtli va Telegram](#9-xabarnomalar--real-vaqtli-va-telegram)
10. [Foydalanuvchilar, Admin panel, Ruxsatlar](#10-foydalanuvchilar-admin-panel-ruxsatlar)
11. [Audit va Faoliyat jurnali](#11-audit-va-faoliyat-jurnali)
12. [Fayllarni saqlash](#12-fayllarni-saqlash)
13. [Telegram integratsiyasi](#13-telegram-integratsiyasi)
14. [Ko'p tillilik (i18n)](#14-kop-tillilik-i18n)
15. [Autentifikatsiya va xavfsizlik](#15-autentifikatsiya-va-xavfsizlik)
16. [Texnik arxitektura](#16-texnik-arxitektura)
17. [Asosiy ish oqimi (boshidan oxirigacha)](#17-asosiy-ish-oqimi-boshidan-oxirigacha)
18. [O'zgarishlar tarixi](#18-ozgarishlar-tarixi)

---

## 1. Foydalanuvchi rollari

Tizimda 6 ta rol mavjud:

| Rol | Uzbekcha | Asosiy vazifa | Ko'lam |
|-----|----------|---------------|--------|
| `super_admin` | Super-administrator | Platformani boshqaradi: kompaniyalarni yaratish/faollashtirish, barcha kompaniyalar bo'yicha audit jurnali | Butun platforma (kompaniyaga bog'liq emas) |
| `kontrolyor` | Kontrolyor | Namuna kiritish, laboratoriyaga topshirish | Bitta kompaniya |
| `chemist` | Kimyogar | Tahlil o'tkazish, protokol to'ldirish, stabilizatsiya natijasi kiritish | Bitta kompaniya |
| `lab_head` | Lab boshlig'i | Kimyogarga yo'naltirish, protokolni tasdiqlash, foydalanuvchilarni boshqarish | Bitta kompaniya |
| `director` | Direktor | Protokolni yakunlash (finalizatsiya), umumiy statistika | Bitta kompaniya |
| `admin` | Kompaniya administratori | Foydalanuvchilar, ruxsatlar, parol tiklash — kompaniya darajasida | Bitta kompaniya |

> **Muhim:** `super_admin` boshqa rollardan tubdan farq qiladi — u hech qanday kompaniyaga bog'lanmagan (`company_id = null`) va oddiy ish oqimlarida (namuna, protokol va h.k.) qatnashmaydi. Uning interfeysi butunlay boshqacha — faqat **Kompaniyalar** va **Audit jurnali** sahifalarini ko'radi (`SuperAdminDashboard`).

### Kim nimaga kirishi mumkin (kompaniya ichidagi rollar)

| Modul | kontrolyor | chemist | lab_head | director | admin |
|-------|-----------|---------|----------|----------|-------|
| Namuna yaratish | ✅ | — | — | — | — |
| Namuna ko'rish | Faqat o'ziniki | O'ziga biriktirilgan | ✅ Hammasi | ✅ Hammasi | ✅ Hammasi |
| Kimyogarga biriktirish | — | — | ✅ | — | — |
| Protokol fayl yuklash | — | ✅ | ✅ | — | ✅ |
| Protokol tasdiqlash | — | — | ✅ | — | — |
| Protokol yakunlash | — | — | — | ✅ | — |
| Reyestrni ko'rish | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moddalar | Ko'rish | Ko'rish | Ko'rish + tahrirlash | Ko'rish | ✅ To'liq |
| Reaktivlar | Ko'rish | Ko'rish | ✅ To'liq | Ko'rish | ✅ To'liq |
| Harorat | Ko'rish | Ko'rish | ✅ To'liq | Ko'rish | ✅ To'liq |
| Stabilizatsiya boshlash | — | — | ✅ | ✅ | ✅ |
| Stabilizatsiya natija kiritish | — | ✅ (biriktirilgan) | ✅ | ✅ | ✅ |
| Foydalanuvchilar boshqaruvi | — | — | ✅ | ✅ (ko'rish) | ✅ To'liq |
| Faoliyat jurnali | — | — | ✅ | ✅ | ✅ |

Rol asosidagi ruxsatlardan tashqari, `user_permissions` jadvali orqali **individual ruxsatlar** ham berilishi mumkin (`requirePermission(resource, action)` middleware) — masalan, bitta kimyogarga alohida qo'shimcha huquq berish.

---

## 2. Ko'p-kompaniyali arxitektura (multi-tenancy)

TizimLab bitta o'rnatilgan tizim sifatida bir nechta laboratoriya-kompaniyaga xizmat qiladi:

- Har bir `users` yozuvi `company_id` ga ega (super_admin bundan mustasno — uniki `null`).
- Har bir asosiy jadval (`samples`, `substances`, `protocols`, `reagents`, ...) kompaniya bo'yicha ajratilgan.
- JWT tokenida `company_id` bor — `requireCompany` middleware kompaniya kontekstisiz so'rovlarni bloklaydi.
- **Kompaniyalar** sahifasi (`/companies`, faqat `super_admin`) — yangi kompaniya yaratish (nomi + `slug`), faollashtirish/o'chirish, tahrirlash.

Bitta kompaniya — bitta mustaqil laboratoriya: o'z foydalanuvchilari, o'z namunalari, o'z reaktiv va moddalar ro'yxati bilan, boshqa kompaniyalarning ma'lumotini ko'rmaydi.

---

## 3. Namunalar va Reyestr

### Namuna turlari

| Tur | Tavsif |
|-----|--------|
| `raw_material` | Xom ashyo |
| `finished_product` | Tayyor mahsulot |
| `reagent` | Reaktiv sifatida kiritilgan namuna |
| `standard_substance` | Standart namuna |
| `other` | Boshqa |

### Namuna hayot tsikli (Status machine)

```
pending_assignment
       │
       │  Lab boshlig'i kimyogarga biriktiradi
       ▼
  in_progress  ←──────────────────────────────────┐
       │                                           │
       │  Kimyogar "Tahlilni to'xtatish" bosadi    │ Kimyogar "Davom ettirish" bosadi
       ▼                                           │
    stopped ──────────────────────────────────────┘
       │
       │  Kimyogar protokolni yuboradi
       ▼
   submitted
       │
       ├── Lab boshlig'i "Tasdiqlash" bosadi ──▶ approved
       │
       └── Lab boshlig'i "Rad etish" bosadi ──▶ rejected
```

### Kim nima qiladi

**Kontrolyor:** yangi namuna yaratadi (modda tanlaydi, lot/seriya raqam, miqdor kiritadi) → namuna `pending_assignment` holatida lab boshlig'ini kutadi.

**Lab boshlig'i:** namunani kimyogarga biriktiradi → **avtomatik** protokol draft holatida yaratiladi → kimyogarga xabar yuboriladi (ekranda + real vaqtda + Telegram orqali, agar ulangan bo'lsa).

**Kimyogar:** o'ziga biriktirilgan namunalarni ko'radi, protokolga tahlil faylini yuklaydi (PDF/Word/JPEG/PNG), protokolni boshliqqa yuboradi, zarur bo'lsa tahlilni to'xtatadi (sabab yozish shart, kamida 5 belgi).

**Lab boshlig'i (tasdiqlash bosqichi):** `submitted` protokollarni ko'rib chiqadi, tasdiqlaydi yoki rad etadi → tasdiqlansa namuna `approved` bo'ladi, protokolda imzo qo'yiladi.

### Namuna pasporti — protokolsiz tezlashtirilgan tasdiqlash yo'li

Ba'zi namuna turlari uchun (`raw_material`, `finished_product`, `reagent`, `standard_substance`) namunaning o'ziga **pasport** (yetkazib beruvchining sertifikati/hujjati) biriktirish mumkin. Bu protokolning asosiy tahlil faylidan **butunlay boshqa, alohida** hujjat va oqim:

- **`reagent` va `standard_substance` turlari uchun** — pasport bu namunani tasdiqlashning **yagona yo'li**: kimyogar/protokol jarayoni umuman kerak emas.
  - Lab boshlig'i yoki admin pasport yuklasa → avtomatik `approved` deb belgilanadi va **namunaning o'zi ham darhol `approved` bo'ladi** (ochiq protokollar bo'lsa, ular ham avtomatik yopiladi).
  - Kontrolyor (yoki boshqa oddiy foydalanuvchi) yuklasa → `pending` holatda qoladi, keyin lab boshlig'i/admin uni alohida tasdiqlashi (`reviewPassport`) yoki rad etishi kerak — o'zi yuklagan hujjatni o'zi tasdiqlay olmaydi.
- **`raw_material` va `finished_product` turlari uchun** — pasport shunchaki **qo'shimcha hujjat**: namuna baribir odatdagi biriktirish → tahlil → protokol yo'lidan o'tadi, pasport uni bypass qilmaydi. Bu turlarda faqat kimyogar (o'ziga biriktirilgan namuna uchun) yoki kontrolyor/lab boshlig'i/admin yuklay oladi.
- Pasport fayli Cloudflare R2'da saqlanadi, o'z egasi (agar hali tasdiqlanmagan bo'lsa) yoki lab boshlig'i/admin (tasdiqlangan bo'lsa ham) o'chira oladi.

### Reyestr (Registry) — tasdiqlangan namunalar arxivi

`/registry` sahifasi — **barcha `approved` namunalarning qidiriladigan arxivi**. Bu sahifa avvalgi alohida "Protokollar ro'yxati" sahifasining o'rnini bosdi (`/protocols` va `/protocols/:id` yo'llari endi avtomatik `/registry` ga yo'naltiriladi).

Filtrlar: namuna turi, modda nomi, seriya raqami, lot raqami, tasdiqlangan sana oralig'i (DD.MM.YYYY formatida). Har bir qatordan:
- Namuna tafsilotlariga o'tish mumkin (`/registry/:id`),
- Protokol faylini to'g'ridan-to'g'ri yuklab olish mumkin,
- Lab boshlig'i namunani reyestrdan o'chira oladi.

Protokolni **to'ldirish/yuklash** jarayoni endi alohida "Protokollar" bo'limida emas, balki **namunaning o'z sahifasida** (`ProtocolSection` komponenti) amalga oshiriladi.

---

## 4. Protokollar

### Protokol nima?

Protokol — bir namunaning tahlil natijalarini o'z ichiga olgan rasmiy hujjat. Qo'lda qiymat kiritish o'rniga **fayl yuklash** asosida ishlaydi (tahlil hisobotining o'zi PDF/Word/rasm ko'rinishida biriktiriladi).

### Protokol holatlari

```
draft (qoralama)
    │  Kimyogar fayl yuklaydi, keyin yuboradi
    ▼
submitted (ko'rib chiqilmoqda)
    │
    ├──▶ approved (tasdiqlangan)  [Lab boshlig'i]
    │         │  Direktor yakunlaydi
    │         ▼
    │      finalized (yakunlangan)
    │
    └──▶ rejected (rad etilgan)   [Lab boshlig'i, sabab bilan]
```

### Bir namunaga bir nechta protokol — `finished_product` uchun maxsus qoida

Odatda bitta namunaga bitta protokol biriktiriladi (`protocol_role = standard`). Lekin **tayyor mahsulot** (`finished_product`) uchun ikkita alohida protokol bo'lishi mumkin:

| `protocol_role` | Ma'nosi |
|---|---|
| `standard` | Oddiy namunalar uchun yagona protokol |
| `final` | Tayyor mahsulotning yakuniy tahlili |
| `in_process` | Ishlab chiqarish jarayonidagi oraliq tahlil |

### Fayllar protokolda

Protokolga bir nechta turdagi fayl biriktirilishi mumkin:

| Fayl turi | Tavsif |
|---|---|
| Asosiy fayl (`file_*`) | Tahlil natijasi hisoboti — yuborish uchun **majburiy** |
| Protokol pasporti (`passport_*`) | Protokolning o'ziga biriktiriladigan qo'shimcha hujjat — bu **namuna pasportidan (yuqoriga qarang) mustaqil**, alohida tasdiqlash oqimi yo'q, chemist/lab_head/admin/kontrolyor yuklashi mumkin |
| Qo'shimcha fayllar (`protocol_files`) | `finished_product` ko'p-protokol holatida bitta protokolga bir nechta qo'shimcha fayl biriktirish (ro'yxat, alohida yuklab olish/o'chirish) |

**Ruxsat etilgan formatlar:** PDF, Word (`.doc`, `.docx`), JPEG, PNG. **Maksimal hajm:** 20 MB. Asosiy fayl yangilansa — eskisi almashtiriladi. Yuklab olish: `GET /api/v1/protocols/:id/file`.

### Word (.docx) formatida eksport

`GET /api/v1/protocols/:id/export` — protokol ma'lumotlarini (holat, imzolar, moddaning nomi va h.k.) formatlashtirilgan `.docx` hujjatiga aylantirib, yuklab beradi (`docx` kutubxonasi, `src/utils/docxExport.ts`). Bu — kimyogar yuklagan tahlil faylidan farqli, tizim tomonidan avtomatik generatsiya qilinadigan rasmiy hisobot.

### Kirish huquqi (ruxsat modeli)

Kimyogar protokolga kirish uchun: `protocol.created_by === kimyogar.id` **YOKI** `sample.assigned_to === kimyogar.id`. Sababi — protokolni odatda lab boshlig'i yaratadi, lekin u kimyogarga tegishli bo'ladi.

### Imzolar

Har bir bosqichda imzo qo'yiladi: kimyogar (yuborishda), lab boshlig'i (tasdiqlashda), direktor (yakunlashda).

---

## 5. Moddalar (Substances)

Modda — laboratoriyada tekshiriladigan kimyoviy yoki farmatsevtik preparat.

- **Nom:** `name_uz`, `name_ru`, `name_en` (uch tilda; bazada yagona `name` ustuni yo'q).
- **Farmakopiya:** EP, BP, UzDSt, USP, OTHER.
- **CAS raqami** (ixtiyoriy).
- **Parametrlar:** har biri uchun nomi, o'lchov birligi, min/max chegara, metod.

Yaratish/tahrirlash: `lab_head`, `admin`. Ko'rish: barcha rollar. Sahifa asosiy navigatsiyada emas — namuna yaratishda va modda havolalari orqali ochiladi.

---

## 6. Reaktivlar va Xarajat jurnali

Reaktiv — tahlil uchun ishlatiladigan kimyoviy modda, zaxirasi kuzatiladi.

| Maydon | Tavsif |
|---|---|
| `quantity` | Joriy zaxira |
| `low_stock_threshold` | Shundan kam bo'lsa — ogohlantirish |
| `expires_at` | Yaroqlilik muddati |
| `is_hazardous` | Xavfli modda belgisi |

Har bir zaxira o'zgarishi (`in`, `out`, `adjustment`, `disposal`) `reagent_transactions` jadvalida loglanadi. **Xarajat jurnali** (`/reagents/journal`) va **xarajatlar ro'yxati** (`/expenses`) sahifalari orqali sarf-xarajatni kalendar/ro'yxat ko'rinishida kuzatish mumkin. Reaktivga passport va tahlil natijasi hujjatlari (`reagent_documents`) biriktiriladi.

`is_low_stock` va `is_expired` bayroqlari dashboardda ko'rsatiladi.

---

## 7. Harorat monitoringi

Sensorlar harorat/namlik ko'rsatkichlarini yuboradi (yoki qo'lda kiritiladi — `is_manual`). Har bir sensor uchun min/max chegara belgilanadi (`sensor_configs`).

Chegaradan chiqsa `temperature_alerts` yozib qo'yiladi va dashboardda "Harorat alertlari" ko'rsatiladi.

---

## 8. Stabilizatsiya tekshiruvi

### Nima uchun kerak?

Tasdiqlangan namunalar vaqt o'tishi bilan kimyoviy o'zgarishi mumkin — buni belgilangan muddatlarda takroriy tahlil orqali kuzatish uchun ishlatiladi.

### Shart

Faqat `status = approved` namunalar uchun boshlanishi mumkin — namuna turi cheklanmagan (barcha turlar uchun ruxsat).

### Moslashuvchan checkpointlar

Avval checkpointlar faqat T3/T6/T12 (3/6/12 oy) bilan cheklangan edi. Hozir **lab boshlig'i checkpointlarni qo'lda, ixtiyoriy nom va sanada kiritadi** (masalan T9, T18, T24) — har bir dori/mahsulot uchun turlicha muddat belgilash mumkin. Bir tekshiruv (study) ichida bir xil nomdagi ikkita checkpoint bo'lishi mumkin emas.

```
[Tasdiqlangan namuna]
         │  Lab boshlig'i / direktor / admin boshlaydi
         ▼
  stability_study (active)
         │  Checkpointlar (ixtiyoriy nom + sana) qo'lda kiritiladi
         ├──▶ Checkpoint 1 — pending
         ├──▶ Checkpoint 2 — pending
         └──▶ ...
```

### Checkpoint holatlari

```
pending → in_progress → overdue (muddat o'tsa, fon jarayoni belgilaydi) → completed
```

### Natijalar

Har bir checkpoint uchun bir nechta parametr natijasi: `parameter`, `initial_value` (T0), `current_value`, `specification`, `result_status` (`pass`/`warning`/`fail`). 5 ta standart parametr oldindan to'ldiriladi, qo'shimcha qo'shish/olib tashlash mumkin.

### Fon jarayoni

Har **6 soatda** ishga tushadi: muddati o'tgan checkpointlarni `overdue` belgilaydi + bildirishnoma yuboradi; 14 kun ichida muddati yetadiganlar uchun `stability_due_soon` bildirishnoma (24 soatda bir marta).

---

## 9. Xabarnomalar — real vaqtli va Telegram

### Turlari

| Tur | Qachon yuboriladi |
|---|---|
| `sample_assigned` | Kimyogarga namuna biriktirilganda |
| `sample_approved` / `sample_rejected` | Namuna tasdiqlanganda/rad etilganda |
| `protocol_submitted` | Kimyogar protokolni yuborganda |
| `protocol_approved` / `protocol_rejected` | Protokol tasdiqlanganda/rad etilganda |
| `temperature_alert` | Harorat chegaradan chiqqanda |
| `low_stock` | Reaktiv zaxirasi kam qolganda |
| `stability_due_soon` / `stability_overdue` | Checkpoint muddati yaqinlashganda/o'tganda |

### Yetkazish kanallari

1. **Bazaga yozish** — `notifications` jadvali, ekranning yuqori o'ng burchagidagi bell ikonasi orqali ko'rinadi.
2. **Real vaqtli push** — Socket.IO orqali. Har bir foydalanuvchi ulanishda o'zining `user:<id>` xonasiga qo'shiladi; yangi bildirishnoma `notification:new` hodisasi bilan brauzerga to'g'ridan-to'g'ri, sahifani yangilamasdan yetib boradi (React Query keshiga yoziladi + toast ko'rsatiladi). Socket handshake xuddi REST so'rovlar kabi JWT access-token bilan tasdiqlanadi.
3. **Telegram push** — foydalanuvchi Telegram akkauntini ulagan bo'lsa, bot orqali xabar yuboriladi (pastga qarang).

---

## 10. Foydalanuvchilar, Admin panel, Ruxsatlar

**Admin panel** (`/users`, `lab_head`/`director`/`admin` uchun ochiq): foydalanuvchilar ro'yxati va statistikasi, yangi foydalanuvchi yaratish, parolni tiklash, foydalanuvchi loglarini ko'rish.

**Individual ruxsatlar** — rol asosidagi ruxsatlardan tashqari `user_permissions` jadvali orqali `resource`+`action` darajasida qo'shimcha huquq berish/olib tashlash mumkin (`requirePermission` middleware, natija so'rov davomida keshlanadi).

Har bir foydalanuvchi o'z profilida (`/profile`) parolini o'zgartira oladi, Telegram akkauntini ulay/uzay oladi.

---

## 11. Audit va Faoliyat jurnali

Ikki xil jurnal mavjud:

| Sahifa | Kim ko'radi | Ko'lami |
|---|---|---|
| **Audit jurnali** (`/logs`) | `super_admin` | Butun platforma — barcha kompaniyalar bo'yicha tizim darajasidagi hodisalar |
| **Faoliyat jurnali** (`/activity`) | `lab_head`, `director`, `admin` | Faqat o'z kompaniyasi ichidagi foydalanuvchi harakatlari |

Ikkalasi ham backend'da bitta `audit` modulida joylashgan (`audit.router.ts` — global, `activity.router.ts` — kompaniya bo'yicha filtrlangan).

---

## 12. Fayllarni saqlash

Fayllar (protokol hujjatlari, pasportlar, reaktiv hujjatlari) **Cloudflare R2** (S3-mos ob'ekt xotirasi) da saqlanadi — `@aws-sdk/client-s3` orqali. Backend `files` moduli generic yuklash/ro'yxat/imzolangan-URL/o'chirish funksiyalarini taqdim etadi (`multer` xotira-saqlash bilan, max 50MB, PDF/Word/JPEG/PNG cheklovi bilan). `R2_*` muhit o'zgaruvchilari orqali sozlanadi.

---

## 13. Telegram integratsiyasi

Ikki qatlamli arxitektura:

- **Bot** (`grammy` kutubxonasi) — akkaunt ulash, push-bildirishnomalar, `/start`, `/help`, `/status`, `/unlink` buyruqlari.
- **Mini App** — mavjud React frontend Telegram WebApp sifatida ochiladi (mobil qurilmada Telegram ilovasi ichida to'liq LIMS).

**Auth oqimlari:**
1. Birinchi ulash: veb-login → Profil → "Telegram ulash" → `POST /telegram/link-token` → bot `/start <token>`.
2. WebApp login: Telegram WebApp `initData` → `POST /telegram/webapp-auth` (HMAC-SHA256 tekshiruvi bilan) → avtomatik kirish.
3. Push-bildirishnomalar: `createNotification()` chaqirilganda DB yozuvi bilan birga Telegram orqali ham yuboriladi (fire-and-forget).

**Sozlash:** @BotFather orqali token olish → `.env` ga `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` → dasturlash muhitida polling avtomatik ishga tushadi, production'da `TELEGRAM_WEBHOOK_URL`+`TELEGRAM_WEBHOOK_SECRET` kerak.

---

## 14. Ko'p tillilik (i18n)

Uch til: **o'zbek (standart), rus, ingliz** — `i18next` + `react-i18next` orqali. Tarjima fayllari `src/i18n/locales/` da. Har bir sahifada `useTranslation()` dan `t('key')` ishlatiladi — JSX ichida qattiq yozilgan matn bo'lmasligi kerak. Til `localStorage` da saqlanadi, tanlash top bar'dagi til almashtirgichi orqali.

---

## 15. Autentifikatsiya va xavfsizlik

### Token tizimi (ikki tokenli)

| Token | Davomiyligi | Joylashuvi |
|---|---|---|
| Access token (JWT) | 30 daqiqa | `Authorization: Bearer ...`, har so'rovda |
| Refresh token (JWT) | 7 kun | HTTP-only cookie, faqat `/auth/refresh` da |

Refresh token bazada xom holda emas, faqat `SHA-256` xeshi saqlanadi (`sessions` jadvali); har refresh'da token rotatsiya qilinadi. Bir foydalanuvchi bir vaqtda **3 ta** aktiv sessiyaga ega bo'lishi mumkin — 4-chisi eskisini avtomatik o'chiradi. Uzoq harakatsizlikda (`SESSION_IDLE_TIMEOUT_MINUTES`, standart 30 daqiqa) sessiya avtomatik tugaydi.

Access token va Socket.IO handshake bitta funksiyadan (`verifyAccessToken`) foydalanadi — ikkalasi ham bir xil tarzda tasdiqlanadi.

### Parol

bcrypt (10 round) bilan xeshlangan. Foydalanuvchi o'z parolini o'zgartira oladi, admin boshqa foydalanuvchi parolini tiklashi mumkin.

### Boshqa himoya choralari

- `helmet` — HTTP xavfsizlik sarlavhalari.
- Global rate-limit — 15 daqiqada IP boshiga 2000 so'rov (faqat production'da).
- Zod orqali barcha kiruvchi ma'lumotlar va muhit o'zgaruvchilari validatsiyasi.

---

## 16. Texnik arxitektura

### Backend

```
Express.js + TypeScript + PostgreSQL (raw pg, ORM yo'q)
├── src/
│   ├── app.ts                    # Entry point, middleware, router ulash, Socket.IO va botni ishga tushirish
│   ├── config/
│   │   ├── database.ts           # pg pool, query() va withTransaction()
│   │   ├── env.ts                # Zod bilan env validatsiyasi (cloud DB yoki lokal, R2, Telegram)
│   │   └── swagger.ts            # API docs
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT tekshiruv, requireRole(), requireCompany(), requirePermission()
│   │   ├── sessionTimeout.ts     # Harakatsizlikda sessiyani tugatish
│   │   └── errorHandler.ts       # Markazlashtirilgan xato handler
│   ├── modules/
│   │   ├── auth/                 # Login, logout, refresh, me
│   │   ├── admin/                # Foydalanuvchilar CRUD, ruxsatlar, statistikasi (kompaniya darajasida)
│   │   ├── companies/            # Kompaniyalar CRUD (faqat super_admin)
│   │   ├── substances/           # Moddalar + parametrlar
│   │   ├── protocols/            # Protokollar + fayl/pasport yuklash + imzolar
│   │   ├── samples/              # Namunalar + biriktirish + to'xtatish
│   │   ├── reagents/             # Reaktivlar + tranzaksiyalar
│   │   ├── temperature/          # Sensorlar + o'qishlar + alertlar
│   │   ├── stability/            # Stabilizatsiya + ixtiyoriy checkpointlar + natijalar
│   │   ├── notifications/        # Xabarnomalar (DB + socket + Telegram)
│   │   ├── dashboard/            # Rol bo'yicha dashboard statistikasi
│   │   ├── files/                # Cloudflare R2 fayl saqlash (generic)
│   │   ├── audit/                # Audit (platforma) va Activity (kompaniya) jurnallari
│   │   └── telegram/             # Bot + Mini App autentifikatsiyasi
│   ├── realtime/
│   │   └── socket.ts             # Socket.IO server, JWT handshake, user:<id> xonalar
│   ├── jobs/
│   │   └── stabilityAlertJob.ts  # 6 soatlik fon jarayoni
│   ├── db/
│   │   └── migrations/           # 001..038 raqamlangan SQL migratsiyalar
│   └── utils/
│       └── logger.ts             # Winston logger
```

Har bir modul bir xil naqshda: `*.router.ts` (Express Router + Swagger annotatsiya), `*.controller.ts` (parse/validate + chaqirish), `*.service.ts` (barcha SQL va biznes-logika, domen xato klassi bilan), `*.schemas.ts` (Zod sxemalar).

### Frontend

```
React + TypeScript + Vite + Tailwind CSS
├── src/
│   ├── api/                      # Axios client + har modul uchun funksiyalar
│   │   ├── client.ts             # Axios instance + 401 interceptor + token refresh navbati
│   │   ├── companies.ts, admin.ts, auditLogs.ts, dashboard.ts, notifications.ts, telegram.ts, ...
│   ├── hooks/                    # React Query hooks (har modul uchun)
│   │   └── useNotificationSocket.ts  # Socket.IO ulanishi va real vaqtli yangilash
│   ├── lib/socket.ts             # Socket.IO client ulanish/uzish
│   ├── pages/
│   │   ├── auth/, dashboard/ (+_dashboards: Chemist/Director/LabHead/Inspector/SuperAdmin)
│   │   ├── samples/, registry/ (Reyestr — tasdiqlangan namunalar arxivi)
│   │   ├── substances/, reagents/ (+ expenses/journal), temperature/, stability/
│   │   ├── companies/ (+SuperAdminDashboard), logs/ (Audit), activity/ (Faoliyat)
│   │   └── users/
│   ├── store/authStore.ts        # Zustand — foydalanuvchi, token
│   ├── i18n/locales/             # uz.json, ru.json, en.json
│   ├── components/layout/        # AppLayout, Sidebar (rol bo'yicha, super_admin uchun alohida menyu)
│   ├── components/ui/            # Table, Modal, Spinner, Pagination, NotificationBell
│   └── types/index.ts            # Barcha TypeScript interfeyslari
```

> **Eslatma:** Moddalar, Reaktivlar va Stabilizatsiya sahifalari asosiy yon menyuda (Sidebar) endi ko'rsatilmaydi — ular namuna sahifasi va ichki havolalar orqali ochiladi (menyu soddalashtirilgan: Dashboard, Namunalar, Reyestr, Harorat, Foydalanuvchilar, Faoliyat).

### Ma'lumotlar bazasi (PostgreSQL)

| Jadval | Tavsif |
|--------|--------|
| `companies` | Platformadagi kompaniyalar (multi-tenancy) |
| `users` | Foydalanuvchilar (`company_id`, Telegram bog'lanish maydonlari bilan) |
| `sessions` | Refresh token sessiyalari (hash ko'rinishda) |
| `user_permissions` | Individual ruxsatlar |
| `telegram_link_tokens` | Telegram akkaunt ulash tokenlari |
| `substances` / `substance_parameters` | Moddalar va ularning parametrlari |
| `protocols` / `protocol_values` / `protocol_signatures` | Protokollar, qiymatlar (eski tuzilma), imzolar |
| `samples` / `sample_tracking` | Namunalar va voqealar tarixi |
| `reagents` / `reagent_transactions` / `reagent_documents` | Reaktivlar, tranzaksiyalar, hujjatlar |
| `sensor_configs` / `temperature_readings` / `temperature_alerts` | Harorat monitoringi |
| `stability_studies` / `stability_checkpoints` / `stability_results` | Stabilizatsiya |
| `notifications` | Tizim xabarnomalari |
| `files` | Cloudflare R2'dagi generic fayllar metama'lumoti |
| `audit_log` | Tizim darajasidagi audit yozuvlari |

### Migratsiyalar

`001`dan `038`gacha raqamlangan SQL fayllar (`npm run migrate` bilan qo'llaniladi, `schema_migrations` jadvalida kuzatiladi). Asosiy bosqichlar: asosiy jadvallar (001–013) → protokol fayllari (014) → namuna turlari kengaytirilishi va ko'p-protokol (017, 029) → kompaniyalar/multi-tenancy (021–023) → protokol pasporti (026–027) → notification turlari (028, 037) → Telegram (032–033) → generic fayllar/R2 (034) → moslashuvchan stabilizatsiya checkpointlari (036).

### Infratuzilma

- **Ma'lumotlar bazasi:** cloud PostgreSQL (Neon/Railway/Supabase — `DATABASE_URL` orqali) yoki lokal PostgreSQL.
- **Fayl xotira:** Cloudflare R2 (S3-mos).
- **Real vaqtli aloqa:** Socket.IO (bir xil HTTP server ustida).
- **Bildirishnoma kanali:** Telegram Bot API (`grammy`).
- **API hujjatlari:** Swagger UI, faqat `development` muhitida, login formasi bilan.

---

## 17. Asosiy ish oqimi (boshidan oxirigacha)

```
1. Kontrolyor → namuna kiritadi (tur, lot, seriya raqam)
        │
2. Lab boshlig'i → Kimyogar X ga biriktiradi
        │        → Protokol avtomatik yaratiladi
        │        → Kimyogarga xabar (ekran + real vaqtli + Telegram)
        │
3. Kimyogar → Namuna sahifasida tahlil faylini yuklaydi → yuboradi → submitted
        │
4. Lab boshlig'i → Protokolni ko'rib chiqadi → tasdiqlaydi → Namuna: approved
        │
5. Direktor → Protokolni yakunlaydi (finalized)
        │
6. Namuna → Reyestrga (approved arxiv) tushadi, istalgan vaqt qidirish/yuklab olish mumkin
        │
7. Lab boshlig'i / Direktor → istasa "Stabilizatsiya boshlash" → checkpointlarni qo'lda belgilaydi
        │
8. Fon jarayoni → muddat yaqinlashganda/o'tganda avtomatik bildirishnoma
        │
9. Kimyogar → har checkpoint uchun natija kiritadi → tekshiruv yakunlanadi
```

---

## 18. O'zgarishlar tarixi

### 2026-yil iyun — Protokol tizimi fayl yuklashga o'tdi

- Qo'lda parametr kiritish olib tashlandi, fayl yuklash joriy qilindi (max 20MB, PDF/Word/JPEG/PNG).
- Protokol ruxsat modeli tuzatildi (`sample.assigned_to` orqali ham kirish huquqi).
- Kimyogar dashboardi qayta yozildi, stabilizatsiya tur cheklovlari olib tashlandi.

### 2026-yil iyun (18-sana) — Telegram integratsiyasi

- Bot (grammy) + Mini App qo'shildi: akkaunt ulash, WebApp orqali avtomatik kirish, push-bildirishnomalar.

### Keyingi yirik yangilanishlar (iyundan keyin)

- **Ko'p-kompaniyali arxitektura** — `companies` jadvali, `super_admin` roli, kompaniya bo'yicha ma'lumot izolyatsiyasi, individual foydalanuvchi ruxsatlari (`user_permissions`).
- **Real vaqtli bildirishnomalar** — Socket.IO orqali sahifani yangilamasdan yangi xabarlar.
- **Reyestr (Registry)** — eski "Protokollar ro'yxati" o'rniga qidiriladigan, filtrlanadigan tasdiqlangan namunalar arxivi; alohida Protokollar sahifasi olib tashlandi.
- **Fayllarni Cloudflare R2'ga ko'chirish** — mahalliy disk o'rniga bulutli ob'ekt xotira, generic `files` moduli.
- **Moslashuvchan stabilizatsiya checkpointlari** — qattiq T3/T6/T12 o'rniga ixtiyoriy nom/sana bilan qo'lda belgilash.
- **Protokol pasporti** — asosiy tahlil faylidan tashqari alohida "pasport" hujjati biriktirish imkoniyati.
- **Audit va Faoliyat jurnallari** — platforma darajasidagi audit (super_admin) va kompaniya darajasidagi faoliyat jurnali (lab_head/director/admin) ajratildi.
- **Ko'p tillilik (i18n)** — uz/ru/en, `i18next` orqali butun interfeys bo'ylab.
- **Boshqa namuna turlari** — `reagent`, `standard_substance`, `other` turlari qo'shildi.
- **Reaktiv xarajat jurnali** — sarf-xarajatni kalendar va ro'yxat ko'rinishida kuzatish sahifalari.

---

### Aniqlashtirish — namuna pasporti va protokol pasporti ikki xil narsa

Kodni qayta tekshirishda ma'lum bo'ldiki, "pasport" aslida **ikkita mustaqil funksiya**:
- **Namuna pasporti** (`samples.passport_*`, 3-bo'limda tasvirlangan) — `reagent`/`standard_substance` uchun tasdiqlashning yagona yo'li (protokolni bypass qiladi), `raw_material`/`finished_product` uchun esa qo'shimcha hujjat xolos.
- **Protokol pasporti** (`protocols.passport_*`, 4-bo'limda tasvirlangan) — protokolning o'ziga biriktiriladigan alohida qo'shimcha fayl, tasdiqlash oqimi yo'q.

Bundan tashqari protokolni **Word (.docx) formatida eksport qilish** (`GET /protocols/:id/export`) va `finished_product` uchun protokolga bir nechta **qo'shimcha fayl** biriktirish imkoniyati ham mavjud — bular avvalgi versiyada tushib qolgan edi.

---

*Hujjat oxirgi yangilandi: 2026-yil 17-sentabr — joriy kod holatiga (backend 38 migratsiya, frontend to'liq tuzilma) asosan qayta yozildi, so'ng pasport/DOCX-eksport tafsilotlari kod bo'yicha tekshirilib aniqlashtirildi.*
