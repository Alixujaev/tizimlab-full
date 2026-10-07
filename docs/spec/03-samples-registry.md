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
