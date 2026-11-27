# Deploy checklist (P18–P19)

Deploy qo'lda (deploy workflow o'chirilgan). Har qadam bajarilgach belgilang. CLAUDE.md ga emas, shu faylga yoziladi.

## 0. Oldindan

- [ ] Zaxira: `pg_dump -Fc` (to'liq baza) + Contabo Auto Backup snapshot — migratsiyadan OLDIN, tiklash sinab ko'rilgan.
- [ ] R2 zaxirasi/versiyalash yoqilgan (fayllar o'chirilmaydi, faqat qo'shiladi).
- [ ] Deploy foydalanuvchisining SSH host key'i `known_hosts` da tasdiqlangan (fingerprint server konsolidan solishtirilgan); `StrictHostKeyChecking` o'chirilmagan.

## 1. pgvector (P19, D-190) — migratsiyadan oldin MAJBURIY

```bash
sudo apt-get update
sudo apt-get install -y postgresql-16-pgvector      # PostgreSQL 16 uchun
sudo -u postgres psql -d <db_nomi> -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;"
sudo -u postgres psql -d <db_nomi> -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

Kengaytmani superuser bir marta yaratadi — ilova foydalanuvchisida `CREATE EXTENSION` huquqi bo'lmasa ham `028_rag.sql`
(`IF NOT EXISTS`) o'tadi. Paket o'rnatilmagan bo'lsa migratsiya "pgvector kengaytmasi serverda o'rnatilmagan" xatosi
bilan to'xtaydi (hech narsa yarim qo'llanmaydi — har migratsiya alohida tranzaksiya).

## 2. Env (`backend/.env`, sirlar repoga yozilmaydi)

| O'zgaruvchi | Qiymat | Izoh |
|---|---|---|
| `AI_ENABLED` | `true` | P18; uchalasidan biri yo'q — AI o'chiq |
| `ANTHROPIC_API_KEY` | (sir) | |
| `AI_MODEL` | masalan `claude-opus-5-5` | |
| `AI_MAX_FILE_MB` | `10` | 1..30 |
| `AI_DAILY_LIMIT_PER_COMPANY` | `200` | ekstraksiya + OCR |
| `EMBEDDING_PROVIDER` | `voyage` | `none` — faqat matn qidiruv |
| `EMBEDDING_API_KEY` | (sir) | Voyage AI kaliti |
| `EMBEDDING_MODEL` | masalan `voyage-4` | |
| `EMBEDDING_DIM` | `1024` | ustun o'lchami, o'zgartirmang |
| `EMBEDDING_API_URL` | bo'sh | faqat MongoDB Atlas'da yaratilgan Voyage kaliti uchun |
| `OOS_CHAT_DAILY_LIMIT_PER_COMPANY` | `300` | |

Kompaniya darajasida AI ni super_admin "Kompaniyalar" sahifasida yoqadi (`companies.ai_enabled`).

## 3. Migratsiyalar

`npm run build` → `npm run migrate:dist -w backend`. Yangi fayllar (faqat oldinga):

- P18: `025_ai.sql`, `026_reagent_lot_fields.sql`, `027_protocol_metadata.sql` (backfill: protokol fayllari bog'lanadi, rad etish tarixi)
- P19: `028_rag.sql` (pgvector, `rag_index_jobs`, `doc_chunks`, HNSW), `029_peak_results.sql`, `030_oos.sql`

Tekshiruv: `npm run migrate:status -w backend` — hammasi `applied`.

## 4. Ishga tushirish va RAG backfill

- [ ] Server qayta ishga tushirildi (`npm start`); logda "AI yordamchi o'chiq" yoki xato yo'q.
- [ ] Mavjud tasdiqlangan hujjatlarni indekslash: `npm run rag:reindex:dist -w backend` (yoki UI "Bilim bazasi" → qayta indekslash).
- [ ] `GET /api/v1/rag/status` — `failed` bo'sh yoki sabablari tushunarli; `searchMode` kutilganidek.
- [ ] Ixtiyoriy smoke (haqiqiy kalit bilan, serverda emas — lokal): `npm run ai:smoke -- --file <etiketka>`, `npm run rag:smoke`.

## 5. Orqaga qaytarish

Migratsiyalar faqat oldinga. Muammo bo'lsa: AI ni o'chirish (`AI_ENABLED=false` yoki kompaniya flag'i) — qo'lda
kiritish va OOS jurnali ishlashda davom etadi; kod versiyasini qaytarish yangi jadvallarga tegmaydi. Bazani tiklash —
faqat 0-qadamdagi zaxiradan.
