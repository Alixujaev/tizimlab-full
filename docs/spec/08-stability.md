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
