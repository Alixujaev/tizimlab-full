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
