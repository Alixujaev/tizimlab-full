# SCHEMA_DIFF — eski production sxemasi ↔ spec/DECISIONS

Eski (production) sxema va yangi tizim talablari (`LOYIHA.md`, `DECISIONS.md`) orasidagi farqlar.
Manba: [`docs/legacy/schema.sql`](../legacy/schema.sql) (pg_dump 18, faqat DDL). Qator raqamlari shu faylga tegishli.

Belgilar: **→ D-xx** — qaror qabul qilingan; **⚠ FOYDALANUVCHI QARORI KERAK** — variantlar yozilgan, tanlov kutilmoqda.

Hozircha faqat **Audit** bo'limi; qolgan bo'limlar keyingi topshiriqda qo'shiladi.

## Audit

### Eski mexanizm

- Funksiya `public.audit_log_trigger()` (`schema.sql:146-170`, `SECURITY DEFINER`) — har `INSERT`/`UPDATE`/`DELETE` da
  `audit_logs` ga yozadi: `table_name` (`TG_TABLE_NAME`), `record_id`, `action` (`TG_OP`),
  `old_values = to_jsonb(OLD)`, `new_values = to_jsonb(NEW)` — ya'ni qatorning **barcha** ustunlari.
- `AFTER INSERT OR DELETE OR UPDATE ... FOR EACH ROW` triggerlari (`schema.sql:1474-1516`) — 7 ta jadval:
  `protocol_signatures`, `protocol_values`, `protocols`, `reagent_transactions`, `sample_documents`, `samples`, `users`.
- `audit_logs` jadvali (`schema.sql:194-206`) da `user_id`, `company_id`, `ip_address`, `user_agent` ustunlari bor, lekin
  trigger ularni **to'ldirmaydi** (INSERT faqat 5 ustun bilan) — trigger yozuvlarida harakatni kim, qaysi kompaniyada
  bajargani yo'q.
- Nom farqi: eski jadval `audit_logs`, spec §16 va D-60 — `audit_log`.

### (a) Sezgir ustunlar → D-62

`audit_users` triggeri (`schema.sql:1516`) `to_jsonb(NEW/OLD)` orqali `users.password_hash` ni
`audit_logs.old_values`/`new_values` ga yozadi. Boshqa sezgir ustunlar: `sessions.token_hash` (`:486`),
`telegram_link_tokens.token` (`:595`, xom token) — ularning jadvallarida trigger yo'q, lekin qoida umumiy.

Qaror **D-62**: yangi tizimda audit yozuviga yozishdan oldin `password_hash` va token/token hash'lari olib tashlanadi.

### (b) ETL (P12): eski `audit_logs` tarixi — ⚠ FOYDALANUVCHI QARORI KERAK

| Variant | Mazmuni | Oqibatlari |
|---|---|---|
| 1. Ko'chirish + scrub | `audit_logs` ko'chiriladi; `table_name = 'users'` qatorlarida `old_values` va `new_values` dan `password_hash` kaliti olib tashlanadi (`jsonb - 'password_hash'`). | Tarix saqlanadi. Ko'chirilgan yozuvlarda `user_id`/`company_id` yo'q — faoliyat jurnalida (kompaniya bo'yicha, D-60) ko'rinmaydi, faqat `super_admin` audit jurnalida. `protocol_values` yozuvlari yangi sxemada yo'q jadvalga (D-09) tegishli. Eski `password_hash` dump/backup'larda qolishi mumkin — ETL'dan keyin ham eski bazani himoyalash kerak. |
| 2. Ko'chirmaslik | `audit_logs` yangi bazaga o'tkazilmaydi; yangi audit noldan boshlanadi. | Sezgir ma'lumot ko'chish xavfi yo'q. Eski harakatlar tarixi yangi tizimda ko'rinmaydi (faqat eski bazada/arxivda). |

### (c) Qamrov: eski triggerlar ↔ D-60 (Q-51)

Spec §11 jurnallarni (kim ko'radi, ko'lami) tasvirlaydi, lekin yoziladigan hodisalarni nomlamaydi; ro'yxat — D-60.

| D-60 hodisasi | Eski trigger qamrovi | Bo'shliq |
|---|---|---|
| Login / logout / muvaffaqiyatsiz login | Yo'q — bular jadval o'zgarishi emas (`sessions` da trigger ham yo'q) | To'liq yo'q |
| CRUD | 7 jadval: `samples`, `protocols`, `protocol_signatures`, `protocol_values`, `reagent_transactions`, `sample_documents`, `users` | Triggersiz: `companies`, `substances`, `substance_parameters`, `reagents`, `reagent_documents`, `protocol_files`, `files`, `stability_studies`, `stability_checkpoints`, `stability_results`, `sensor_configs`, `temperature_readings`, `temperature_alerts`, `user_permissions`, `notifications`, `sessions`, `telegram_link_tokens` |
| Status o'tishlari | `samples.status`, `samples.passport_status`, `protocols.status` (UPDATE orqali) | `stability_studies.status`, `stability_checkpoints.status` yo'q |
| Fayl yuklash / o'chirish | `sample_documents`; `samples`/`protocols` dagi fayl ustunlari (UPDATE orqali) | `protocol_files`, `reagent_documents`, `files` yo'q |
| Ruxsat o'zgarishlari | `users.role` (UPDATE orqali) | `user_permissions` yo'q |
| Foydalanuvchi va kompaniya bo'yicha filtr (faoliyat jurnali) | `user_id`, `company_id` to'ldirilmaydi | Trigger yozuvlarini foydalanuvchi/kompaniya bo'yicha filtrlab bo'lmaydi |

Qo'shimcha: `protocol_values` triggeri yangi sxemada keraksiz (D-09 — jadval yo'q).

**Xulosa:** eski trigger qamrovi D-60 uchun yetarli emas. Yangi audit mexanizmi P10 da D-60 va D-62 asosida quriladi;
uning qanday amalga oshirilishi (trigger yoki ilova darajasi) bu hujjatda tanlanmagan.
