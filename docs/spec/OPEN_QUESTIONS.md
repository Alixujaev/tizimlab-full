# Ochiq savollar

Spec'ni (`LOYIHA.md`) o'qishda topilgan ziddiyatlar, noaniqliklar va yetishmayotgan joylar.
Savol raqamlari (`Q-NN`) va matni o'zgarmaydi. Manba formati: `spec fayl §` + `LOYIHA.md:<qator>`.

**Gate qoidasi — `DECISIONS.md` D-19.** Har faza boshida shu fazaga tegishli savollar ko'riladi:

- **NON-BLOCKING** — texnik default yetarli: "Taklif (default)" qo'llanadi, `DECISIONS.md` ga yangi D-xx yoziladi,
  savol "Hal qilinganlar" ga `✅ D-xx` belgisi bilan ko'chiriladi.
- **BLOCKING** — domen xatti-harakatini (rol/ruxsat, status o'tishi, ma'lumot modeli, foydalanuvchiga ko'rinadigan oqim)
  o'zgartiradi: ish to'xtatiladi va foydalanuvchidan tasdiq so'raladi. Shubha bo'lsa — BLOCKING.

- **BLOCKING — PENDING schema.sql** — production sxemasi (`docs/legacy/schema.sql`) ko'rilgach hal qilinadi;
  "Taklif" ustunida foydalanuvchi tasdiqlagan qism yozilgan.

"Taklif" — faqat taklif, qaror emas. Savol ko'p fazaga tegishli bo'lsa, eng birinchi fazasida turadi.

## P4

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|
| Q-20 | ✅ D-108 | 03-samples §3 | P4 | `other` oddiy oqim — biriktirish → `standard` protokol (D-15 "boshqa turlar"). | NON-BLOCKING |
| Q-25 | ✅ D-109 | 16-architecture §16 | P4 | Voqealar ro'yxati va namuna sahifasida "Harakatlar tarixi" bloki. | NON-BLOCKING |
| Q-26 | ✅ D-110 | 03-samples §3 | P4 | DD.MM.YYYY butun UI'da; sahifa hajmi 20 (D-22); standart saralash `created_at` kamayish bo'yicha. | NON-BLOCKING |
| Q-54 | Fayl turi faqat kengaytma/MIME bo'yicha tekshiriladimi yoki magic-byte bo'yicha ham? | 04 §4, 12 §12 — LOYIHA.md:203,345 | P5 | ✅ D-114 |

## P5

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|
| Q-29 | ✅ D-122 | 04-protocols §4 | P5 | Kamida 5 belgi (to'xtatish sababi bilan bir xil). | NON-BLOCKING |

## P6

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|

## P7

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|
| Q-37 | `low_stock` xabarnomasi qachon yuboriladi (har `out` tranzaksiyadan keyin chegaradan pastga tushganda, bir marta yoki har safar)? `is_expired` uchun xabarnoma yo'q — kerakmi? | 06-reagents §6, 09 §9 — LOYIHA.md:239,245,309 | P7 | Zaxirani kamaytiruvchi tranzaksiya uni chegaradan pastga tushirgan paytda bir marta; zaxira tiklanib yana tushsa — yana. `is_expired` uchun xabarnoma yo'q (D-17). | NON-BLOCKING |

## P9

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|
| Q-46 | Stabilizatsiya xabarnomalari kimga yuboriladi? "24 soatda bir marta" — checkpoint+foydalanuvchi bo'yicha dedup'mi? `stability_overdue` ham takrorlanadimi? _(Izoh: qabul qiluvchilar — D-13; ochiq qism — takrorlanish.)_ | 08-stability §8, 09 §9 — LOYIHA.md:294,310 | P9 | `stability_due_soon` — (checkpoint, qabul qiluvchi) juftligi bo'yicha 24 soatda ko'pi bilan bir marta; `stability_overdue` — `overdue` ga o'tgan paytda bir marta, takrorlanmaydi. | NON-BLOCKING |

## P10

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|
| Q-52 | Admin paneldagi "foydalanuvchi loglarini ko'rish" — faoliyat jurnalining foydalanuvchi bo'yicha filtrimi yoki alohida? | 10 §10 — LOYIHA.md:322 | P10 | Faoliyat jurnalining foydalanuvchi filtri: admin paneldan shu filtr bilan ochiladi, alohida sahifa yo'q. | NON-BLOCKING |

## P11

| ID | Savol | Manba | Faza | Taklif (default) | Turi |
|---|---|---|---|---|---|
| Q-50 | Telegram xabari qaysi tilda yuboriladi (foydalanuvchi tili bazada saqlanmaydi — til faqat `localStorage` da)? | 13-telegram §13, 14 §14 — LOYIHA.md:359,367 | P11 | Telegram foydalanuvchisining `language_code` (`ru`/`en`) bo'yicha, aks holda o'zbekcha; til bazada saqlanmaydi (D-27). | NON-BLOCKING |
| Q-55 | `telegram_link_tokens` amal qilish muddati va bir martalikmi? Bitta Telegram akkaunti bir nechta foydalanuvchiga ulanishi mumkinmi? _(Izoh: saqlash — SHA-256 xesh, bir martalik — D-65; ochiq qism — muddat va bitta akkaunt qoidasi.)_ | 13-telegram §13 — LOYIHA.md:357,473 | P11 | Token bir martalik, 10 daqiqa amal qiladi; bitta Telegram akkaunt faqat bitta foydalanuvchiga ulanadi (band bo'lsa rad etiladi). | NON-BLOCKING |
| Q-56 | WebApp `initData` uchun `auth_date` maksimal yoshi qancha? WebApp login sessiyasi ham 3 sessiya limitiga kiradimi? | 13-telegram §13, 15 §15 — LOYIHA.md:358,380 | P11 | `auth_date` 1 soatdan eski bo'lmasin; WebApp sessiyasi oddiy sessiya — 3 sessiya limitiga kiradi. | NON-BLOCKING |
| Q-57 | `/status` va `/help` bot buyruqlari aniq nimani ko'rsatadi? Bot qaysi tilda javob beradi? | 13-telegram §13 — LOYIHA.md:353 | P11 | `/status` — ulanish holati (foydalanuvchi, kompaniya, rol) va o'qilmagan xabarnomalar soni; `/help` — buyruqlar ro'yxati; til — Q-50 dagi qoida. | NON-BLOCKING |

## Texnik qarz (savol emas)

- **Checklist ↔ test bog'lanishi.** `SPEC_CHECKLIST.md` dagi `[x]` qatorlar R-ID bo'yicha aniq testga bog'lanmagan
  (test nomlari taxminiy). Har `[x]` uchun test nomiga R-ID yoziladi yoki "Holat izohlari" da test fayli ko'rsatiladi.
  P5b qatorlari (R-PROTO-31..40, 59..61, R-ARCH-31/44/49/73/79) kod+test bilan bajarilgan, lekin checklist hali yangilanmagan.
- **Haqiqiy R2 sinovi.** P5 fayl oqimlari faqat `MemoryStorage` bilan testlangan; dev bucket bilan qo'lda
  yuklash/yuklab olish sinovi P6 dan oldin.

## Hal qilinganlar

| ID | Savol | Manba | Faza | Holat |
|---|---|---|---|---|
| Q-01 | Parolni tiklashni kim qila oladi? §1 jadvalda faqat `admin` vazifasida "parol tiklash", §15 "admin boshqa foydalanuvchi parolini tiklashi mumkin", lekin §10 admin panel (parol tiklash bilan) `lab_head`/`director`/`admin` uchun ochiq va matritsada `lab_head` "Foydalanuvchilar boshqaruvi ✅". `lab_head` parol tiklay oladimi? | 01-roles §1, 10 §10, 15 §15 — LOYIHA.md:52,54,74,322,386 | P2 | ✅ RESOLVED → D-16 |
| Q-02 | `lab_head` "Foydalanuvchilar boshqaruvi ✅" va `admin` "✅ To'liq" farqi nimada? `lab_head` qaysi amallarni qila olmaydi (yaratish, rol o'zgartirish, o'chirish, individual ruxsat berish)? `lab_head` `admin` rolli foydalanuvchi yarata oladimi? | 01-roles §1 — LOYIHA.md:74 | P2 | ✅ RESOLVED → D-16 |
| Q-03 | Moddalar: `lab_head` "Ko'rish + tahrirlash", `admin` "✅ To'liq". §5 ga ko'ra yaratish ham `lab_head` da bor. Farq — o'chirish huquqimi? Moddani o'chirish umuman mavjudmi (namunalar unga bog'langan)? | 01-roles §1, 05 §5 — LOYIHA.md:69,228 | P3 | ✅ RESOLVED → D-30 |
| Q-04 | Kontrolyor namunalardan "Faqat o'ziniki"ni ko'radi, lekin "Reyestrni ko'rish ✅" — reyestrda kontrolyor boshqalar yaratgan `approved` namunalarni (va `/registry/:id` tafsilotlarini) ko'radimi? Kimyogar uchun ham xuddi shu savol ("O'ziga biriktirilgan" vs reyestr ✅). | 01-roles §1, 03 §3 — LOYIHA.md:63,68,150 | P4 | ✅ RESOLVED → D-31 |
| Q-20 | `other` turi uchun pasport yo'q (§3 ro'yxatida yo'q) — `other` oddiy biriktirish → protokol yo'lidan o'tadimi? | 03-samples §3 — LOYIHA.md:104,140 | P4 | ✅ D-108 |
| Q-25 | `sample_tracking` ("voqealar tarixi") qaysi hodisalarni yozadi va UI'da qayerda ko'rsatiladi? | 16-architecture §16 — LOYIHA.md:476 | P4 | ✅ D-109 |
| Q-26 | Sana formati DD.MM.YYYY faqat reyestr filtri uchunmi yoki butun UI uchunmi? Sahifalash (page size), saralash standartlari yo'q. | 03-samples §3 — LOYIHA.md:152 | P4 | ✅ D-110 |
| Q-05 | Individual ruxsatlarni "olib tashlash" (§10) — rolga berilgan ruxsatni bekor qilish (deny) ham mumkinmi yoki faqat qo'shimcha (grant) beriladimi? Rol + individual ruxsat birlashish qoidasi qanday? (Katalog D-10 bo'yicha P2 da, lekin semantika ham kerak.) | 01-roles §1, 10 §10 — LOYIHA.md:77,324 | P2 | ✅ RESOLVED → D-32 |
| Q-06 | Individual ruxsatlarni kim boshqaradi: faqat `admin` ("Foydalanuvchilar, ruxsatlar" — §1) yoki `lab_head` ham? | 01-roles §1, 10 §10 — LOYIHA.md:54,324 | P2 | ✅ RESOLVED → D-16 |
| Q-07 | `director` dashboard'da "umumiy statistika" — qaysi ko'rsatkichlar? Umuman har rol dashboardi tarkibi spec'da yo'q; frontend'da `Chemist/Director/LabHead/Inspector/SuperAdmin` dashboardlari bor, lekin `admin` uchun dashboard nomlanmagan — admin qaysi dashboardni ko'radi? | 01-roles §1, 16 §16 — LOYIHA.md:53,451 | P6 | ✅ RESOLVED → D-33 |
| Q-08 | Kompaniyani "o'chirish" — jismoniy o'chirishmi yoki nofaollashtirish (`is_active=false`)? Nofaol kompaniya foydalanuvchilari login qila oladimi, faol sessiyalari/tokenlari nima bo'ladi? | 02-multitenancy §2 — LOYIHA.md:88 | P2 | ✅ RESOLVED → D-34 |
| Q-09 | Kompaniya yaratilganda uning birinchi foydalanuvchisini (masalan `admin`) kim yaratadi? `super_admin` kompaniya ichida foydalanuvchi yarata oladimi? `super_admin` qanday paydo bo'ladi (seed/CLI)? | 02-multitenancy §2, 01 §1 — LOYIHA.md:49,56,88 | P2 | ✅ RESOLVED → D-35 |
| Q-10 | `slug` qoidalari (format, unikallik, o'zgartirsa bo'ladimi) va u nimada ishlatiladi (login, URL)? | 02-multitenancy §2 — LOYIHA.md:88 | P2 | ✅ D-95 |
| Q-11 | §0 "muddati o'tayotgan namunalar" uchun avtomatik eslatma va'da qilingan, lekin namunada muddat maydoni ham, bunga mos xabarnoma turi ham (§9) yo'q. Bu funksiya kerakmi? Qaysi maydon va qaysi tur? | 00-overview §0, 09 §9 — LOYIHA.md:15,302-310 | P4/P6 | ✅ RESOLVED → D-17 |
| Q-12 | Namunaning to'liq maydonlari ro'yxati yo'q: spec faqat tur, modda, lot, seriya raqam, miqdor nomlaydi. O'lchov birligi, ishlab chiqaruvchi, yetkazib beruvchi, ishlab chiqarilgan/yaroqlilik sanasi, namuna kodi/raqami (avtomatik?) kerakmi? | 03-samples §3, 17 §17 — LOYIHA.md:130,501 | P4 | ✅ RESOLVED → D-68 (qisman; `expires_at`/`deadline` — SCHEMA_DIFF U-1) |
| Q-13 | D-02 dan keyin namuna `rejected` statusi (§3 diagramma) hali ishlatiladimi? Namuna hech qachon `rejected` holatida qolmaydimi yoki (masalan pasport rad etilganda) bo'ladimi? `sample_rejected` xabarnomasi qachon yuboriladi? | 03-samples §3, 09 §9, D-02 — LOYIHA.md:125,306 | P4/P5 | ✅ RESOLVED → D-14 |
| Q-14 | Status diagrammasida `submitted` ga o'tish chizig'i `stopped` ostidan chizilgan. Protokolni `in_progress` dan yuborish mumkinmi, `stopped` dan ham mumkinmi? | 03-samples §3 — LOYIHA.md:113-121 | P4/P5 | ✅ RESOLVED → D-36 |
| Q-15 | Kimyogarni qayta biriktirish (boshqa kimyogarga o'tkazish) mumkinmi, qaysi statuslarda? Bunda avtomatik yaratilgan protokol nima bo'ladi? | 03-samples §3 — LOYIHA.md:111,132 | P4 | ✅ RESOLVED → D-37 |
| Q-16 | Tahlilni to'xtatish/davom ettirishni faqat kimyogar qiladimi yoki `lab_head` ham? Davom ettirishda ham sabab kerakmi? To'xtatilgan namunada fayl yuklash mumkinmi? | 03-samples §3 — LOYIHA.md:115,134 | P4 | ✅ RESOLVED → D-38 |
| Q-17 | Namuna pasporti `pending` holatida rad etilsa (`reviewPassport` reject) — pasport/namuna qaysi holatga o'tadi, sabab kerakmi, qayta yuklash mumkinmi? `pending` pasportli reaktiv namunasi qaysi namuna statusida turadi (`pending_assignment`?) va unga kimyogar biriktirsa bo'ladimi? | 03-samples §3 — LOYIHA.md:142-144 | P4/P5 | ✅ RESOLVED → D-39 |
| Q-18 | `reagent`/`standard_substance` pasportini `chemist` va `director` yuklay oladimi? ("Kontrolyor (yoki boshqa oddiy foydalanuvchi)".) | 03-samples §3 — LOYIHA.md:144 | P4/P5 | ✅ RESOLVED → D-40 |
| Q-19 | `raw_material`/`finished_product` pasportini yuklash huquqi bor (§3), lekin uni ko'rib chiqish (`reviewPassport`) bu turlar uchun ham bormi yoki pasport holatsiz qo'shimcha hujjatmi? | 03-samples §3 — LOYIHA.md:145 | P4/P5 | ✅ RESOLVED → D-41 |
| Q-21 | Pasport orqali avtomatik tasdiqlanganda "ochiq protokollar avtomatik yopiladi" — qaysi statusga (approved? yangi status?) va bunda imzo/xabarnoma bo'ladimi? | 03-samples §3 — LOYIHA.md:143 | P5 | ✅ RESOLVED → D-42 |
| Q-22 | Reyestrdan "o'chirish" (lab_head) semantikasi: namunani jismoniy o'chirishmi, soft-delete'mi, yoki faqat reyestrdan yashirishmi? Protokol, fayllar, stabilizatsiya bog'lanishlari nima bo'ladi? `admin` o'chira oladimi? | 03-samples §3 — LOYIHA.md:155 | P4 | ✅ RESOLVED → D-43 |
| Q-23 | Reyestr qatoridan "protokol faylini yuklab olish" — `finished_product` ning ikki protokoli (`final`/`in_process`) bo'lsa, qaysi fayl? Pasport orqali tasdiqlangan (protokolsiz) namunada nima yuklab olinadi? | 03-samples §3, 04 §4 — LOYIHA.md:154,185 | P4/P5 | ✅ RESOLVED → D-44 |
| Q-24 | `/registry/:id` namuna tafsilot sahifasi va namunalar bo'limidagi namuna sahifasi (`ProtocolSection` joylashgan) — bitta sahifami yoki ikki alohida? Namuna sahifasining yo'li (`/samples/:id`?) spec'da yo'q. | 03-samples §3 — LOYIHA.md:153,157 | P4 | ✅ D-29 |
| Q-27 | `finished_product` ko'p-protokol: `final` va `in_process` protokollar qachon va kim tomonidan yaratiladi (biriktirishda avtomatik ikkalasimi?)? `in_process` bir nechta bo'lishi mumkinmi? Namuna qaysi protokol(lar) tasdiqlanganda `approved` bo'ladi? | 04-protocols §4 — LOYIHA.md:185-191 | P5 | ✅ RESOLVED → D-15 |
| Q-28 | Protokolni yuborish (`submit`) — faqat kimyogarmi? Matritsada `lab_head` va `admin` ham fayl yuklay oladi — ular yuborishi ham mumkinmi? | 01-roles §1, 04 §4 — LOYIHA.md:65,171 | P5 | ✅ RESOLVED → D-45 |
| Q-29 | Rad etish sababiga minimal uzunlik bormi (to'xtatish sababidagi kabi 5 belgi)? | 04-protocols §4 — LOYIHA.md:180 | P5 | ✅ D-122 |
| Q-30 | "Imzo" nimadan iborat — faqat yozuv (kim, rol, vaqt) yoki parolni qayta kiritish/elektron imzo? D-02 bo'yicha rad etilib draft'ga qaytganda oldingi imzolar nima bo'ladi? _(Izoh: D-14 dan keyin protokol draft'ga qaytmaydi — `rejected → submitted`.)_ | 04-protocols §4 — LOYIHA.md:213-215 | P5 | ✅ RESOLVED → D-46 |
| Q-31 | Protokol fayllarini (asosiy fayl, protokol pasporti, qo'shimcha fayllar) qaysi statuslarda yuklash/almashtirish/o'chirish mumkin (masalan `submitted`/`approved` da taqiqlanadimi)? Protokol pasportini va qo'shimcha fayllarni kim o'chira oladi? | 04-protocols §4 — LOYIHA.md:195-203 | P5 | ✅ RESOLVED → D-47 |
| Q-32 | `.docx` eksportni kim va qaysi statuslarda yuklab oladi? Hujjat tarkibi ("holat, imzolar, moddaning nomi va h.k.") to'liq ro'yxati va qaysi tilda? | 04-protocols §4 — LOYIHA.md:207 | P5 | ✅ RESOLVED → D-48 |
| Q-33 | `protocol_files` (qo'shimcha fayllar) faqat `finished_product` protokollari uchunmi yoki istalgan protokolga ruxsat? | 04-protocols §4 — LOYIHA.md:201 | P5 | ✅ RESOLVED → D-49 |
| Q-34 | Direktor qaysi sahifada `approved` protokollarni ko'rib, finalizatsiya qiladi (alohida Protokollar sahifasi olib tashlangan)? | 04-protocols §4, 03 §3 — LOYIHA.md:150,178 | P5 | ✅ RESOLVED → D-50 |
| Q-35 | Farmakopiya (EP, BP, UzDSt, USP, OTHER) moddaga bittami yoki parametr darajasidami? Parametr nomi ham uch tildami? Parametr "metod" — erkin matnmi? | 05-substances §5 — LOYIHA.md:224-226 | P3 | ✅ RESOLVED → D-67 |
| Q-36 | Moddalar sahifasi "asosiy navigatsiyada emas" — `lab_head`/`admin` moddalar ro'yxatiga (yaratish uchun) qaysi kirish nuqtasidan boradi? Reaktivlar, Stabilizatsiya, Xarajat sahifalari uchun ham xuddi shu savol. | 05 §5, 16 §16 — LOYIHA.md:228,463 | P3/P7/P9 | ✅ D-29 |
| Q-38 | Reaktivlar ro'yxati, zaxira tranzaksiyalari (`in`/`out`/`adjustment`/`disposal`) va hujjat yuklashni kim bajaradi? Matritsada "Ko'rish" rollar (masalan kimyogar) sarf (`out`) yoza oladimi? Xarajat sahifalariga kim kiradi? | 01-roles §1, 06 §6 — LOYIHA.md:70,243 | P7 | ✅ RESOLVED → D-51 |
| Q-39 | Reaktiv maydonlari to'liq emas (nomi, o'lchov birligi, lot, ishlab chiqaruvchi va h.k.); `reagent_documents` turlari (passport / tahlil natijasi) fayl limiti 20MB yoki 50MB? | 06-reagents §6, D-06 — LOYIHA.md:236-243 | P7 | ✅ RESOLVED → D-69 (qisman; fayl limiti — SCHEMA_DIFF U-9) |
| Q-40 | Harorat: sensor (joy/xona) maydonlari, qo'lda o'qishni kim kiritadi ("Ko'rish" rollari kirita oladimi?), namlik uchun ham alohida min/max bormi? Alertni "ko'rildi/yopildi" deb belgilash bormi? `temperature_alert` takrorlanish qoidasi? | 07-temperature §7, 01 §1 — LOYIHA.md:71,251-253 | P8 | ✅ RESOLVED → D-52 |
| Q-41 | Matritsada natija kiritish "chemist ✅ (biriktirilgan)" — kimyogar nimaga biriktiriladi (study'ga, checkpoint'ga, yoki asl namunaga)? Study'da mas'ul kimyogar maydoni bormi? | 01-roles §1, 08 §8 — LOYIHA.md:73 | P9 | ✅ RESOLVED → D-53 |
| Q-42 | Checkpointlarni kim kiritadi: §8 "lab boshlig'i", diagramma "Lab boshlig'i / direktor / admin boshlaydi", §17 "Lab boshlig'i / Direktor". Director/admin checkpoint qo'sha/o'zgartira/o'chira oladimi? | 08-stability §8, 17 §17 — LOYIHA.md:72,269,273,515 | P9 | ✅ RESOLVED → D-54 |
| Q-43 | Checkpoint `pending → in_progress` va `→ completed` o'tishlari qanday sodir bo'ladi (birinchi natija kiritilganda avtomatikmi, tugma bilanmi)? `pending` dan to'g'ridan-to'g'ri `overdue` bo'lishi mumkinmi? | 08-stability §8 — LOYIHA.md:285 | P9 | ✅ RESOLVED → D-55 |
| Q-44 | Study statuslari: faqat `active` nomlangan. "tekshiruv yakunlanadi" (§17) — `completed` status bormi, avtomatikmi (barcha checkpointlar completed bo'lganda)? Bekor qilish bormi? | 08-stability §8, 17 §17 — LOYIHA.md:275,519 | P9 | ✅ RESOLVED → D-56 |
| Q-45 | `result_status` (`pass`/`warning`/`fail`) qo'lda tanlanadimi yoki `current_value` va `specification` dan hisoblanadimi? `initial_value` (T0) qayerdan olinadi? | 08-stability §8 — LOYIHA.md:290 | P9 | ✅ RESOLVED → D-57 |
| Q-47 | Bitta namunada bir vaqtda bir nechta faol study bo'lishi mumkinmi? | 08-stability §8 — LOYIHA.md:265 | P9 | ✅ RESOLVED → D-58 |
| Q-48 | `sample_approved`/`sample_rejected`, `protocol_submitted`, `protocol_approved`/`protocol_rejected` qabul qiluvchilari aniqlanmagan (kimyogar? kontrolyor? kompaniyaning barcha `lab_head` lari?). | 09-notifications §9 — LOYIHA.md:304-307 | P6 | ✅ RESOLVED → D-13 |
| Q-49 | Xabarnomalarni o'qilgan deb belgilash, "hammasini o'qish", o'chirish, saqlash muddati bormi? Bell ikonasida o'qilmaganlar soni? | 09-notifications §9 — LOYIHA.md:314 | P6 | ✅ RESOLVED → D-59 |
| Q-51 | Qaysi hodisalar audit/faoliyat jurnaliga yoziladi (login, CRUD, status o'tishlari, fayl yuklash...)? Ikkala jurnal bitta `audit_log` jadvalidanmi? Saqlash muddati, filtrlar, eksport? | 11-audit §11, 16 §16 — LOYIHA.md:336-339,482 | P10 | ✅ RESOLVED → D-60 |
| Q-53 | Generic `files` moduli qaysi ob'ektlarga (protokol/pasport/reaktiv hujjatlari o'z ustunlari bilanmi yoki `files` jadvali orqalimi) xizmat qiladi va qaysi endpoint/UI uni ishlatadi? Imzolangan URL amal qilish muddati? | 12-files §12 — LOYIHA.md:345 | P5 | ✅ RESOLVED → D-61 |
| Q-58 | 3 sessiya limitida "eskisi" — eng eski yaratilganmi yoki eng uzoq ishlatilmaganmi? | 15-auth §15 — LOYIHA.md:380 | P2 | ✅ D-89 |
| Q-59 | Idle timeout qanday o'lchanadi: har API so'rov sessiyaning `last_activity` ni yangilaydimi yoki faqat refresh? Idle'da serverdan qaysi xato kodi qaytadi va frontend nima qiladi? | 15-auth §15, 16 §16 — LOYIHA.md:380,410 | P2 | ✅ D-90 |
| Q-60 | Parol siyosati (minimal uzunlik, murakkablik) va login identifikatori (email? username? kompaniya slug bilan?) aniqlanmagan. Login urinishlariga alohida rate-limit kerakmi? | 15-auth §15 — LOYIHA.md:384-386 | P2 | ✅ RESOLVED → D-66 |
| Q-61 | Refresh cookie atributlari (`SameSite`, `Secure`, `path=/api/v1/auth/refresh`?) va CORS siyosati spec'da yo'q. | 15-auth §15 — LOYIHA.md:378 | P2 | ✅ D-88 |
| Q-62 | JWT sirlari va R2 uchun aniq env o'zgaruvchi nomlari spec'da berilmagan (faqat `R2_*`). `.env.example` da `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` deb nomlandi — tasdiqlash kerak. | 15 §15, 12 §12, 16 §16 — LOYIHA.md:345,406 | P1/P2 | ✅ D-25 (foydalanuvchi tasdig'i: D-18) |
| Q-63 | Swagger UI "login formasi bilan" — Swagger'ga kirish uchun alohida login (basic auth?) yoki Swagger ichida JWT olish formasi? | 16-architecture §16 — LOYIHA.md:494 | P1 | ✅ D-93 |
| Q-64 | Sidebar elementlari (Dashboard, Namunalar, Reyestr, Harorat, Foydalanuvchilar, Faoliyat) rol bo'yicha qanday ko'rinadi? Masalan kontrolyor/chemist "Foydalanuvchilar" va "Faoliyat" ni ko'rmaydi (matritsa bo'yicha), lekin bu sidebar uchun aniq yozilmagan. Profil sahifasiga kirish joyi? | 16-architecture §16, 01 §1 — LOYIHA.md:458,463 | P1/P6 | ✅ D-28 |
| Q-65 | Frontend'da "Inspector" dashboardi — bu `kontrolyor` rolimi? (Nomlash farqi.) | 16-architecture §16 — LOYIHA.md:451 | P6 | ✅ D-127 |
| Q-66 | Til almashtirgichi — foydalanuvchi profilida (bazada) ham saqlanadimi yoki faqat `localStorage`? (Q-50 bilan bog'liq.) | 14-i18n §14 — LOYIHA.md:367 | P1 | ✅ D-27 |
