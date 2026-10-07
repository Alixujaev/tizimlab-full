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
