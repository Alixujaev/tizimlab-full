# AI provayderlari — almashtirish va narx (D-201)

AI qatlami provayderdan mustaqil (`backend/src/modules/ai/ai.provider.ts` → `LlmProvider`). Ekstraksiya
(namuna/reaktiv/ND), OCR, peak va OOS chat bir xil yo'l bilan ishlaydi. Har bir javob Zod sxemasidan o'tadi;
mos kelmasa `status=failed`. Xavfsizlik promptlari (hujjat ichidagi ko'rsatmalarga amal qilinmaydi), `image_quality`,
`confidence` va null-qoidalari provayderga bog'liq emas.

## Almashtirish

`backend/.env` da quyidagilarni o'zgartirib, ilovani qayta ishga tushiring:

| Provayder | `AI_PROVIDER` | Kalit | Standart model (`AI_MODEL` bo'sh bo'lsa) |
|---|---|---|---|
| OpenAI (standart) | `openai` | `OPENAI_API_KEY` | `gpt-6-luna` (reasoning effort `low`) |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | `gemini-3.1-flash-lite` |
| Anthropic (zaxira, standart emas) | `anthropic` | `ANTHROPIC_API_KEY` | yo'q, `AI_MODEL` majburiy |

- `AI_ENABLED=true` bo'lishi shart. Kalit yo'q bo'lsa AI o'chiq bo'ladi: `/ai/*` 503 qaytaradi, qo'lda kiritish
  ishlaydi va jurnalga ogohlantirish yoziladi.
- Provayderni almashtirsangiz, `AI_MODEL` ni yo bo'sh qoldiring, yo yangi provayder modeliga moslang. Eski
  provayder modeli nomi yangi provayderda 400 (`AI_BAD_REQUEST`) beradi.
- Noto'g'ri `AI_PROVIDER` qiymati berilsa, ilova env xatosi bilan ishga tushmaydi.
- Ishga tushirishdan oldin smoke-test bilan tekshiring (pastda).

## Taxminiy narx

Narxlar USD / 1M token, standart tarif. Manba: rasmiy narx sahifalari, 2026-11 holati. Ishlatishdan oldin qayta
tekshiring.

| Model | Kirish | Chiqish | Izoh |
|---|---|---|---|
| `gpt-6-luna` | 0.10 | 0.50 | rasm + PDF (`input_file`), eng arzon joriy OpenAI |
| `gemini-3.1-flash-lite` | 0.25 | 1.50 | rasm + PDF, stable; o'chirilish sanasi 2027-05-07 (o'rnini `gemini-3.5-flash-lite` egallaydi) |
| `gemini-3.5-flash-lite` | 0.30 | 2.50 | stable, o'chirilish sanasi e'lon qilinmagan |

Bitta etiketka yoki CoA uchun odatda ~1–3 ming kirish tokeni (rasm/PDF sahifasi) va ~300–800 chiqish tokeni
ketadi. Demak bitta ekstraksiya `gpt-6-luna` da ≈ $0.0005, `gemini-3.1-flash-lite` da ≈ $0.001 turadi. Aniq raqam
uchun smoke hisobotiga qarang. Kompaniya kunlik limiti (`AI_DAILY_LIMIT_PER_COMPANY`) xarajatni chegaralaydi.

Gemini'ning thinking tokenlari chiqish sifatida hisoblanadi (jurnaldagi `output_tokens` ga qo'shiladi).

## Mintaqa va ma'lumot

- O'zbekiston ikkala provayderning qo'llab-quvvatlanadigan davlatlar ro'yxatida bor. Ro'yxatdan tashqarida OpenAI
  akkauntni bloklashi mumkin.
- Ikkala adapter `store: false` yuboradi: so'rov provayder tomonida keyinroq olish uchun saqlanmaydi.
- Gemini **bepul** tarifida yuborilgan kontent Google mahsulotlarini yaxshilashga ishlatiladi va uni inson ko'rib
  chiqishi mumkin. Laboratoriya hujjatlari uchun faqat **pullik** tarif (billing yoqilgan) kalitidan foydalaning.

## Smoke-test (qo'lda, CI da ishlamaydi)

```bash
# bitta provayder
npm run ai:smoke -- --dir ./smoke/labels --kind sample --provider gemini
# ikkala provayderni bir papkada ketma-ket solishtirish (maydonlar yonma-yon)
npm run ai:smoke -- --dir ./smoke/labels --kind sample --compare openai,gemini
# ND
npm run ai:smoke -- --dir ./smoke/nd --kind nd --compare openai,gemini
```

- Papkadagi `expected.json` maydon bo'yicha aniqlikni hisoblash uchun ishlatiladi. Format skript boshidagi izohda.
- Konsolga faqat o'lchovlar chiqadi: holat, vaqt, tokenlar, narx, aniqlik.
- Maydon qiymatlari faqat lokal `ai-smoke-report.md` fayliga yoziladi. Bu fayl `.gitignore` da, uni commit
  qilmang va ulashmang.
- Model narxi jadvalda bo'lmasa `--price-in 0.1 --price-out 0.5` bering.
