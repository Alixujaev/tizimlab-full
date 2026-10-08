# SPEC_CHECKLIST — barcha tekshiriladigan talablar

"Hech narsa tushib qolmasin" kafolati. Har qator — bitta tekshiriladigan talab.

- **Holat:** `[ ]` boshlanmagan · `[~]` jarayonda · `[x]` kod + test bor.
- **Faza:** P1 poydevor · P2 auth/users/companies/permissions · P3 substances · P4 samples/registry · P5 files+protocols ·
  P6 notifications+dashboard · P7 reagents · P8 temperature · P9 stability+job · P10 audit/activity · P11 telegram · P12 E2E/xavfsizlik/deploy/ETL.
- **Manba:** `docs/spec/<fayl> §<bo'lim>` yoki `DECISIONS.md D-NN`. Noaniq joylar `OPEN_QUESTIONS.md` dagi `Q-NN` ga havola qilingan.
- Qator faqat spec yoki DECISIONS'da yozilgan narsani ifodalaydi. Yangi talab qo'shilsa — avval spec/DECISIONS yangilanadi.

## ROLE — Rollar va ruxsat matritsasi

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-ROLE-01 | Tizimda aynan 6 ta rol mavjud: `super_admin`, `kontrolyor`, `chemist`, `lab_head`, `director`, `admin`. | 01-roles §1 | P2 | [ ] |
| R-ROLE-02 | `super_admin` hech qaysi kompaniyaga bog'lanmagan (`company_id = null`). | 01-roles §1 | P2 | [ ] |
| R-ROLE-03 | `super_admin` dan boshqa barcha rollar bitta kompaniyaga bog'langan (`company_id` majburiy). | 01-roles §1, 02 §2 | P2 | [ ] |
| R-ROLE-04 | `super_admin` oddiy ish oqimlarida (namuna, protokol va h.k.) qatnashmaydi — kompaniya ichidagi modul endpointlari unga yopiq. | 01-roles §1 | P2 | [ ] |
| R-ROLE-05 | `super_admin` interfeysi butunlay boshqacha: faqat **Kompaniyalar** va **Audit jurnali** sahifalarini ko'radi (`SuperAdminDashboard`). | 01-roles §1 | P2 | [ ] |
| R-ROLE-06 | `super_admin` kompaniyalarni yaratadi/faollashtiradi. | 01-roles §1 | P2 | [ ] |
| R-ROLE-07 | `super_admin` barcha kompaniyalar bo'yicha audit jurnalini ko'radi. | 01-roles §1 | P10 | [ ] |
| R-ROLE-08 | Namuna yaratish: `kontrolyor` — RUXSAT. | 01-roles §1 | P4 | [ ] |
| R-ROLE-09 | Namuna yaratish: `chemist` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-10 | Namuna yaratish: `lab_head` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-11 | Namuna yaratish: `director` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-12 | Namuna yaratish: `admin` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-13 | Namuna ko'rish: `kontrolyor` — faqat o'zi yaratganlar. | 01-roles §1 | P4 | [ ] |
| R-ROLE-14 | Namuna ko'rish: `chemist` — faqat o'ziga biriktirilganlar. | 01-roles §1 | P4 | [ ] |
| R-ROLE-15 | Namuna ko'rish: `lab_head` — kompaniyaning hammasi. | 01-roles §1 | P4 | [ ] |
| R-ROLE-16 | Namuna ko'rish: `director` — kompaniyaning hammasi. | 01-roles §1 | P4 | [ ] |
| R-ROLE-17 | Namuna ko'rish: `admin` — kompaniyaning hammasi. | 01-roles §1 | P4 | [ ] |
| R-ROLE-18 | Kimyogarga biriktirish: `kontrolyor` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-19 | Kimyogarga biriktirish: `chemist` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-20 | Kimyogarga biriktirish: `lab_head` — RUXSAT. | 01-roles §1 | P4 | [ ] |
| R-ROLE-21 | Kimyogarga biriktirish: `director` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-22 | Kimyogarga biriktirish: `admin` — TAQIQ. | 01-roles §1 | P4 | [ ] |
| R-ROLE-23 | Protokol fayl yuklash: `kontrolyor` — TAQIQ (asosiy fayl; protokol pasporti alohida — R-PROTO-31). | 01-roles §1 | P5 | [ ] |
| R-ROLE-24 | Protokol fayl yuklash: `chemist` — RUXSAT. | 01-roles §1 | P5 | [ ] |
| R-ROLE-25 | Protokol fayl yuklash: `lab_head` — RUXSAT. | 01-roles §1 | P5 | [ ] |
| R-ROLE-26 | Protokol fayl yuklash: `director` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-27 | Protokol fayl yuklash: `admin` — RUXSAT. | 01-roles §1 | P5 | [ ] |
| R-ROLE-28 | Protokol tasdiqlash: `kontrolyor` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-29 | Protokol tasdiqlash: `chemist` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-30 | Protokol tasdiqlash: `lab_head` — RUXSAT. | 01-roles §1 | P5 | [ ] |
| R-ROLE-31 | Protokol tasdiqlash: `director` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-32 | Protokol tasdiqlash: `admin` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-33 | Protokol yakunlash: `kontrolyor` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-34 | Protokol yakunlash: `chemist` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-35 | Protokol yakunlash: `lab_head` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-36 | Protokol yakunlash: `director` — RUXSAT. | 01-roles §1 | P5 | [ ] |
| R-ROLE-37 | Protokol yakunlash: `admin` — TAQIQ. | 01-roles §1 | P5 | [ ] |
| R-ROLE-38 | Reyestrni ko'rish: `kontrolyor` — RUXSAT, kompaniyaning barcha `approved` namunalari (tafsilotlari bilan). | 01-roles §1, DECISIONS.md D-31 | P4 | [ ] |
| R-ROLE-39 | Reyestrni ko'rish: `chemist` — RUXSAT, kompaniyaning barcha `approved` namunalari (tafsilotlari bilan). | 01-roles §1, DECISIONS.md D-31 | P4 | [ ] |
| R-ROLE-40 | Reyestrni ko'rish: `lab_head` — RUXSAT. | 01-roles §1 | P4 | [ ] |
| R-ROLE-41 | Reyestrni ko'rish: `director` — RUXSAT. | 01-roles §1 | P4 | [ ] |
| R-ROLE-42 | Reyestrni ko'rish: `admin` — RUXSAT. | 01-roles §1 | P4 | [ ] |
| R-ROLE-43 | Moddalar: `kontrolyor` — faqat ko'rish (yaratish/tahrirlash TAQIQ). | 01-roles §1 | P3 | [ ] |
| R-ROLE-44 | Moddalar: `chemist` — faqat ko'rish (yaratish/tahrirlash TAQIQ). | 01-roles §1 | P3 | [ ] |
| R-ROLE-45 | Moddalar: `lab_head` — ko'rish + yaratish + tahrirlash; o'chirish — TAQIQ. | 01-roles §1, 05 §5, DECISIONS.md D-30 | P3 | [ ] |
| R-ROLE-46 | Moddalar: `director` — faqat ko'rish (yaratish/tahrirlash TAQIQ). | 01-roles §1 | P3 | [ ] |
| R-ROLE-47 | Moddalar: `admin` — to'liq. | 01-roles §1 | P3 | [ ] |
| R-ROLE-48 | Reaktivlar: `kontrolyor` — faqat ko'rish. | 01-roles §1 | P7 | [ ] |
| R-ROLE-49 | Reaktivlar: `chemist` — faqat ko'rish. | 01-roles §1 | P7 | [ ] |
| R-ROLE-50 | Reaktivlar: `lab_head` — to'liq. | 01-roles §1 | P7 | [ ] |
| R-ROLE-51 | Reaktivlar: `director` — faqat ko'rish. | 01-roles §1 | P7 | [ ] |
| R-ROLE-52 | Reaktivlar: `admin` — to'liq. | 01-roles §1 | P7 | [ ] |
| R-ROLE-53 | Harorat: `kontrolyor` — faqat ko'rish. | 01-roles §1 | P8 | [ ] |
| R-ROLE-54 | Harorat: `chemist` — faqat ko'rish. | 01-roles §1 | P8 | [ ] |
| R-ROLE-55 | Harorat: `lab_head` — to'liq. | 01-roles §1 | P8 | [ ] |
| R-ROLE-56 | Harorat: `director` — faqat ko'rish. | 01-roles §1 | P8 | [ ] |
| R-ROLE-57 | Harorat: `admin` — to'liq. | 01-roles §1 | P8 | [ ] |
| R-ROLE-58 | Stabilizatsiya boshlash: `kontrolyor` — TAQIQ. | 01-roles §1 | P9 | [ ] |
| R-ROLE-59 | Stabilizatsiya boshlash: `chemist` — TAQIQ. | 01-roles §1 | P9 | [ ] |
| R-ROLE-60 | Stabilizatsiya boshlash: `lab_head` — RUXSAT. | 01-roles §1 | P9 | [ ] |
| R-ROLE-61 | Stabilizatsiya boshlash: `director` — RUXSAT. | 01-roles §1 | P9 | [ ] |
| R-ROLE-62 | Stabilizatsiya boshlash: `admin` — RUXSAT. | 01-roles §1 | P9 | [ ] |
| R-ROLE-63 | Stabilizatsiya natija kiritish: `kontrolyor` — TAQIQ. | 01-roles §1 | P9 | [ ] |
| R-ROLE-64 | Stabilizatsiya natija kiritish: `chemist` — faqat checkpointga biriktirilgan (`assigned_to`) bo'lsa RUXSAT. | 01-roles §1, DECISIONS.md D-53 | P9 | [ ] |
| R-ROLE-65 | Stabilizatsiya natija kiritish: `lab_head` — RUXSAT. | 01-roles §1 | P9 | [ ] |
| R-ROLE-66 | Stabilizatsiya natija kiritish: `director` — RUXSAT. | 01-roles §1 | P9 | [ ] |
| R-ROLE-67 | Stabilizatsiya natija kiritish: `admin` — RUXSAT. | 01-roles §1 | P9 | [ ] |
| R-ROLE-68 | Foydalanuvchilar boshqaruvi: `kontrolyor` — TAQIQ. | 01-roles §1 | P2 | [ ] |
| R-ROLE-69 | Foydalanuvchilar boshqaruvi: `chemist` — TAQIQ. | 01-roles §1 | P2 | [ ] |
| R-ROLE-70 | Foydalanuvchilar boshqaruvi: `lab_head` — RUXSAT, faqat `kontrolyor`/`chemist` rollaridagi foydalanuvchilar uchun. | 01-roles §1, DECISIONS.md D-16 | P2 | [ ] |
| R-ROLE-71 | Foydalanuvchilar boshqaruvi: `director` — faqat ko'rish (yaratish/tahrirlash/parol tiklash TAQIQ). | 01-roles §1 | P2 | [ ] |
| R-ROLE-72 | Foydalanuvchilar boshqaruvi: `admin` — to'liq. | 01-roles §1 | P2 | [ ] |
| R-ROLE-73 | Faoliyat jurnali: `kontrolyor` — TAQIQ. | 01-roles §1 | P10 | [ ] |
| R-ROLE-74 | Faoliyat jurnali: `chemist` — TAQIQ. | 01-roles §1 | P10 | [ ] |
| R-ROLE-75 | Faoliyat jurnali: `lab_head` — RUXSAT. | 01-roles §1 | P10 | [ ] |
| R-ROLE-76 | Faoliyat jurnali: `director` — RUXSAT. | 01-roles §1 | P10 | [ ] |
| R-ROLE-77 | Faoliyat jurnali: `admin` — RUXSAT. | 01-roles §1 | P10 | [ ] |
| R-ROLE-78 | Rol ruxsatlaridan tashqari `user_permissions` orqali individual ruxsat berish mumkin, `requirePermission(resource, action)` bilan tekshiriladi. | 01-roles §1 | P2 | [ ] |
| R-ROLE-79 | Matritsadagi har bir TAQIQ backend'da (403) majburlanadi — faqat UI'da yashirish yetarli emas. | 01-roles §1, 16 §16 | P12 | [ ] |

## TENANT — Ko'p-kompaniyalilik

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-TENANT-01 | `companies` jadvali mavjud (nomi + `slug`, faollik holati). | 02-multitenancy §2, 16 §16 | P2 | [ ] |
| R-TENANT-02 | Har bir `users` yozuvi `company_id` ga ega (super_admin uchun `null`). | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-03 | Har bir asosiy jadval (`samples`, `substances`, `protocols`, `reagents`, ...) kompaniya bo'yicha ajratilgan (`company_id`). | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-04 | JWT access tokenida `company_id` bor. | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-05 | `requireCompany` middleware kompaniya kontekstisiz so'rovlarni bloklaydi. | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-06 | Kompaniyalar sahifasi `/companies` faqat `super_admin` uchun. | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-07 | `super_admin` yangi kompaniya yaratadi (nomi + `slug`). | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-08 | `super_admin` kompaniyani faollashtiradi/nofaollashtiradi (`is_active`); jismoniy o'chirish yo'q. | 02-multitenancy §2, DECISIONS.md D-34 | P2 | [ ] |
| R-TENANT-09 | `super_admin` kompaniyani tahrirlaydi. | 02-multitenancy §2 | P2 | [ ] |
| R-TENANT-10 | Kompaniya boshqa kompaniyalarning ma'lumotini ko'rmaydi (o'z foydalanuvchilari, namunalari, reaktiv va moddalari). | 02-multitenancy §2 | P12 | [ ] |
| R-TENANT-11 | HAR BIR tenant jadvaliga so'rov service'da `company_id` bo'yicha filtrlanadi (ilova darajasida). | DECISIONS.md D-12 | P12 | [ ] |
| R-TENANT-12 | Har fazada yangi tenant endpointlar uchun kompaniyalararo izolyatsiya integration testi yoziladi. | DECISIONS.md D-12 | P2 | [ ] |
| R-TENANT-13 | Barcha tenant endpointlarini qamrab oluvchi yakuniy izolyatsiya integration testi. | DECISIONS.md D-12 | P12 | [ ] |
| R-TENANT-14 | `super_admin` CLI skript bilan yaratiladi (`npm run` buyrug'i). | DECISIONS.md D-35 | P2 | [ ] |
| R-TENANT-15 | Kompaniya yaratishda `super_admin` shu kompaniyaning birinchi `admin` foydalanuvchisini yaratadi; boshqa foydalanuvchilarni yarata olmaydi. | DECISIONS.md D-35 | P2 | [ ] |
| R-TENANT-16 | Nofaollashtirilgan kompaniyani qayta faollashtirish mumkin. | DECISIONS.md D-34 | P2 | [ ] |

## SAMPLE — Namunalar

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-SAMPLE-01 | Namuna turi `raw_material` (Xom ashyo) qo'llab-quvvatlanadi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-02 | Namuna turi `finished_product` (Tayyor mahsulot) qo'llab-quvvatlanadi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-03 | Namuna turi `reagent` qo'llab-quvvatlanadi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-04 | Namuna turi `standard_substance` (Standart namuna) qo'llab-quvvatlanadi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-05 | Namuna turi `other` (Boshqa) qo'llab-quvvatlanadi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-06 | Ro'yxatdan tashqari namuna turi rad etiladi (validatsiya); `sample_type` da faqat §3 dagi 5 tur (`in_process` yo'q). | 03-samples §3, DECISIONS.md D-72 | P4 | [ ] |
| R-SAMPLE-07 | Namuna statusi `pending_assignment` mavjud. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-08 | Namuna statusi `in_progress` mavjud. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-09 | Namuna statusi `stopped` mavjud. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-10 | Namuna statusi `submitted` mavjud. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-11 | Namuna statusi `approved` mavjud. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-12 | Namuna statusi `rejected` mavjud va ishlatiladi (lab_head rad etganda). | 03-samples §3, DECISIONS.md D-14 | P4 | [ ] |
| R-SAMPLE-13 | Kontrolyor yangi namuna yaratadi: modda tanlaydi, lot, seriya raqam, miqdor kiritadi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-14 | Yangi namuna `pending_assignment` holatida yaratiladi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-15 | O'tish `pending_assignment → in_progress`: faqat lab_head, kimyogarga biriktirish orqali. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-16 | Biriktirishda protokol avtomatik `draft` holatida yaratiladi: `finished_product` uchun `final`, boshqa turlar uchun `standard`. | 03-samples §3, DECISIONS.md D-15 | P5 | [ ] |
| R-SAMPLE-17 | Biriktirishda kimyogarga `sample_assigned` xabarnomasi yuboriladi (ekran + real vaqt + Telegram, ulangan bo'lsa). | 03-samples §3, 09 §9 | P6 | [ ] |
| R-SAMPLE-18 | Faqat `chemist` rolidagi o'sha kompaniya foydalanuvchisiga biriktirish mumkin. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-19 | O'tish `in_progress → stopped`: kimyogar "Tahlilni to'xtatish" bilan. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-20 | To'xtatishda sabab majburiy. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-21 | To'xtatish sababi kamida 5 belgi (4 belgi rad etiladi). | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-22 | O'tish `stopped → in_progress`: kimyogar "Davom ettirish" bilan. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-23 | O'tish `in_progress → submitted`: kimyogar protokolni yuborganda (`stopped` dan — taqiq). | 03-samples §3, DECISIONS.md D-36 | P5 | [ ] |
| R-SAMPLE-24 | O'tish `submitted → approved`: lab_head "Tasdiqlash" bilan (protokol tasdiqlanishi orqali). | 03-samples §3 | P5 | [ ] |
| R-SAMPLE-25 | Lab_head "Rad etish" bosganda namuna `rejected` holatida qoladi; sabab saqlanadi va `sample_tracking` ga yoziladi. | 03-samples §3, DECISIONS.md D-14 | P5 | [ ] |
| R-SAMPLE-26 | Diagrammada bo'lmagan o'tishlar rad etiladi (masalan `pending_assignment → submitted`, `approved → in_progress`). | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-27 | Kimyogar faqat o'ziga biriktirilgan namunani to'xtata/davom ettira oladi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-28 | Kimyogar o'ziga biriktirilgan namunalarni ko'radi. | 03-samples §3 | P4 | [ ] |
| R-SAMPLE-29 | Kimyogar protokolga tahlil faylini (PDF/Word/JPEG/PNG) namuna sahifasida yuklaydi. | 03-samples §3 | P5 | [ ] |
| R-SAMPLE-30 | Lab_head `submitted` protokollarni ko'rib chiqadi; tasdiqlansa namuna `approved`, protokolga imzo qo'yiladi. | 03-samples §3 | P5 | [ ] |
| R-SAMPLE-31 | `sample_tracking` jadvalida namuna voqealari tarixi yoziladi (kim, qachon, nima qildi). | 16-architecture §16, 00 §0 | P4 | [ ] |
| R-SAMPLE-32 | Protokolni to'ldirish/yuklash namunaning o'z sahifasida `ProtocolSection` komponentida bajariladi. | 03-samples §3 | P5 | [ ] |
| R-SAMPLE-33 | O'tish `rejected → submitted`: kimyogar faylni yangilab protokolni qayta yuborganda. | DECISIONS.md D-14 | P5 | [ ] |
| R-SAMPLE-34 | `stopped` namunadan protokolni yuborish rad etiladi (avval davom ettirish kerak). | DECISIONS.md D-36 | P5 | [ ] |
| R-SAMPLE-35 | `lab_head` namunani `in_progress`, `stopped`, `rejected` holatlarida boshqa kimyogarga qayta biriktira oladi; boshqa holatlarda — rad etiladi. | DECISIONS.md D-37 | P4 | [ ] |
| R-SAMPLE-36 | Qayta biriktirishda protokol(lar) saqlanib yangi kimyogarga o'tadi; yangi kimyogarga `sample_assigned`, tracking'ga yoziladi. | DECISIONS.md D-37 | P4 | [ ] |
| R-SAMPLE-37 | To'xtatish/davom ettirishni faqat biriktirilgan kimyogar qiladi (`lab_head` ham — taqiq). | DECISIONS.md D-38 | P4 | [ ] |
| R-SAMPLE-38 | Davom ettirishda sabab ixtiyoriy. | DECISIONS.md D-38 | P4 | [ ] |
| R-SAMPLE-39 | `stopped` namunada protokol fayli yuklanmaydi. | DECISIONS.md D-38 | P5 | [ ] |
| R-SAMPLE-40 | Namuna maydonlari — D-68 ro'yxati (sxemadagi `samples` ustunlari); avtomatik namuna kodi yo'q. | DECISIONS.md D-68 | P4 | [ ] |
| R-SAMPLE-41 | `samples` da `expires_at` va `deadline` ustunlari yo'q. | DECISIONS.md D-17, DECISIONS.md D-71 | P4 | [ ] |

## PASS — Namuna pasporti

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-PASS-01 | Namuna pasportini `raw_material`, `finished_product`, `reagent`, `standard_substance` turlariga biriktirish mumkin. | 03-samples §3 | P5 | [ ] |
| R-PASS-02 | `other` turidagi namunaga namuna pasporti biriktirilmaydi (Q-20). | 03-samples §3 | P5 | [ ] |
| R-PASS-03 | Namuna pasporti (`samples.passport_*`) protokol pasportidan (`protocols.passport_*`) alohida ma'lumot va oqim. | 03-samples §3, 18 §18 | P5 | [ ] |
| R-PASS-04 | `reagent`/`standard_substance` uchun pasport — tasdiqlashning yagona yo'li; kimyogar/protokol jarayoni talab qilinmaydi. | 03-samples §3 | P5 | [ ] |
| R-PASS-05 | `reagent`/`standard_substance`: lab_head yuklasa pasport avtomatik `approved`. | 03-samples §3 | P5 | [ ] |
| R-PASS-06 | `reagent`/`standard_substance`: admin yuklasa pasport avtomatik `approved`. | 03-samples §3 | P5 | [ ] |
| R-PASS-07 | Pasport avtomatik `approved` bo'lganda namuna ham darhol `approved` bo'ladi. | 03-samples §3 | P5 | [ ] |
| R-PASS-08 | Pasport orqali tasdiqlanganda namunaning ochiq protokollari `approved` ga o'tkaziladi — imzo va xabarnomasiz, tracking'ga "pasport orqali yopildi". | 03-samples §3, DECISIONS.md D-42 | P5 | [ ] |
| R-PASS-09 | `reagent`/`standard_substance`: kontrolyor (yoki boshqa oddiy foydalanuvchi) yuklasa pasport `pending` holatda qoladi. | 03-samples §3 | P5 | [ ] |
| R-PASS-10 | `pending` pasportni lab_head yoki admin `reviewPassport` bilan tasdiqlaydi. | 03-samples §3 | P5 | [ ] |
| R-PASS-11 | `pending` pasportni lab_head yoki admin rad etadi: pasport `rejected`, sabab majburiy (≥5 belgi) va `sample_tracking` voqeasida saqlanadi, namuna `pending_assignment` da qoladi. | 03-samples §3, DECISIONS.md D-39, DECISIONS.md D-85 | P5 | [ ] |
| R-PASS-12 | NOTO'G'RI HOLAT: foydalanuvchi o'zi yuklagan pasportni o'zi tasdiqlay olmaydi. | 03-samples §3 | P5 | [ ] |
| R-PASS-13 | `pending` pasportni lab_head/admin bo'lmagan foydalanuvchi ko'rib chiqa olmaydi (403). | 03-samples §3 | P5 | [ ] |
| R-PASS-14 | `raw_material`/`finished_product` uchun pasport faqat qo'shimcha hujjat — namuna statusini o'zgartirmaydi, oddiy oqimni bypass qilmaydi. | 03-samples §3 | P5 | [ ] |
| R-PASS-15 | `raw_material`/`finished_product` pasportini kimyogar faqat o'ziga biriktirilgan namunaga yuklay oladi. | 03-samples §3 | P5 | [ ] |
| R-PASS-16 | `raw_material`/`finished_product` pasportini kontrolyor, lab_head, admin yuklay oladi. | 03-samples §3 | P5 | [ ] |
| R-PASS-17 | `raw_material`/`finished_product` pasportini boshqa rollar (director, biriktirilmagan kimyogar) yuklay olmaydi. | 03-samples §3 | P5 | [ ] |
| R-PASS-18 | Pasport fayli Cloudflare R2'da saqlanadi. | 03-samples §3 | P5 | [ ] |
| R-PASS-19 | Pasportni egasi faqat hali tasdiqlanmagan bo'lsa o'chira oladi. | 03-samples §3 | P5 | [ ] |
| R-PASS-20 | Pasportni lab_head/admin (tasdiqlangan bo'lsa ham) o'chira oladi. | 03-samples §3 | P5 | [ ] |
| R-PASS-21 | Tasdiqlangan pasportni egasi (lab_head/admin bo'lmasa) o'chira olmaydi. | 03-samples §3 | P5 | [ ] |
| R-PASS-22 | Rad etilgan pasportni yuklagan foydalanuvchi qayta yuklay oladi. | DECISIONS.md D-39 | P5 | [ ] |
| R-PASS-23 | `reagent`/`standard_substance` namunasiga kimyogar biriktirilmaydi (urinish rad etiladi). | DECISIONS.md D-39 | P4 | [ ] |
| R-PASS-24 | `reagent`/`standard_substance` pasportini `chemist` yuklay oladi (`pending`), `director` yuklay olmaydi. | DECISIONS.md D-40 | P5 | [ ] |
| R-PASS-25 | `raw_material`/`finished_product` pasporti holatsiz qo'shimcha hujjat — `reviewPassport` ularga qo'llanmaydi. | DECISIONS.md D-41 | P5 | [ ] |

## REG — Reyestr

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-REG-01 | `/registry` — barcha `approved` namunalarning qidiriladigan arxivi (boshqa statuslar ko'rinmaydi). | 03-samples §3, DECISIONS.md D-07 | P4 | [ ] |
| R-REG-02 | Reyestr filtri: namuna turi. | 03-samples §3 | P4 | [ ] |
| R-REG-03 | Reyestr filtri: modda nomi. | 03-samples §3 | P4 | [ ] |
| R-REG-04 | Reyestr filtri: seriya raqami. | 03-samples §3 | P4 | [ ] |
| R-REG-05 | Reyestr filtri: lot raqami. | 03-samples §3 | P4 | [ ] |
| R-REG-06 | Reyestr filtri: tasdiqlangan sana oralig'i, DD.MM.YYYY formatida. | 03-samples §3 | P4 | [ ] |
| R-REG-07 | Reyestr qatoridan namuna tafsilotlariga o'tish: `/registry/:id`. | 03-samples §3 | P4 | [ ] |
| R-REG-08 | Reyestr qatoridan faylni yuklab olish: `finished_product` — `final` protokol fayli; pasport orqali tasdiqlangan — namuna pasporti fayli. | 03-samples §3, DECISIONS.md D-44 | P5 | [ ] |
| R-REG-09 | `lab_head` va `admin` namunani reyestrdan o'chiradi — soft-delete (`deleted_at`): barcha ro'yxatlardan yashiriladi, protokol/fayllar/stabilizatsiya saqlanadi, audit'ga yoziladi. | 03-samples §3, DECISIONS.md D-43 | P4 | [ ] |
| R-REG-10 | `lab_head` va `admin` dan boshqa rol reyestrdan o'chira olmaydi. | 03-samples §3, DECISIONS.md D-43 | P4 | [ ] |
| R-REG-11 | `/protocols` yo'li avtomatik `/registry` ga yo'naltiriladi. | 03-samples §3 | P4 | [x] |
| R-REG-12 | `/protocols/:id` yo'li avtomatik `/registry` ga yo'naltiriladi. | 03-samples §3 | P4 | [x] |
| R-REG-13 | Alohida "Protokollar ro'yxati" sahifasi yo'q. | 03-samples §3, 18 §18 | P4 | [ ] |
| R-REG-14 | Direktor finalizatsiyasi namunani reyestrdan chiqarmaydi va namuna statusini o'zgartirmaydi. | DECISIONS.md D-07 | P5 | [ ] |
| R-REG-15 | Faol stabilizatsiyasi bor namunani reyestrdan o'chirish rad etiladi. | DECISIONS.md D-43 | P9 | [ ] |
| R-REG-16 | `/registry` da "yakunlanmagan" (`approved`, `finalized` emas) filtri. | DECISIONS.md D-50 | P5 | [ ] |
| R-REG-17 | `/registry/:id` da direktor uchun protokolni "Yakunlash" tugmasi; alohida sahifa yo'q. | DECISIONS.md D-50 | P5 | [ ] |

## PROTO — Protokollar

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-PROTO-01 | Protokol qo'lda qiymat kiritish o'rniga fayl yuklash asosida ishlaydi. | 04-protocols §4, 18 §18 | P5 | [ ] |
| R-PROTO-02 | Protokol statusi `draft` mavjud. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-03 | Protokol statusi `submitted` mavjud. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-04 | Protokol statusi `approved` mavjud. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-05 | Protokol statusi `finalized` mavjud. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-06 | Protokol statusi `rejected` mavjud. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-07 | O'tish `draft → submitted`: faqat biriktirilgan kimyogar fayl yuklab yuboradi. | 04-protocols §4, DECISIONS.md D-45 | P5 | [ ] |
| R-PROTO-08 | Asosiy fayl yuklanmagan protokolni yuborish rad etiladi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-09 | O'tish `submitted → approved`: faqat lab_head. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-10 | O'tish `submitted → rejected`: faqat lab_head, sabab bilan. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-11 | Rad etishda sabab majburiy (bo'sh sabab rad etiladi). | 04-protocols §4 | P5 | [ ] |
| R-PROTO-12 | O'tish `approved → finalized`: faqat director. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-13 | `finalized` faqat protokol statusiga ta'sir qiladi, namuna statusiga emas. | DECISIONS.md D-07 | P5 | [ ] |
| R-PROTO-14 | Rad etilgan protokol `rejected` holatida qoladi (draft'ga qaytmaydi), rad etish sababi saqlanadi. | DECISIONS.md D-14 | P5 | [ ] |
| R-PROTO-15 | O'tish `rejected → submitted`: kimyogar faylni yangilab protokolni qayta yuboradi. | DECISIONS.md D-14 | P5 | [ ] |
| R-PROTO-16 | Diagrammada bo'lmagan protokol o'tishlari rad etiladi (masalan `draft → approved`, `submitted → finalized`). | 04-protocols §4 | P5 | [ ] |
| R-PROTO-17 | Protokol tasdiqlanganda namuna `approved` bo'ladi. | 03-samples §3, 17 §17 | P5 | [ ] |
| R-PROTO-18 | `protocol_role` qiymati `standard` — oddiy namunalar uchun yagona protokol (standart). | 04-protocols §4 | P5 | [ ] |
| R-PROTO-19 | `protocol_role` qiymati `final` — tayyor mahsulotning yakuniy tahlili. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-20 | `protocol_role` qiymati `in_process` — ishlab chiqarish jarayonidagi oraliq tahlil. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-21 | Bir namunada har `protocol_role` bo'yicha ko'pi bilan bitta protokol; faqat `finished_product` ikkita (`final` + `in_process`) protokolga ega bo'la oladi. | 04-protocols §4, DECISIONS.md D-15 | P5 | [ ] |
| R-PROTO-22 | Asosiy fayl (`file_*`) — tahlil natijasi hisoboti, yuborish uchun majburiy. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-23 | Asosiy fayl yangilansa — eskisi almashtiriladi (R2'dan ham). | 04-protocols §4 | P5 | [ ] |
| R-PROTO-24 | Ruxsat etilgan formatlar: PDF. | 04-protocols §4, DECISIONS.md D-06 | P5 | [ ] |
| R-PROTO-25 | Ruxsat etilgan formatlar: Word `.doc`. | 04-protocols §4, DECISIONS.md D-06 | P5 | [ ] |
| R-PROTO-26 | Ruxsat etilgan formatlar: Word `.docx`. | 04-protocols §4, DECISIONS.md D-06 | P5 | [ ] |
| R-PROTO-27 | Ruxsat etilgan formatlar: JPEG. | 04-protocols §4, DECISIONS.md D-06 | P5 | [ ] |
| R-PROTO-28 | Ruxsat etilgan formatlar: PNG. | 04-protocols §4, DECISIONS.md D-06 | P5 | [ ] |
| R-PROTO-29 | Boshqa formatdagi protokol fayllari rad etiladi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-30 | Protokol fayli maksimal 20 MB; undan katta fayl rad etiladi. | 04-protocols §4, DECISIONS.md D-06 | P5 | [ ] |
| R-PROTO-31 | Protokol pasporti (`passport_*`) — protokolga qo'shimcha hujjat, chemist/lab_head/admin/kontrolyor yuklay oladi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-32 | Protokol pasportida alohida tasdiqlash oqimi yo'q. | 04-protocols §4, 18 §18 | P5 | [ ] |
| R-PROTO-33 | Protokol pasportini `director` yuklay olmaydi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-34 | Qo'shimcha fayllar `protocol_files` faqat `finished_product` protokollariga biriktiriladi (bitta protokolga bir nechta fayl). | 04-protocols §4, DECISIONS.md D-49 | P5 | [ ] |
| R-PROTO-35 | Qo'shimcha fayllar ro'yxati ko'rsatiladi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-36 | Qo'shimcha faylni alohida yuklab olish mumkin. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-37 | Qo'shimcha faylni alohida o'chirish mumkin. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-38 | Endpoint `GET /api/v1/protocols/:id/file` — asosiy faylni yuklab olish. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-39 | Endpoint `GET /api/v1/protocols/:id/export` — `.docx` eksport: namuna (tur, modda, lot, seriya), protokol roli va holati, imzolar (kim/rol/vaqt), rad etish sababi (bo'lsa); UI tilida. | 04-protocols §4, DECISIONS.md D-84 | P5 | [ ] |
| R-PROTO-40 | DOCX eksport `docx` kutubxonasi bilan `src/utils/docxExport.ts` da generatsiya qilinadi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-41 | Kimyogar protokolga kira oladi, agar `protocol.created_by === kimyogar.id`. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-42 | Kimyogar protokolga kira oladi, agar `sample.assigned_to === kimyogar.id`. | 04-protocols §4, 18 §18 | P5 | [ ] |
| R-PROTO-43 | Ikkala shart ham bajarilmasa kimyogar protokolga kira olmaydi (403/404). | 04-protocols §4 | P5 | [ ] |
| R-PROTO-44 | Imzo: kimyogar yuborishda imzo qo'yadi — `protocol_signatures` yozuvi (foydalanuvchi, rol, harakat, vaqt), parol qayta kiritilmaydi. | 04-protocols §4, DECISIONS.md D-46 | P5 | [ ] |
| R-PROTO-45 | Imzo: lab_head tasdiqlashda imzo qo'yadi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-46 | Imzo: director yakunlashda imzo qo'yadi. | 04-protocols §4 | P5 | [ ] |
| R-PROTO-47 | Imzolar `protocol_signatures` jadvalida saqlanadi. | 16-architecture §16 | P5 | [ ] |
| R-PROTO-48 | Kimyogar yuborganda `protocol_submitted` xabarnomasi yaratiladi. | 09-notifications §9 | P6 | [ ] |
| R-PROTO-49 | Tasdiqlanganda `protocol_approved` xabarnomasi yaratiladi. | 09-notifications §9 | P6 | [ ] |
| R-PROTO-50 | Rad etilganda `protocol_rejected` xabarnomasi yaratiladi. | 09-notifications §9 | P6 | [ ] |
| R-PROTO-51 | `protocol_values` jadvali yangi schemada yo'q. | DECISIONS.md D-09 | P5 | [ ] |
| R-PROTO-52 | `finished_product` namunasi biriktirilganda `final` protokol `draft` holatida avtomatik yaratiladi. | DECISIONS.md D-15 | P5 | [ ] |
| R-PROTO-53 | `in_process` protokol ixtiyoriy: uni `lab_head` yoki biriktirilgan kimyogar namuna `approved` bo'lguncha yaratadi; boshqa rollar va `approved` dan keyingi urinish rad etiladi. | DECISIONS.md D-15 | P5 | [ ] |
| R-PROTO-54 | `finished_product` namunasi statusini faqat `final` protokol belgilaydi (yuborilganda `submitted`, tasdiqlanganda `approved`); `in_process` protokol namuna statusiga ta'sir qilmaydi. | DECISIONS.md D-15 | P5 | [ ] |
| R-PROTO-55 | `lab_head`/`admin` protokolga fayl yuklay oladi, lekin yubora olmaydi. | DECISIONS.md D-45 | P5 | [ ] |
| R-PROTO-56 | Rad etilganda oldingi imzolar tarix sifatida saqlanadi; qayta yuborishda yangi imzo qo'shiladi. | DECISIONS.md D-46 | P5 | [ ] |
| R-PROTO-57 | Asosiy fayl faqat `draft`/`rejected` holatida yuklanadi/almashtiriladi. | DECISIONS.md D-47 | P5 | [ ] |
| R-PROTO-58 | `submitted`/`approved`/`finalized` holatida protokolning barcha fayllari (asosiy, pasport, qo'shimcha) qulflangan. | DECISIONS.md D-47 | P5 | [ ] |
| R-PROTO-59 | Protokol pasporti va qo'shimcha fayllarni yuklagan foydalanuvchi yoki `lab_head`/`admin` o'chiradi; boshqalar — rad etiladi. | DECISIONS.md D-47 | P5 | [ ] |
| R-PROTO-60 | `.docx` eksportni protokolni ko'ra oladigan har kim istalgan statusda yuklab oladi. | DECISIONS.md D-48 | P5 | [ ] |
| R-PROTO-61 | `finished_product` bo'lmagan protokolga qo'shimcha fayl (`protocol_files`) biriktirish rad etiladi (legacy istisno yo'q). | DECISIONS.md D-49, DECISIONS.md D-76 | P5 | [ ] |
| R-PROTO-62 | `protocols.sample_id` NOT NULL (namunasiz protokol yaratib bo'lmaydi); `substance_id`, `batch_number`, `sample_source`, `notes` ustunlari yo'q. | DECISIONS.md D-74 | P5 | [ ] |

## SUBST — Moddalar

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-SUBST-01 | Modda nomi uch tilda: `name_uz`, `name_ru`, `name_en`. | 05-substances §5 | P3 | [ ] |
| R-SUBST-02 | `substances` jadvalida yagona `name` ustuni yo'q. | 05-substances §5 | P3 | [ ] |
| R-SUBST-03 | Farmakopiya — modda darajasidagi `substances.pharmacopoeia`: EP, BP, UzDSt, USP, OTHER; boshqasi rad etiladi. | 05-substances §5, DECISIONS.md D-67 | P3 | [ ] |
| R-SUBST-04 | CAS raqami ixtiyoriy. | 05-substances §5 | P3 | [ ] |
| R-SUBST-05 | Modda parametrlari (`substance_parameters`): nomi (bitta `parameter_name` ustuni), o'lchov birligi, min/max chegara, metod (erkin matn). | 05-substances §5, 16 §16, DECISIONS.md D-67 | P3 | [ ] |
| R-SUBST-06 | Moddani yaratish/tahrirlash: faqat `lab_head` va `admin`. | 05-substances §5 | P3 | [ ] |
| R-SUBST-07 | Moddalarni barcha (kompaniya) rollari ko'radi. | 05-substances §5 | P3 | [ ] |
| R-SUBST-08 | Moddalar sahifasi asosiy navigatsiyada (Sidebar) yo'q — namuna yaratishda va modda havolalari orqali ochiladi. | 05-substances §5, 16 §16 | P3 | [ ] |
| R-SUBST-09 | Namuna yaratishda modda tanlanadi (kompaniyaning moddalari ro'yxatidan). | 03-samples §3, 05 §5 | P4 | [ ] |
| R-SUBST-10 | Moddani faqat `admin` o'chiradi; `lab_head` va boshqalar — 403. | DECISIONS.md D-30 | P3 | [ ] |
| R-SUBST-11 | Namuna bog'langan moddani o'chirish 409 bilan rad etiladi. | DECISIONS.md D-30 | P3 | [ ] |

## REAG — Reaktivlar va Xarajat jurnali

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-REAG-01 | Reaktiv `quantity` (joriy zaxira) maydoniga ega. | 06-reagents §6 | P7 | [ ] |
| R-REAG-02 | Reaktiv `low_stock_threshold` maydoniga ega. | 06-reagents §6 | P7 | [ ] |
| R-REAG-03 | Reaktiv `expires_at` (yaroqlilik muddati) maydoniga ega. | 06-reagents §6 | P7 | [ ] |
| R-REAG-04 | Reaktiv `is_hazardous` (xavfli modda) belgisiga ega. | 06-reagents §6 | P7 | [ ] |
| R-REAG-05 | Tranzaksiya turi `in` loglanadi. | 06-reagents §6 | P7 | [ ] |
| R-REAG-06 | Tranzaksiya turi `out` loglanadi. | 06-reagents §6 | P7 | [ ] |
| R-REAG-07 | Tranzaksiya turi `adjustment` loglanadi. | 06-reagents §6 | P7 | [ ] |
| R-REAG-08 | Tranzaksiya turi `disposal` loglanadi. | 06-reagents §6 | P7 | [ ] |
| R-REAG-09 | Har bir zaxira o'zgarishi `reagent_transactions` ga yoziladi (quantity va tranzaksiya bitta tranzaksiyada). | 06-reagents §6 | P7 | [ ] |
| R-REAG-10 | Xarajat = `out` turidagi `reagent_transactions`; narx maydoni yo'q. | DECISIONS.md D-08 | P7 | [ ] |
| R-REAG-11 | Xarajat jurnali sahifasi `/reagents/journal` — sarfni kalendar ko'rinishida ko'rsatadi. | 06-reagents §6, DECISIONS.md D-08 | P7 | [ ] |
| R-REAG-12 | Xarajatlar ro'yxati sahifasi `/expenses` — sarfni ro'yxat ko'rinishida ko'rsatadi. | 06-reagents §6, DECISIONS.md D-08 | P7 | [ ] |
| R-REAG-13 | Reaktivga hujjatlar `reagent_documents` orqali biriktiriladi; turi `reagent_doc_type`: `passport`, `analysis`. | 06-reagents §6, DECISIONS.md D-69 | P7 | [ ] |
| R-REAG-14 | Reaktiv hujjatlari Cloudflare R2'da saqlanadi. | 12-files §12 | P7 | [ ] |
| R-REAG-15 | `is_low_stock` bayrog'i (`quantity < low_stock_threshold`) hisoblanadi va dashboardda ko'rsatiladi. | 06-reagents §6 | P7 | [ ] |
| R-REAG-16 | `is_expired` bayrog'i (`expires_at` o'tgan) hisoblanadi va dashboardda ko'rsatiladi. | 06-reagents §6, DECISIONS.md D-17 | P7 | [ ] |
| R-REAG-17 | Zaxira kam qolganda `low_stock` xabarnomasi yaratiladi (Q-37). | 09-notifications §9 | P7 | [ ] |
| R-REAG-18 | `low_stock` kompaniyaning barcha `lab_head` va `admin` foydalanuvchilariga yuboriladi. | DECISIONS.md D-04 | P7 | [ ] |
| R-REAG-19 | Reaktivlar sahifasi asosiy Sidebar'da yo'q. | 16-architecture §16 | P7 | [ ] |
| R-REAG-20 | Reaktiv, barcha tranzaksiyalar va hujjatlarni faqat "To'liq" rollar (`lab_head`, `admin`) boshqaradi; "Ko'rish" rollari `out` yozolmaydi (403). | DECISIONS.md D-51 | P7 | [ ] |
| R-REAG-21 | Xarajat sahifalari reaktivlarni ko'ra oladigan barcha rollarga faqat o'qish uchun ochiq. | DECISIONS.md D-51 | P7 | [ ] |
| R-REAG-22 | Reaktiv maydonlari — D-69 ro'yxati (`name`, `cas_number`, `unit`, `quantity`, `low_stock_threshold`, `expires_at`, `supplier`, `storage_conditions`, `is_hazardous`). | DECISIONS.md D-69 | P7 | [ ] |
| R-REAG-23 | Reaktiv hujjati maksimal 20MB va faqat PDF, .doc, .docx, JPEG, PNG; boshqasi rad etiladi. | DECISIONS.md D-79 | P7 | [ ] |

## TEMP — Harorat monitoringi

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-TEMP-01 | Har bir sensor uchun min/max chegara `sensor_configs` da saqlanadi. | 07-temperature §7 | P8 | [ ] |
| R-TEMP-02 | Harorat ko'rsatkichi `temperature_readings` ga yoziladi. | 07-temperature §7, 16 §16 | P8 | [ ] |
| R-TEMP-03 | Namlik ko'rsatkichi ham yoziladi. | 07-temperature §7 | P8 | [ ] |
| R-TEMP-04 | Qo'lda kiritilgan o'qish `is_manual = true` bilan belgilanadi. | 07-temperature §7, DECISIONS.md D-03 | P8 | [ ] |
| R-TEMP-05 | Chegaradan chiqqan o'qishda `temperature_alerts` yozuvi yaratiladi. | 07-temperature §7 | P8 | [ ] |
| R-TEMP-06 | Chegara ichidagi o'qishda alert yaratilmaydi. | 07-temperature §7 | P8 | [ ] |
| R-TEMP-07 | Dashboardda "Harorat alertlari" ko'rsatiladi. | 07-temperature §7 | P8 | [ ] |
| R-TEMP-08 | Chegaradan chiqqanda `temperature_alert` xabarnomasi yaratiladi. | 09-notifications §9 | P8 | [ ] |
| R-TEMP-09 | `temperature_alert` kompaniyaning barcha `lab_head` va `admin` foydalanuvchilariga yuboriladi. | DECISIONS.md D-04 | P8 | [ ] |
| R-TEMP-10 | Sensor avtomatik ingest endpointi / API key bu versiyada YO'Q. | DECISIONS.md D-03 | P8 | [ ] |
| R-TEMP-11 | Schema keyinchalik sensor ingest qo'shishga tayyor (o'qishda manba/`is_manual` farqlanadi). | DECISIONS.md D-03 | P8 | [ ] |
| R-TEMP-12 | Harorat sahifasi (`temperature/`) asosiy Sidebar'da bor. | 16-architecture §16 | P8 | [ ] |
| R-TEMP-13 | Sensor maydonlari: `sensor_id` (identifikator), `location_name` (joyi, xona). | DECISIONS.md D-83 | P8 | [ ] |
| R-TEMP-14 | Harorat o'qishini faqat `lab_head`/`admin` kiritadi; "Ko'rish" rollari — 403. | DECISIONS.md D-52 | P8 | [ ] |
| R-TEMP-15 | Namlik uchun ixtiyoriy alohida min/max chegara. | DECISIONS.md D-52 | P8 | [ ] |
| R-TEMP-16 | Chegaradan chiqqan har o'qish uchun alert yaratiladi; alertni yopish/"ko'rildi" belgisi yo'q. | DECISIONS.md D-52 | P8 | [ ] |
| R-TEMP-17 | `sensor_id` kompaniya ichida unikal (`UNIQUE(company_id, sensor_id)`): ikki kompaniya bir xil `sensor_id` ishlata oladi, bitta kompaniyada takror rad etiladi. | DECISIONS.md D-78 | P8 | [ ] |
| R-TEMP-18 | `temperature_readings` va `temperature_alerts` sensorga `sensor_config_id` (uuid FK) orqali bog'lanadi. | DECISIONS.md D-78 | P8 | [ ] |

## STAB — Stabilizatsiya

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-STAB-01 | Stabilizatsiya faqat `status = approved` namunalar uchun boshlanadi. | 08-stability §8 | P9 | [ ] |
| R-STAB-02 | `approved` bo'lmagan namunada boshlash rad etiladi. | 08-stability §8 | P9 | [ ] |
| R-STAB-03 | Namuna turi cheklanmagan — barcha turlar uchun ruxsat. | 08-stability §8, 18 §18 | P9 | [ ] |
| R-STAB-04 | Yangi study `active` holatida yaratiladi (`stability_studies`). | 08-stability §8 | P9 | [ ] |
| R-STAB-05 | Checkpointlar qo'lda, ixtiyoriy nom (masalan T9, T18, T24) va sana bilan kiritiladi (`stability_checkpoints`). | 08-stability §8 | P9 | [ ] |
| R-STAB-06 | Checkpointlar qattiq T3/T6/T12 bilan cheklanmagan. | 08-stability §8 | P9 | [ ] |
| R-STAB-07 | Bir study ichida bir xil nomli ikkita checkpoint bo'lishi mumkin emas (DB unique + validatsiya). | 08-stability §8 | P9 | [ ] |
| R-STAB-08 | Turli study'larda bir xil checkpoint nomi ruxsat etiladi. | 08-stability §8 | P9 | [ ] |
| R-STAB-09 | Checkpointlarni `lab_head`, `director`, `admin` qo'shadi/o'zgartiradi/o'chiradi. | 08-stability §8, DECISIONS.md D-54 | P9 | [ ] |
| R-STAB-10 | Checkpoint statusi `pending` mavjud; yangi checkpoint `pending` da yaratiladi. | 08-stability §8 | P9 | [ ] |
| R-STAB-11 | Checkpoint statusi `in_progress` mavjud. | 08-stability §8 | P9 | [ ] |
| R-STAB-12 | Checkpoint statusi `overdue` mavjud. | 08-stability §8 | P9 | [ ] |
| R-STAB-13 | Checkpoint statusi `completed` mavjud. | 08-stability §8 | P9 | [ ] |
| R-STAB-14 | O'tish `pending → in_progress`: birinchi natija kiritilganda avtomatik. | 08-stability §8, DECISIONS.md D-55 | P9 | [ ] |
| R-STAB-15 | O'tish `→ overdue`: faqat fon jarayoni muddat o'tganda belgilaydi. | 08-stability §8 | P9 | [ ] |
| R-STAB-16 | O'tish `→ completed` (`overdue` checkpoint ham yakunlanishi mumkin). | 08-stability §8 | P9 | [ ] |
| R-STAB-17 | `completed` checkpoint `overdue` deb belgilanmaydi. | 08-stability §8 | P9 | [ ] |
| R-STAB-18 | Har checkpoint uchun bir nechta natija (`stability_results`): `parameter`, `initial_value` (T0), `current_value`, `specification`, `result_status`. | 08-stability §8 | P9 | [ ] |
| R-STAB-19 | `result_status` faqat `pass`/`warning`/`fail`, foydalanuvchi qo'lda tanlaydi. | 08-stability §8, DECISIONS.md D-57 | P9 | [ ] |
| R-STAB-20 | 5 ta standart parametr oldindan to'ldiriladi: Tavsif, Assay, Namlik miqdori, Qo'shimcha aralashmalar, Eruvchanlik. | 08-stability §8, DECISIONS.md D-05 | P9 | [ ] |
| R-STAB-21 | Qo'shimcha parametr qo'shish mumkin. | 08-stability §8, DECISIONS.md D-05 | P9 | [ ] |
| R-STAB-22 | Parametrni (standartlarini ham) olib tashlash mumkin. | 08-stability §8, DECISIONS.md D-05 | P9 | [ ] |
| R-STAB-23 | Fon jarayoni `stabilityAlertJob` har 6 soatda ishga tushadi. | 08-stability §8, 16 §16 | P9 | [ ] |
| R-STAB-24 | Fon jarayoni muddati o'tgan checkpointlarni `overdue` belgilaydi. | 08-stability §8 | P9 | [ ] |
| R-STAB-25 | `overdue` belgilanganda `stability_overdue` xabarnomasi yuboriladi (qabul qiluvchilar — D-13; takrorlanish — Q-46). | 08-stability §8, 09 §9, DECISIONS.md D-13 | P9 | [ ] |
| R-STAB-26 | 14 kun ichida muddati yetadigan checkpointlar uchun `stability_due_soon` xabarnomasi yuboriladi. | 08-stability §8 | P9 | [ ] |
| R-STAB-27 | 14 kundan uzoq muddatli checkpoint uchun `stability_due_soon` yuborilmaydi. | 08-stability §8 | P9 | [ ] |
| R-STAB-28 | `stability_due_soon` bitta checkpoint uchun 24 soatda ko'pi bilan bir marta yuboriladi. | 08-stability §8 | P9 | [ ] |
| R-STAB-29 | Stabilizatsiya sahifalari asosiy Sidebar'da yo'q — namuna sahifasi va ichki havolalar orqali ochiladi. | 16-architecture §16 | P9 | [ ] |
| R-STAB-30 | Checkpointga ixtiyoriy biriktirilgan kimyogar (`assigned_to`); study'da alohida mas'ul maydoni yo'q. | DECISIONS.md D-53 | P9 | [ ] |
| R-STAB-31 | Natijasi bor checkpointni o'chirib bo'lmaydi. | DECISIONS.md D-54 | P9 | [ ] |
| R-STAB-32 | Checkpoint `completed` — barcha parametrlar to'ldirilgach "Yakunlash" tugmasi bilan; to'ldirilmagan bo'lsa rad etiladi. | DECISIONS.md D-55 | P9 | [ ] |
| R-STAB-33 | `pending` checkpoint ham muddat o'tganda `overdue` bo'ladi. | DECISIONS.md D-55 | P9 | [ ] |
| R-STAB-34 | Study statuslari `active` / `completed`; barcha checkpointlar `completed` bo'lganda study avtomatik `completed`; bekor qilish yo'q. | DECISIONS.md D-56, DECISIONS.md D-81 | P9 | [ ] |
| R-STAB-35 | `initial_value` (T0) study yaratishda parametr bo'yicha qo'lda kiritiladi va checkpointlarga ko'chadi. | DECISIONS.md D-57 | P9 | [ ] |
| R-STAB-36 | Bitta namunada bir vaqtda ko'pi bilan bitta `active` study; ikkinchisi rad etiladi. | DECISIONS.md D-58 | P9 | [ ] |
| R-STAB-37 | Study yaratilganda har checkpoint uchun parametr qatorlari (`stability_results`) oldindan yaratiladi: `initial_value` = T0, `current_value` NULL. | DECISIONS.md D-77 | P9 | [ ] |

## NOTIF — Xabarnomalar

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-NOTIF-01 | Xabarnoma turi `sample_assigned` — kimyogarga namuna biriktirilganda. | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-02 | Xabarnoma turi `sample_approved` — namuna tasdiqlanganda; namunani yaratgan kontrolyor va biriktirilgan kimyogarga. | 09-notifications §9, DECISIONS.md D-13 | P6 | [ ] |
| R-NOTIF-03 | Xabarnoma turi `sample_rejected` — lab_head rad etganda; namunani yaratgan kontrolyor va biriktirilgan kimyogarga. | 09-notifications §9, DECISIONS.md D-13, D-14 | P6 | [ ] |
| R-NOTIF-04 | Xabarnoma turi `protocol_submitted` — kimyogar protokolni yuborganda; kompaniyaning barcha `lab_head`'lariga. | 09-notifications §9, DECISIONS.md D-13 | P6 | [ ] |
| R-NOTIF-05 | Xabarnoma turi `protocol_approved` — protokol tasdiqlanganda; namunaga biriktirilgan kimyogarga (`sample.assigned_to`). | 09-notifications §9, DECISIONS.md D-13 | P6 | [ ] |
| R-NOTIF-06 | Xabarnoma turi `protocol_rejected` — protokol rad etilganda; namunaga biriktirilgan kimyogarga (`sample.assigned_to`). | 09-notifications §9, DECISIONS.md D-13 | P6 | [ ] |
| R-NOTIF-07 | Xabarnoma turi `temperature_alert` — harorat chegaradan chiqqanda. | 09-notifications §9 | P8 | [ ] |
| R-NOTIF-08 | Xabarnoma turi `low_stock` — reaktiv zaxirasi kam qolganda. | 09-notifications §9 | P7 | [ ] |
| R-NOTIF-09 | Xabarnoma turi `stability_due_soon` — checkpoint muddati yaqinlashganda. | 09-notifications §9 | P9 | [ ] |
| R-NOTIF-10 | Xabarnoma turi `stability_overdue` — checkpoint muddati o'tganda. | 09-notifications §9 | P9 | [ ] |
| R-NOTIF-11 | Ilova faqat §9 dagi xabarnoma turlarini yaratadi; `notification_type` enum'idagi legacy `sample_created`, `sample_overdue`, `general` faqat ko'chirilgan yozuvlar uchun. | 09-notifications §9, DECISIONS.md D-13, DECISIONS.md D-70 | P6 | [ ] |
| R-NOTIF-12 | Kanal 1: xabarnoma `notifications` jadvaliga yoziladi. | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-13 | Bazadagi xabarnomalar yuqori o'ng burchakdagi bell ikonasi (`NotificationBell`) orqali ko'rinadi. | 09-notifications §9, 16 §16 | P6 | [ ] |
| R-NOTIF-14 | Kanal 2: Socket.IO real vaqtli push. | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-15 | Har foydalanuvchi ulanishda o'zining `user:<id>` xonasiga qo'shiladi. | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-16 | Yangi xabarnoma `notification:new` hodisasi bilan faqat qabul qiluvchi xonasiga yuboriladi. | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-17 | Frontend `notification:new` ni React Query keshiga yozadi (sahifa yangilanmasdan). | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-18 | Frontend `notification:new` da toast ko'rsatadi. | 09-notifications §9 | P6 | [ ] |
| R-NOTIF-19 | Socket handshake JWT access-token bilan tasdiqlanadi; tokensiz/yaroqsiz ulanish rad etiladi. | 09-notifications §9, 15 §15 | P6 | [ ] |
| R-NOTIF-20 | Kanal 3: Telegram push — faqat Telegram akkaunti ulangan foydalanuvchiga. | 09-notifications §9, 13 §13 | P11 | [ ] |
| R-NOTIF-21 | Bitta `createNotification()` funksiyasi DB yozuvi, socket push va Telegram push'ni bajaradi. | 13-telegram §13, 16 §16 | P6 | [ ] |
| R-NOTIF-22 | `stability_due_soon` / `stability_overdue` checkpointga biriktirilgan kimyogarga (bor bo'lsa) va kompaniyaning `lab_head`'lariga yuboriladi. | DECISIONS.md D-13 | P9 | [ ] |
| R-NOTIF-23 | Harakatni bajargan foydalanuvchining o'ziga xabarnoma yuborilmaydi. | DECISIONS.md D-13 | P6 | [ ] |
| R-NOTIF-24 | Xabarnoma faqat hodisa sodir bo'lgan kompaniya foydalanuvchilariga yuboriladi. | DECISIONS.md D-13, D-12 | P6 | [ ] |
| R-NOTIF-25 | Xabarnomani bittalab o'qilgan deb belgilash. | DECISIONS.md D-59 | P6 | [ ] |
| R-NOTIF-26 | "Hammasini o'qilgan deb belgilash". | DECISIONS.md D-59 | P6 | [ ] |
| R-NOTIF-27 | Bell ikonasida o'qilmaganlar soni ko'rsatiladi. | DECISIONS.md D-59 | P6 | [ ] |
| R-NOTIF-28 | Xabarnomalarni o'chirish va avtomatik tozalash yo'q. | DECISIONS.md D-59 | P6 | [ ] |

## USER — Foydalanuvchilar, Admin panel, Ruxsatlar

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-USER-01 | Admin panel `/users` — `lab_head`, `director`, `admin` uchun ochiq. | 10-users §10 | P2 | [ ] |
| R-USER-02 | Admin panel `/users` — `kontrolyor` va `chemist` uchun yopiq. | 10-users §10, 01 §1 | P2 | [ ] |
| R-USER-03 | Admin panelda foydalanuvchilar ro'yxati (faqat o'z kompaniyasi). | 10-users §10 | P2 | [ ] |
| R-USER-04 | Admin panelda foydalanuvchilar statistikasi. | 10-users §10 | P2 | [ ] |
| R-USER-05 | Admin panelda yangi foydalanuvchi yaratish: `admin` — istalgan kompaniya roli; `lab_head` — faqat `kontrolyor`/`chemist`. | 10-users §10, DECISIONS.md D-16 | P2 | [ ] |
| R-USER-06 | `admin` istalgan foydalanuvchi parolini, `lab_head` faqat `kontrolyor`/`chemist` parolini tiklay oladi. | 10-users §10, 15 §15, DECISIONS.md D-16 | P2 | [ ] |
| R-USER-07 | Admin panelda foydalanuvchi loglarini ko'rish (Q-52). | 10-users §10 | P10 | [ ] |
| R-USER-08 | `user_permissions` jadvali orqali `resource`+`action` darajasida ruxsat berish. | 10-users §10 | P2 | [ ] |
| R-USER-09 | `user_permissions` dan ruxsatni olib tashlash = individual grant'ni o'chirish (rol ruxsatini deny qilib bo'lmaydi). | 10-users §10, DECISIONS.md D-32 | P2 | [ ] |
| R-USER-10 | `requirePermission` natijasi so'rov davomida keshlanadi (bitta so'rovda takroriy DB so'rovi yo'q). | 10-users §10 | P2 | [ ] |
| R-USER-11 | `resource:action` katalogi P2 da tuziladi va foydalanuvchiga tasdiqlatiladi. | DECISIONS.md D-10 | P2 | [ ] |
| R-USER-12 | Har foydalanuvchi `/profile` da o'z parolini o'zgartira oladi. | 10-users §10, 15 §15 | P2 | [ ] |
| R-USER-13 | Har foydalanuvchi `/profile` da Telegram akkauntini ulay oladi. | 10-users §10 | P11 | [ ] |
| R-USER-14 | Har foydalanuvchi `/profile` da Telegram akkauntini uza oladi. | 10-users §10 | P11 | [ ] |
| R-USER-15 | `lab_head` `admin`/`lab_head`/`director` rolidagi foydalanuvchini yarata, tahrirlay va parolini tiklay olmaydi (403). | DECISIONS.md D-16 | P2 | [ ] |
| R-USER-16 | `user_permissions` ni faqat `admin` boshqaradi; `lab_head`/`director` urinishi rad etiladi. | DECISIONS.md D-16 | P2 | [ ] |
| R-USER-17 | `director` foydalanuvchilarni faqat ko'radi (yaratish/tahrirlash/parol tiklash — 403). | DECISIONS.md D-16, 01 §1 | P2 | [ ] |
| R-USER-18 | Effektiv ruxsat = rol ruxsatlari ∪ individual (`user_permissions`) ruxsatlar. | DECISIONS.md D-32 | P2 | [ ] |

## AUDIT — Audit va Faoliyat jurnali

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-AUDIT-01 | Audit jurnali sahifasi `/logs` — faqat `super_admin`. | 11-audit §11 | P10 | [ ] |
| R-AUDIT-02 | Audit jurnali butun platforma, barcha kompaniyalar bo'yicha tizim hodisalarini ko'rsatadi. | 11-audit §11 | P10 | [ ] |
| R-AUDIT-03 | Faoliyat jurnali sahifasi `/activity` — `lab_head`, `director`, `admin`. | 11-audit §11 | P10 | [ ] |
| R-AUDIT-04 | Faoliyat jurnali faqat o'z kompaniyasi ichidagi foydalanuvchi harakatlarini ko'rsatadi. | 11-audit §11 | P10 | [ ] |
| R-AUDIT-05 | `super_admin` `/activity` ga, kompaniya rollari `/logs` ga kira olmaydi. | 11-audit §11 | P10 | [ ] |
| R-AUDIT-06 | Ikkala jurnal backend'da bitta `audit` modulida: `audit.router.ts` (global), `activity.router.ts` (kompaniya bo'yicha). | 11-audit §11 | P10 | [ ] |
| R-AUDIT-07 | Audit yozuvlari bitta `audit_log` jadvalida: login/logout/muvaffaqiyatsiz login, CRUD, status o'tishlari, fayl yuklash/o'chirish, ruxsat o'zgarishlari. | 16-architecture §16, DECISIONS.md D-60 | P10 | [ ] |
| R-AUDIT-08 | Har bir namuna va protokol uchun aniq tarix — kim, qachon, nima qildi. | 00-overview §0 | P10 | [ ] |
| R-AUDIT-09 | Audit va faoliyat jurnallari bitta `audit_log` jadvalidan (faoliyat — kompaniya bo'yicha filtrlangan). | DECISIONS.md D-60 | P10 | [ ] |
| R-AUDIT-10 | Jurnal filtrlari: sana, foydalanuvchi, harakat; eksport yo'q; yozuvlar muddatsiz saqlanadi. | DECISIONS.md D-60 | P10 | [ ] |
| R-AUDIT-11 | Audit yozuvida sezgir ustunlar (`password_hash`, token/token hash'lari) saqlanmaydi — yozishdan oldin olib tashlanadi. | DECISIONS.md D-62, D-64 | P10 | [ ] |
| R-AUDIT-12 | Audit yozuvi ilova (servis) qatlamida yoziladi; audit uchun DB trigger yo'q. | DECISIONS.md D-64 | P10 | [ ] |
| R-AUDIT-13 | Audit yozuvi o'zgartirish bilan bitta tranzaksiyada yoziladi — o'zgarish rollback bo'lsa audit yozuvi ham qolmaydi. | DECISIONS.md D-64 | P10 | [ ] |
| R-AUDIT-14 | Audit yozuvida `user_id`, `company_id`, `ip_address`, `user_agent` to'ldiriladi. | DECISIONS.md D-64 | P10 | [ ] |
| R-AUDIT-15 | `audit_log.record_id` NULL faqat auth hodisalari (login/logout/muvaffaqiyatsiz login) uchun — DB CHECK boshqa hodisada NULL ni rad etadi. | DECISIONS.md D-80 | P2 | [ ] |

## FILE — Fayllarni saqlash

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-FILE-01 | Barcha fayllar (protokol hujjatlari, pasportlar, reaktiv hujjatlari) Cloudflare R2'da saqlanadi; lokal disk ishlatilmaydi. | 12-files §12, DECISIONS.md D-06 | P5 | [ ] |
| R-FILE-02 | R2 bilan ishlash `@aws-sdk/client-s3` orqali. | 12-files §12 | P5 | [ ] |
| R-FILE-03 | Generic `files` moduli: yuklash. | 12-files §12 | P5 | [ ] |
| R-FILE-04 | Generic `files` moduli: ro'yxat. | 12-files §12 | P5 | [ ] |
| R-FILE-05 | Generic `files` moduli — UI'siz umumiy yuklash/yuklab olish servisi (R2 kaliti + metadata); yuklab olish backend orqali stream yoki 5 daqiqalik imzolangan URL. | 12-files §12, DECISIONS.md D-61 | P5 | [ ] |
| R-FILE-06 | Generic `files` moduli: o'chirish. | 12-files §12 | P5 | [ ] |
| R-FILE-07 | `multer` xotira-saqlash (memory storage) bilan qabul qilinadi. | 12-files §12 | P5 | [ ] |
| R-FILE-08 | Generic `files` moduli limiti 50MB; undan katta fayl rad etiladi. | 12-files §12, DECISIONS.md D-06 | P5 | [ ] |
| R-FILE-09 | Generic `files` moduli faqat PDF/.doc/.docx/JPEG/PNG qabul qiladi. | 12-files §12, DECISIONS.md D-06 | P5 | [ ] |
| R-FILE-10 | Fayl metama'lumoti `files` jadvalida saqlanadi. | 16-architecture §16 | P5 | [ ] |
| R-FILE-11 | R2 `R2_*` muhit o'zgaruvchilari orqali sozlanadi. | 12-files §12 | P5 | [ ] |

## TG — Telegram

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-TG-01 | Bot `grammy` kutubxonasida. | 13-telegram §13 | P11 | [ ] |
| R-TG-02 | Bot buyrug'i `/start` (shu jumladan `/start <token>` bilan akkaunt ulash). | 13-telegram §13 | P11 | [ ] |
| R-TG-03 | Bot buyrug'i `/help` (Q-57). | 13-telegram §13 | P11 | [ ] |
| R-TG-04 | Bot buyrug'i `/status` (Q-57). | 13-telegram §13 | P11 | [ ] |
| R-TG-05 | Bot buyrug'i `/unlink`. | 13-telegram §13 | P11 | [ ] |
| R-TG-06 | Mini App: mavjud React frontend Telegram WebApp sifatida ochiladi (to'liq LIMS). | 13-telegram §13 | P11 | [ ] |
| R-TG-07 | Ulash oqimi: veb-login → Profil → "Telegram ulash" → `POST /telegram/link-token`. | 13-telegram §13 | P11 | [ ] |
| R-TG-08 | Link-tokenlar `telegram_link_tokens` jadvalida SHA-256 xesh sifatida saqlanadi (xom token bazaga yozilmaydi); token bir martalik. | 16-architecture §16, DECISIONS.md D-65 | P11 | [ ] |
| R-TG-09 | Bot `/start <token>` ni qabul qilib akkauntni foydalanuvchiga bog'laydi (`users` dagi Telegram maydonlari). | 13-telegram §13, 16 §16 | P11 | [ ] |
| R-TG-10 | WebApp login: `initData` → `POST /telegram/webapp-auth` → avtomatik kirish. | 13-telegram §13 | P11 | [ ] |
| R-TG-11 | `webapp-auth` `initData` ni HMAC-SHA256 bilan tekshiradi; noto'g'ri imzo rad etiladi. | 13-telegram §13 | P11 | [ ] |
| R-TG-12 | Ulanmagan Telegram akkaunti bilan `webapp-auth` kirish bermaydi. | 13-telegram §13 | P11 | [ ] |
| R-TG-13 | `createNotification()` Telegram'ga fire-and-forget yuboradi — Telegram xatosi asosiy amalni buzmaydi. | 13-telegram §13 | P11 | [ ] |
| R-TG-14 | Dasturlash muhitida bot polling rejimida avtomatik ishga tushadi. | 13-telegram §13 | P11 | [ ] |
| R-TG-15 | Production'da webhook rejimi: `TELEGRAM_WEBHOOK_URL` + `TELEGRAM_WEBHOOK_SECRET`. | 13-telegram §13 | P11 | [ ] |
| R-TG-16 | Webhook so'rovlari secret bilan tekshiriladi; noto'g'ri secret rad etiladi. | 13-telegram §13 | P11 | [ ] |
| R-TG-17 | `TELEGRAM_BOT_TOKEN` yo'q bo'lsa bot ishga tushmaydi, ilova ishlashda davom etadi. | 13-telegram §13 | P11 | [ ] |
| R-TG-18 | Ishlatilgan yoki muddati o'tgan link token bilan `/start <token>` rad etiladi (muddat — Q-55). | DECISIONS.md D-65 | P11 | [ ] |

## I18N — Ko'p tillilik

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-I18N-01 | Uch til: o'zbek, rus, ingliz — `i18next` + `react-i18next`. | 14-i18n §14 | P1 | [x] |
| R-I18N-02 | Standart til — o'zbek. | 14-i18n §14 | P1 | [x] |
| R-I18N-03 | Tarjima fayllari `src/i18n/locales/` da: `uz.json`, `ru.json`, `en.json`. | 14-i18n §14, 16 §16 | P1 | [x] |
| R-I18N-04 | Har sahifada `useTranslation()` dan `t('key')` ishlatiladi. | 14-i18n §14 | P1 | [x] |
| R-I18N-05 | JSX ichida qattiq yozilgan matn yo'q (lint/test bilan tekshiriladi). | 14-i18n §14 | P12 | [~] |
| R-I18N-06 | Uchala tilda kalitlar to'liq — bir tilda bor kalit qolgan ikkitasida ham bor (avtomatik test). | 14-i18n §14 | P12 | [x] |
| R-I18N-07 | Tanlangan til `localStorage` da saqlanadi. | 14-i18n §14 | P1 | [x] |
| R-I18N-08 | Til top bar'dagi til almashtirgichi orqali tanlanadi. | 14-i18n §14 | P1 | [x] |
| R-I18N-09 | Modda nomi joriy tilga mos `name_uz`/`name_ru`/`name_en` dan ko'rsatiladi. | 05-substances §5 | P3 | [ ] |

## AUTH — Autentifikatsiya va xavfsizlik

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-AUTH-01 | Auth moduli: login. | 16-architecture §16 | P2 | [ ] |
| R-AUTH-02 | Auth moduli: logout (sessiyani bekor qiladi). | 16-architecture §16 | P2 | [ ] |
| R-AUTH-03 | Auth moduli: refresh (`/auth/refresh`). | 15-auth §15 | P2 | [ ] |
| R-AUTH-04 | Auth moduli: me (joriy foydalanuvchi). | 16-architecture §16 | P2 | [ ] |
| R-AUTH-05 | Access token — JWT, 30 daqiqa amal qiladi. | 15-auth §15 | P2 | [ ] |
| R-AUTH-06 | Access token `Authorization: Bearer ...` sarlavhasida har so'rovda yuboriladi. | 15-auth §15 | P2 | [ ] |
| R-AUTH-07 | Refresh token — JWT, 7 kun amal qiladi. | 15-auth §15 | P2 | [ ] |
| R-AUTH-08 | Refresh token HTTP-only cookie'da, faqat `/auth/refresh` da ishlatiladi (Q-61). | 15-auth §15 | P2 | [ ] |
| R-AUTH-09 | Bazada refresh token xom holda emas, faqat SHA-256 xeshi saqlanadi (`sessions`). | 15-auth §15 | P2 | [ ] |
| R-AUTH-10 | Har refresh'da refresh token rotatsiya qilinadi; eski token qayta ishlatilmaydi. | 15-auth §15 | P2 | [ ] |
| R-AUTH-11 | Bir foydalanuvchi bir vaqtda ko'pi bilan 3 ta aktiv sessiyaga ega. | 15-auth §15 | P2 | [ ] |
| R-AUTH-12 | 4-sessiya ochilganda eng eskisi avtomatik o'chiriladi (Q-58). | 15-auth §15 | P2 | [ ] |
| R-AUTH-13 | Harakatsizlik `SESSION_IDLE_TIMEOUT_MINUTES` dan oshsa sessiya avtomatik tugaydi (Q-59). | 15-auth §15 | P2 | [ ] |
| R-AUTH-14 | `SESSION_IDLE_TIMEOUT_MINUTES` standart qiymati 30 daqiqa. | 15-auth §15 | P2 | [ ] |
| R-AUTH-15 | Access token va Socket.IO handshake bitta `verifyAccessToken` funksiyasi bilan tekshiriladi. | 15-auth §15 | P6 | [ ] |
| R-AUTH-16 | Parol bcrypt 10 round bilan xeshlanadi. | 15-auth §15 | P2 | [ ] |
| R-AUTH-17 | Foydalanuvchi o'z parolini o'zgartira oladi. | 15-auth §15 | P2 | [ ] |
| R-AUTH-18 | Frontend axios 401 interceptor + token refresh navbati (parallel 401'larda bitta refresh). | 16-architecture §16 | P2 | [~] |
| R-AUTH-19 | Frontend auth holati Zustand `store/authStore.ts` da (foydalanuvchi, token). | 16-architecture §16 | P2 | [~] |
| R-AUTH-20 | Nofaol kompaniya foydalanuvchisi login qila olmaydi; nofaollashtirilganda faol sessiyalari darhol bekor qilinadi. | 02-multitenancy §2, DECISIONS.md D-34 | P2 | [ ] |
| R-AUTH-21 | Login identifikatori — `users.email`, butun platforma bo'yicha unikal; takroriy email bilan foydalanuvchi yaratish rad etiladi. | DECISIONS.md D-66 | P2 | [ ] |
| R-AUTH-22 | Parol siyosati: kamida 8 belgi, kamida bitta harf va bitta raqam; mos kelmasa 400. | DECISIONS.md D-66 | P2 | [ ] |
| R-AUTH-23 | Login endpointiga alohida rate-limit: bitta IP'dan 15 daqiqada 10 urinish, keyingisi 429. | DECISIONS.md D-66 | P2 | [ ] |

## SEC — Xavfsizlik choralari

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-SEC-01 | `helmet` HTTP xavfsizlik sarlavhalarini qo'yadi. | 15-auth §15 | P1 | [x] |
| R-SEC-02 | Global rate-limit: IP boshiga 15 daqiqada 2000 so'rov. | 15-auth §15 | P1 | [x] |
| R-SEC-03 | Rate-limit faqat `NODE_ENV=production` da yoqiladi. | 15-auth §15 | P1 | [x] |
| R-SEC-04 | Barcha kiruvchi ma'lumotlar Zod bilan validatsiya qilinadi. | 15-auth §15 | P1 | [~] |
| R-SEC-05 | Muhit o'zgaruvchilari Zod bilan validatsiya qilinadi; noto'g'ri env'da server ishga tushmaydi. | 15-auth §15, 16 §16 | P1 | [x] |
| R-SEC-06 | SQL faqat parametrlashtirilgan (`$1`), string konkatenatsiya yo'q. | 16-architecture §16 | P12 | [ ] |
| R-SEC-07 | Sirlar (token, parol, kalitlar) logga yozilmaydi. | 15-auth §15 | P12 | [ ] |

## ARCH — Texnik arxitektura (env, middleware, jadvallar, infratuzilma)

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-ARCH-01 | Backend: Express.js + TypeScript + PostgreSQL, raw `pg`, ORM yo'q. | 16-architecture §16 | P1 | [x] |
| R-ARCH-02 | `src/app.ts` — entry point: middleware, router ulash, Socket.IO va botni ishga tushirish. | 16-architecture §16 | P1 | [~] |
| R-ARCH-03 | `config/database.ts` — pg pool, `query()` va `withTransaction()`. | 16-architecture §16 | P1 | [x] |
| R-ARCH-04 | Ko'p-bosqichli yozuvlar `withTransaction()` ichida. | 16-architecture §16 | P1 | [~] |
| R-ARCH-05 | `config/env.ts` — Zod env validatsiyasi (cloud yoki lokal DB, R2, Telegram). | 16-architecture §16 | P1 | [x] |
| R-ARCH-06 | `config/swagger.ts` — API hujjatlari. | 16-architecture §16 | P1 | [~] |
| R-ARCH-07 | Swagger UI faqat `development` muhitida, login formasi bilan (Q-63). | 16-architecture §16 | P1 | [~] |
| R-ARCH-08 | Middleware `authenticate.ts`: JWT tekshiruv. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-09 | Middleware `requireRole()`. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-10 | Middleware `requireCompany()`. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-11 | Middleware `requirePermission()`. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-12 | Middleware `sessionTimeout.ts`: harakatsizlikda sessiyani tugatish. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-13 | Middleware `errorHandler.ts`: markazlashtirilgan xato handler (domen xatolari → HTTP kod). | 16-architecture §16 | P1 | [x] |
| R-ARCH-14 | Har modul naqshi: `*.router.ts` (Router + Swagger annotatsiya), `*.controller.ts`, `*.service.ts` (SQL + logika + domen xato klassi), `*.schemas.ts` (Zod). | 16-architecture §16 | P1 | [ ] |
| R-ARCH-15 | Backend modullari: auth, admin, companies, substances, protocols, samples, reagents, temperature, stability, notifications, dashboard, files, audit, telegram. | 16-architecture §16 | P1 | [~] |
| R-ARCH-16 | `realtime/socket.ts` — Socket.IO server bir xil HTTP server ustida, JWT handshake, `user:<id>` xonalar. | 16-architecture §16 | P6 | [ ] |
| R-ARCH-17 | `jobs/stabilityAlertJob.ts` — 6 soatlik fon jarayoni. | 16-architecture §16 | P9 | [ ] |
| R-ARCH-18 | `utils/logger.ts` — Winston logger. | 16-architecture §16 | P1 | [x] |
| R-ARCH-19 | Migratsiyalar `db/migrations/` da raqamlangan SQL fayllar, `npm run migrate` bilan qo'llaniladi. | 16-architecture §16 | P1 | [x] |
| R-ARCH-20 | Qo'llangan migratsiyalar `schema_migrations` jadvalida kuzatiladi; qayta qo'llanmaydi. | 16-architecture §16 | P1 | [x] |
| R-ARCH-21 | Toza baseline schema (eski 038 migratsiya ko'chirilmaydi). | DECISIONS.md D-01 | P1 | [~] |
| R-ARCH-22 | Jadval `companies`. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-23 | Jadval `users` (`company_id`, Telegram bog'lanish maydonlari bilan). | 16-architecture §16 | P2 | [ ] |
| R-ARCH-24 | Jadval `sessions` (refresh token hash). | 16-architecture §16 | P2 | [ ] |
| R-ARCH-25 | Jadval `user_permissions`. | 16-architecture §16 | P2 | [ ] |
| R-ARCH-26 | Jadval `telegram_link_tokens`. | 16-architecture §16 | P11 | [ ] |
| R-ARCH-27 | Jadval `substances`. | 16-architecture §16 | P3 | [ ] |
| R-ARCH-28 | Jadval `substance_parameters`. | 16-architecture §16 | P3 | [ ] |
| R-ARCH-29 | Jadval `protocols`. | 16-architecture §16 | P5 | [ ] |
| R-ARCH-30 | Jadval `protocol_signatures`. | 16-architecture §16 | P5 | [ ] |
| R-ARCH-31 | Jadval `protocol_files`. | 04-protocols §4 | P5 | [ ] |
| R-ARCH-32 | Jadval `samples`. | 16-architecture §16 | P4 | [ ] |
| R-ARCH-33 | Jadval `sample_tracking`. | 16-architecture §16 | P4 | [ ] |
| R-ARCH-34 | Jadval `reagents`. | 16-architecture §16 | P7 | [ ] |
| R-ARCH-35 | Jadval `reagent_transactions`. | 16-architecture §16 | P7 | [ ] |
| R-ARCH-36 | Jadval `reagent_documents`. | 16-architecture §16 | P7 | [ ] |
| R-ARCH-37 | Jadval `sensor_configs`. | 16-architecture §16 | P8 | [ ] |
| R-ARCH-38 | Jadval `temperature_readings`. | 16-architecture §16 | P8 | [ ] |
| R-ARCH-39 | Jadval `temperature_alerts`. | 16-architecture §16 | P8 | [ ] |
| R-ARCH-40 | Jadval `stability_studies`. | 16-architecture §16 | P9 | [ ] |
| R-ARCH-41 | Jadval `stability_checkpoints`. | 16-architecture §16 | P9 | [ ] |
| R-ARCH-42 | Jadval `stability_results`. | 16-architecture §16 | P9 | [ ] |
| R-ARCH-43 | Jadval `notifications`. | 16-architecture §16 | P6 | [ ] |
| R-ARCH-44 | Jadval `files`. | 16-architecture §16 | P5 | [ ] |
| R-ARCH-45 | Jadval `audit_log`. | 16-architecture §16 | P10 | [ ] |
| R-ARCH-46 | Jadval `schema_migrations`. | 16-architecture §16 | P1 | [x] |
| R-ARCH-47 | Env `DATABASE_URL` — cloud (Neon/Railway/Supabase) yoki lokal PostgreSQL. | 16-architecture §16 | P1 | [x] |
| R-ARCH-48 | Env `SESSION_IDLE_TIMEOUT_MINUTES` (standart 30). | 15-auth §15 | P2 | [ ] |
| R-ARCH-49 | Env `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`. | 12-files §12, DECISIONS.md D-18, D-25 | P5 | [ ] |
| R-ARCH-50 | Env `TELEGRAM_BOT_TOKEN`. | 13-telegram §13 | P11 | [ ] |
| R-ARCH-51 | Env `TELEGRAM_BOT_USERNAME`. | 13-telegram §13 | P11 | [ ] |
| R-ARCH-52 | Env `TELEGRAM_WEBHOOK_URL` (production). | 13-telegram §13 | P11 | [ ] |
| R-ARCH-53 | Env `TELEGRAM_WEBHOOK_SECRET` (production). | 13-telegram §13 | P11 | [ ] |
| R-ARCH-54 | Env `NODE_ENV` (development/production — Swagger, rate-limit, Telegram rejimi unga bog'liq). | 15 §15, 16 §16 | P1 | [x] |
| R-ARCH-55 | Env `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. | 15-auth §15, DECISIONS.md D-18, D-25 | P2 | [ ] |
| R-ARCH-56 | Hosting-agnostik: hammasi `.env` orqali, `npm run build` + `npm start`; Docker yo'q. | DECISIONS.md D-11 | P12 | [ ] |
| R-ARCH-57 | Eski bazadan ma'lumot ko'chirish ETL skripti. | DECISIONS.md D-01 | P12 | [ ] |
| R-ARCH-58 | `Dockerfile` ixtiyoriy (faqat P12 da, kerak bo'lsa). | DECISIONS.md D-11 | P12 | [ ] |
| R-ARCH-59 | Node 24 LTS: `.nvmrc`, `engines` va CI workflow Node 24 da. | DECISIONS.md D-20 | P1 | [x] |
| R-ARCH-60 | Backend ESM (`NodeNext`, nisbiy importlarda `.js`); dev `tsx watch`; build `tsc` + SQL migratsiyalarni `dist` ga ko'chirish. | DECISIONS.md D-21 | P1 | [x] |
| R-ARCH-61 | `src/app.ts` faqat `createApp()` ni eksport qiladi; `src/server.ts` serverni ishga tushiradi va SIGINT/SIGTERM da graceful shutdown qiladi. | DECISIONS.md D-21 | P1 | [~] |
| R-ARCH-62 | Muvaffaqiyatli javob `{ data, meta? }`, ro'yxatda `meta: { page, limit, total }`. | DECISIONS.md D-22 | P1 | [x] |
| R-ARCH-63 | Xato javobi `{ error: { code, message, details?, requestId } }`. | DECISIONS.md D-22 | P1 | [x] |
| R-ARCH-64 | API prefiksi `/api/v1`. | DECISIONS.md D-22 | P1 | [x] |
| R-ARCH-65 | Pagination: `page` (default 1), `limit` (default 20, max 100); chegaradan tashqari qiymat 400. | DECISIONS.md D-22 | P1 | [x] |
| R-ARCH-66 | Migratsiyalar faqat oldinga (down yo'q). | DECISIONS.md D-24 | P1 | [x] |
| R-ARCH-67 | Qo'llangan migratsiya fayli checksum'i o'zgarsa runner xato beradi. | DECISIONS.md D-24 | P1 | [x] |
| R-ARCH-68 | Env qoidalari: JWT sirlari ≥32, production'da R2_* va FRONTEND_URL majburiy, Telegram token → username (+ production'da webhook URL/secret). | DECISIONS.md D-25, D-26 | P1 | [x] |
| R-ARCH-69 | ETL eski `audit_logs` ni yangi audit jadvaliga ko'chirmaydi; eski baza dump'i arxiv sifatida saqlanadi. | DECISIONS.md D-63 | P12 | [ ] |
| R-ARCH-70 | ETL har ko'chirilgan namuna va protokol uchun bitta "legacy'dan ko'chirildi" tracking voqeasini yozadi: joriy status, asl `created_at`/`updated_at`. | DECISIONS.md D-63 | P12 | [ ] |
| R-ARCH-71 | `user_permissions` da `company_id` (NOT NULL, tenant filtri). | DECISIONS.md D-12, DECISIONS.md D-70 | P2 | [ ] |
| R-ARCH-72 | `substance_parameters` da `company_id` (NOT NULL, tenant filtri). | DECISIONS.md D-12, DECISIONS.md D-70 | P3 | [ ] |
| R-ARCH-73 | `protocol_signatures` va `protocol_files` da `company_id` (NOT NULL, tenant filtri). | DECISIONS.md D-12, DECISIONS.md D-70 | P5 | [ ] |
| R-ARCH-74 | `reagent_transactions` va `reagent_documents` da `company_id` (NOT NULL, tenant filtri). | DECISIONS.md D-12, DECISIONS.md D-70 | P7 | [ ] |
| R-ARCH-75 | `temperature_readings` va `temperature_alerts` da `company_id` (NOT NULL, tenant filtri). | DECISIONS.md D-12, DECISIONS.md D-70 | P8 | [ ] |
| R-ARCH-76 | `stability_checkpoints` va `stability_results` da `company_id` (NOT NULL, tenant filtri). | DECISIONS.md D-12, DECISIONS.md D-70 | P9 | [ ] |
| R-ARCH-77 | `users` CHECK: `role = 'super_admin'` ⇔ `company_id IS NULL` (DB darajasida rad etiladi). | DECISIONS.md D-70 | P2 | [ ] |
| R-ARCH-78 | `protocol_signatures` da `action` ustuni bor va `UNIQUE(protocol_id, role)` yo'q — qayta yuborishda kimyogarning ikkinchi imzosi saqlanadi. | DECISIONS.md D-46, DECISIONS.md D-70 | P5 | [ ] |
| R-ARCH-79 | `protocols.passport_uploaded_by` — protokol pasportini yuklagan foydalanuvchi saqlanadi. | DECISIONS.md D-47, DECISIONS.md D-70 | P5 | [ ] |
| R-ARCH-80 | `notification_type` enum'ida §9 dagi 10 tur (shu jumladan `temperature_alert`, `low_stock`) bor; `notifications.type` da DEFAULT yo'q. | DECISIONS.md D-70 | P6 | [ ] |
| R-ARCH-81 | `stability_studies`: status CHECK faqat `active`, `completed`; unikallik faqat `status = 'active'` qatorlar bo'yicha (bitta namunada bir nechta yakunlangan study mumkin). | DECISIONS.md D-58, DECISIONS.md D-70, DECISIONS.md D-81 | P9 | [ ] |
| R-ARCH-82 | ETL boshida xavfsizlik tekshiruvi: `sample_documents`, `protocol_values`, namunasiz protokollar, `finished_product` bo'lmagan protokollardagi `protocol_files`, `cancelled` study, `in_process` namuna soni 0 bo'lmasa ETL to'xtaydi va xabar beradi. | DECISIONS.md D-82 | P12 | [ ] |
| R-ARCH-83 | ETL `samples.expires_at`/`deadline` qiymatini shu namunaning "legacy'dan ko'chirildi" tracking voqeasi izohiga yozadi. | DECISIONS.md D-71 | P12 | [ ] |

## FE — Frontend sahifalar, yo'llar, Sidebar

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-FE-01 | Frontend: React + TypeScript + Vite + Tailwind CSS. | 16-architecture §16 | P1 | [x] |
| R-FE-02 | `src/api/client.ts` — axios instance (401 interceptor bilan, R-AUTH-18). | 16-architecture §16 | P1 | [x] |
| R-FE-03 | `src/api/` da har modul uchun API funksiyalari (companies, admin, auditLogs, dashboard, notifications, telegram, ...). | 16-architecture §16 | P1 | [~] |
| R-FE-04 | `src/hooks/` da har modul uchun React Query hooklari. | 16-architecture §16 | P1 | [~] |
| R-FE-05 | `hooks/useNotificationSocket.ts` — Socket.IO ulanishi va real vaqtli yangilash. | 16-architecture §16 | P6 | [ ] |
| R-FE-06 | `lib/socket.ts` — Socket.IO client ulanish/uzish (logout'da uziladi). | 16-architecture §16 | P6 | [ ] |
| R-FE-07 | `types/index.ts` — TypeScript interfeyslari. | 16-architecture §16 | P1 | [~] |
| R-FE-08 | UI komponentlari: Table, Modal, Spinner, Pagination, NotificationBell. | 16-architecture §16 | P1 | [~] |
| R-FE-09 | Layout: `AppLayout`, `Sidebar` (rol bo'yicha; super_admin uchun alohida menyu). | 16-architecture §16 | P1 | [x] |
| R-FE-10 | Sidebar elementi: Dashboard (Q-64). | 16-architecture §16 | P1 | [x] |
| R-FE-11 | Sidebar elementi: Namunalar. | 16-architecture §16 | P4 | [x] |
| R-FE-12 | Sidebar elementi: Reyestr. | 16-architecture §16 | P4 | [x] |
| R-FE-13 | Sidebar elementi: Harorat. | 16-architecture §16 | P8 | [x] |
| R-FE-14 | Sidebar elementi: Foydalanuvchilar (faqat lab_head/director/admin). | 16 §16, 10 §10 | P2 | [x] |
| R-FE-15 | Sidebar elementi: Faoliyat (faqat lab_head/director/admin). | 16 §16, 11 §11 | P10 | [x] |
| R-FE-16 | Sidebar'da Moddalar, Reaktivlar, Stabilizatsiya elementlari YO'Q. | 16-architecture §16 | P1 | [x] |
| R-FE-17 | super_admin Sidebar'i faqat Kompaniyalar va Audit jurnali. | 01 §1, 16 §16 | P2 | [x] |
| R-FE-18 | Sahifa: auth (login). | 16-architecture §16 | P2 | [ ] |
| R-FE-19 | Sahifa: Dashboard — `ChemistDashboard`. | 16-architecture §16 | P6 | [ ] |
| R-FE-20 | Sahifa: Dashboard — `DirectorDashboard`. | 16-architecture §16 | P6 | [ ] |
| R-FE-21 | Sahifa: Dashboard — `LabHeadDashboard`. | 16-architecture §16 | P6 | [ ] |
| R-FE-22 | Sahifa: Dashboard — `InspectorDashboard` (Q-65). | 16-architecture §16 | P6 | [ ] |
| R-FE-23 | Sahifa: `SuperAdminDashboard`. | 01 §1, 16 §16 | P2 | [ ] |
| R-FE-24 | Backend `dashboard` moduli rol bo'yicha statistika qaytaradi (tarkibi — D-33). | 16-architecture §16, DECISIONS.md D-33 | P6 | [ ] |
| R-FE-25 | Sahifa: namunalar (ro'yxat, yaratish, namuna sahifasi `ProtocolSection` bilan) (Q-24). | 16-architecture §16 | P4 | [ ] |
| R-FE-26 | Sahifa: `/registry`. | 03-samples §3 | P4 | [ ] |
| R-FE-27 | Sahifa: `/registry/:id`. | 03-samples §3 | P4 | [ ] |
| R-FE-28 | Sahifa: moddalar. | 16-architecture §16 | P3 | [ ] |
| R-FE-29 | Sahifa: reaktivlar. | 16-architecture §16 | P7 | [ ] |
| R-FE-30 | Sahifa: `/reagents/journal`. | 06-reagents §6 | P7 | [ ] |
| R-FE-31 | Sahifa: `/expenses`. | 06-reagents §6 | P7 | [ ] |
| R-FE-32 | Sahifa: harorat. | 16-architecture §16 | P8 | [ ] |
| R-FE-33 | Sahifa: stabilizatsiya. | 16-architecture §16 | P9 | [ ] |
| R-FE-34 | Sahifa: `/companies` (faqat super_admin). | 02 §2, 16 §16 | P2 | [ ] |
| R-FE-35 | Sahifa: `/logs` (faqat super_admin). | 11 §11, 16 §16 | P10 | [ ] |
| R-FE-36 | Sahifa: `/activity` (lab_head/director/admin). | 11 §11, 16 §16 | P10 | [ ] |
| R-FE-37 | Sahifa: `/users`. | 10 §10, 16 §16 | P2 | [ ] |
| R-FE-38 | Sahifa: `/profile` (parol o'zgartirish, Telegram ulash/uzish). | 10 §10 | P2 | [ ] |
| R-FE-39 | Ruxsatsiz rol himoyalangan yo'lga to'g'ridan-to'g'ri kirsa sahifa ochilmaydi. | 01 §1, 16 §16 | P2 | [~] |
| R-FE-40 | Top bar'da til almashtirgichi va NotificationBell. | 09 §9, 14 §14 | P1 | [x] |
| R-FE-41 | Access token faqat xotirada (Zustand, localStorage'ga yozilmaydi); sahifa yangilanganda refresh cookie orqali tiklanadi. | DECISIONS.md D-23 | P1 | [~] |
| R-FE-42 | Spec'da nomlanmagan yo'llar: `/samples(/:id)`, `/substances(/:id)`, `/reagents`, `/stability(/:id)`; kompaniya sahifalari super_admin'ga yopiq. | DECISIONS.md D-29 | P1 | [x] |
| R-FE-43 | Dashboard tarkibi: chemist — biriktirilgan namunalar statuslar bo'yicha; kontrolyor — o'z namunalari. | DECISIONS.md D-33 | P6 | [ ] |
| R-FE-44 | Dashboard tarkibi: lab_head — biriktirish/tasdiq kutayotganlar, harorat alertlari, `low_stock`, `is_expired`, stabilizatsiya muddatlari; `admin` — LabHead dashboardi. | DECISIONS.md D-33 | P6 | [ ] |
| R-FE-45 | Dashboard tarkibi: director — statuslar bo'yicha umumiy sonlar va yakunlanmagan protokollar. | DECISIONS.md D-33 | P6 | [ ] |

## FLOW — Asosiy ish oqimi (E2E)

| ID | Talab | Manba | Faza | Holat |
|---|---|---|---|---|
| R-FLOW-01 | E2E: kontrolyor namuna kiritadi (tur, lot, seriya) → `pending_assignment`. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-02 | E2E: lab_head kimyogarga biriktiradi → protokol avtomatik yaratiladi → kimyogarga xabar (ekran + real vaqt + Telegram). | 17-workflow §17 | P12 | [ ] |
| R-FLOW-03 | E2E: kimyogar namuna sahifasida fayl yuklaydi → yuboradi → `submitted`. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-04 | E2E: lab_head tasdiqlaydi → namuna `approved`. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-05 | E2E: director protokolni yakunlaydi → `finalized`. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-06 | E2E: namuna reyestrda qidiriladi va fayli yuklab olinadi. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-07 | E2E: lab_head/director stabilizatsiya boshlaydi va checkpointlarni qo'lda belgilaydi. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-08 | E2E: fon jarayoni muddat yaqinlashganda/o'tganda bildirishnoma yuboradi. | 17-workflow §17 | P12 | [ ] |
| R-FLOW-09 | E2E: kimyogar har checkpoint uchun natija kiritadi → barcha checkpointlar `completed` → study avtomatik `completed`. | 17-workflow §17, DECISIONS.md D-56 | P12 | [ ] |
| R-FLOW-10 | E2E: rad etish oqimi — rad → protokol va namuna `rejected` (sabab saqlangan, xabarnomalar) → kimyogar faylni yangilab qayta yuboradi → `submitted` → tasdiq. | DECISIONS.md D-14 | P12 | [ ] |
| R-FLOW-11 | E2E: `reagent`/`standard_substance` namunasi lab_head pasporti bilan protokolsiz `approved` bo'ladi. | 03-samples §3 | P12 | [ ] |

## Holat izohlari

`[x]` bo'lmagan qatorlar sababi (faqat ishlov berilgan fazalar uchun). Faza yopilganda yangilanadi.

### P1
- R-SEC-04 `[~]` — `validate()` middleware va Zod tayyor; har endpoint'da qo'llanishi modullar bilan (P2+).
- R-ARCH-02 `[~]` — middleware va router ulash bor; Socket.IO (P6) va bot (P11) keyin. D-21: entry point `server.ts`.
- R-ARCH-04 `[~]` — `withTransaction()` bor va test qilingan; qoida har modulda qo'llanadi.
- R-ARCH-06 `[~]` — swagger konfiguratsiyasi bor; endpoint annotatsiyalari modullar bilan.
- R-ARCH-07 `[~]` — `/docs` faqat development'da (testlangan); login formasi P2 da (Q-63 ochiq).
- R-ARCH-14 `[ ]` — hali birorta modul yo'q (birinchisi P2).
- R-ARCH-15 `[~]` — 14 modul papkasi bor; kod tegishli fazalarda.
- R-ARCH-21 `[~]` — migratsiya runner tayyor; baseline schema fayllari P2 dan.
- R-ARCH-61 `[~]` — `createApp()` testlangan; graceful shutdown uchun avtomatik test yo'q (qo'lda tekshirildi).
- R-FE-03, R-FE-04 `[~]` — `client.ts` va `useBootstrapAuth` bor; modul API/hook'lari tegishli fazalarda.
- R-FE-07 `[~]` — umumiy tiplar (`Role`, `User`, `ApiError`, `Paginated`); modul tiplari keyin.
- R-FE-08 `[~]` — Table, Modal, Spinner, Pagination tayyor; NotificationBell — stub (P6).
- R-FE-41 `[~]` — xotirada saqlash va tiklash mock bilan testlangan; `/auth/refresh` endpointi P2 da.

### Boshqa fazalar (P1 da oldindan qisman bajarilgan)
- R-FE-11/12/13/14/15/17 `[x]` — Sidebar elementlari va rol bo'yicha ko'rinishi (D-28) testlangan; sahifalarning o'zi tegishli fazada.
- R-REG-11/12 `[x]` — `/protocols`, `/protocols/:id` → `/registry` redirect testlangan.
- R-FE-39 `[~]` — frontend RoleRoute testlangan; backend ruxsatlari P2 da.
- R-AUTH-18 `[~]` — 401 interceptor + single-flight refresh mock bilan testlangan; endpoint P2.
- R-AUTH-19 `[~]` — Zustand authStore bor; login oqimi P2.
- R-I18N-05 `[~]` — ESLint `i18next/no-literal-string` pages/components'da error (testlangan); P12 da to'liq audit.
- R-I18N-06 `[x]` — uz/ru/en kalitlari parity testi har `npm run check` da ishlaydi.

## Statistika

_`npm run checklist:stats` bilan hisoblanadi — qo'lda tahrirlamang._

### Bo'limlar bo'yicha

| Bo'lim | Jami | [x] | [~] | [ ] |
|---|---|---|---|---|
| ROLE — Rollar va ruxsat matritsasi | 79 | 0 | 0 | 79 |
| TENANT — Ko'p-kompaniyalilik | 16 | 0 | 0 | 16 |
| SAMPLE — Namunalar | 41 | 0 | 0 | 41 |
| PASS — Namuna pasporti | 25 | 0 | 0 | 25 |
| REG — Reyestr | 17 | 2 | 0 | 15 |
| PROTO — Protokollar | 62 | 0 | 0 | 62 |
| SUBST — Moddalar | 11 | 0 | 0 | 11 |
| REAG — Reaktivlar va Xarajat jurnali | 23 | 0 | 0 | 23 |
| TEMP — Harorat monitoringi | 18 | 0 | 0 | 18 |
| STAB — Stabilizatsiya | 37 | 0 | 0 | 37 |
| NOTIF — Xabarnomalar | 28 | 0 | 0 | 28 |
| USER — Foydalanuvchilar, Admin panel, Ruxsatlar | 18 | 0 | 0 | 18 |
| AUDIT — Audit va Faoliyat jurnali | 15 | 0 | 0 | 15 |
| FILE — Fayllarni saqlash | 11 | 0 | 0 | 11 |
| TG — Telegram | 18 | 0 | 0 | 18 |
| I18N — Ko'p tillilik | 9 | 7 | 1 | 1 |
| AUTH — Autentifikatsiya va xavfsizlik | 23 | 0 | 2 | 21 |
| SEC — Xavfsizlik choralari | 7 | 4 | 1 | 2 |
| ARCH — Texnik arxitektura (env, middleware, jadvallar, infratuzilma) | 83 | 19 | 7 | 57 |
| FE — Frontend sahifalar, yo'llar, Sidebar | 45 | 13 | 6 | 26 |
| FLOW — Asosiy ish oqimi (E2E) | 11 | 0 | 0 | 11 |
| **Jami** | 597 | 45 | 17 | 535 |

### Fazalar bo'yicha

| Faza | Jami | [x] | [~] | [ ] |
|---|---|---|---|---|
| P1 | 50 | 36 | 13 | 1 |
| P2 | 84 | 2 | 3 | 79 |
| P3 | 20 | 0 | 0 | 20 |
| P4 | 71 | 4 | 0 | 67 |
| P5 | 131 | 0 | 0 | 131 |
| P6 | 40 | 0 | 0 | 40 |
| P7 | 36 | 0 | 0 | 36 |
| P8 | 30 | 1 | 0 | 29 |
| P9 | 58 | 0 | 0 | 58 |
| P10 | 25 | 1 | 0 | 24 |
| P11 | 26 | 0 | 0 | 26 |
| P12 | 26 | 1 | 1 | 24 |
| **Jami** | 597 | 45 | 17 | 535 |
