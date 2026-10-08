# BASELINE_PLAN — yangi baseline sxema rejasi

Toza baseline (D-01) qaysi jadvallardan iborat bo'lishi va qaysi fazada qaysi migratsiya fayli bilan qo'shilishi.
Asos — [`SCHEMA_DIFF.md`](SCHEMA_DIFF.md) (qoidalar R1–R4, B; D-70). Bu yerda SQL yo'q — SQL har fazada yoziladi.
⚠ U-xx — `SCHEMA_DIFF.md` dagi foydalanuvchi qarori kutilayotgan band; tegishli faza boshlanishidan oldin hal bo'lishi kerak.

## Umumiy qoidalar

- PK: `id uuid DEFAULT gen_random_uuid()`; vaqt: `timestamptz`; sana: `date` (sxemadagidek).
- Har tenant jadvalida `company_id uuid NOT NULL` → `companies(id)` (D-12, B); auth jadvallari (`sessions`,
  `telegram_link_tokens`) bundan mustasno. `users.company_id` — NULL faqat `super_admin` uchun (CHECK).
- FK'lar, `ON DELETE` amallari, unikal cheklovlar va indekslar sxemadagidek saqlanadi; o'zgarishlar faqat SCHEMA_DIFF da
  CHANGE/ADD deb belgilanganlari.
- **Turlar:** sxemada ENUM bo'lganlar ENUM bo'lib qoladi (`user_role`, `pharmacopoeia`, `sample_type`, `sample_status`,
  `protocol_status`, `protocol_role`, `notification_type`, `reagent_transaction_type`, `reagent_doc_type`); sxemada
  TEXT + CHECK bo'lganlar shunday qoladi (`samples.passport_status`, `stability_*` statuslari, `result_status`). Sxemada
  bo'lmagan yangi sanab o'tiladigan qiymatlar (masalan `sample_tracking` voqea turi, `protocol_signatures.action`) —
  TEXT + CHECK (ENUM'ga qiymat qo'shish `ALTER TYPE ... ADD VALUE` talab qiladi; CHECK'ni forward-only migratsiyada
  almashtirish soddaroq).
- `set_updated_at()` funksiyasi va `updated_at` triggerlari — `updated_at` ustuni bor jadvallarda (sxemadagi 9 ta).
- Audit triggerlari va `audit_log_trigger()` yaratilmaydi (D-64).
- Migratsiyalar faqat oldinga (D-24): har faza o'z jadvallarini yangi `NNN_nom.sql` fayl bilan qo'shadi; oldingi fazaning
  fayli o'zgartirilmaydi. Raqamlar fayl yozilganda aniqlanadi.

## Jadvallar

| Jadval | Hukm | Sabab | Faza |
|---|---|---|---|
| `companies` | KEEP | §2, D-34 | P2 |
| `users` | KEEP + CHECK (`super_admin` ⇔ `company_id IS NULL`) | §1, D-66, R-ROLE-02/03 | P2 |
| `sessions` | KEEP | §15 | P2 |
| `user_permissions` | KEEP + `company_id` | §10, D-10, D-32 | P2 |
| `audit_logs` → `audit_log` | RENAME (+ U-10: `record_id` NULL) | §16, D-60, D-62, D-63, D-64 | P2 (jadval), P10 (jurnallar) |
| `schema_migrations` (legacy) | DROP — runner o'z jadvalini yaratadi (P1 da bor) | D-24 | — |
| `substances` | KEEP | §5, D-30, D-67 | P3 |
| `substance_parameters` | KEEP + `company_id` | §5, D-67 | P3 |
| `samples` | KEEP + `deleted_at` (U-1, U-2) | §3, D-14, D-43, D-68 | P4 |
| `sample_tracking` | ADD | §16, D-14, D-37, D-39, D-42, D-63; ustunlar — Q-25 (P4) | P4 |
| `sample_documents` | ⚠ U-3 (taklif: baseline'ga kirmaydi, ETL `files` ga) | spec'da yo'q | — / P4 |
| `files` | KEEP | §12, D-61 | P5 |
| `protocols` | KEEP + `passport_uploaded_by` (U-4) | §4, D-14, D-15, D-47 | P5 |
| `protocol_signatures` | KEEP + `action`, `company_id`; `UNIQUE(protocol_id, role)` olib tashlanadi | D-46 | P5 |
| `protocol_files` | KEEP + `company_id` (U-6) | §4, D-49 | P5 |
| `protocol_values` | DROP (U-5 — ma'lumot ETL'da) | D-09 | — |
| `notifications` | KEEP; `notification_type` + `temperature_alert`, `low_stock`; `type` DEFAULT olib tashlanadi | §9, D-13, D-59 | P6 |
| `reagents` | KEEP | §6, D-69 | P7 |
| `reagent_transactions` | KEEP + `company_id` | §6, D-08, D-51 | P7 |
| `reagent_documents` | KEEP + `company_id` (U-9) | §6, D-69 | P7 |
| `sensor_configs` | KEEP (⚠ U-8: unikal doira va FK usuli) | §7, D-03, D-52 | P8 |
| `temperature_readings` | KEEP + `company_id` (U-8) | §7, D-03 | P8 |
| `temperature_alerts` | KEEP + `company_id` (U-8) | §7, D-52 | P8 |
| `stability_studies` | KEEP; `UNIQUE(sample_id)` → qisman unikal `WHERE status = 'active'` | §8, D-56, D-58 | P9 |
| `stability_checkpoints` | KEEP + `company_id` | §8, D-53, D-55 | P9 |
| `stability_results` | KEEP + `company_id` (⚠ U-7) | §8, D-05, D-57 | P9 |
| `telegram_link_tokens` | KEEP; `token` → `token_hash` | §13, D-65 | P11 |

Natija: 24 jadval (26 legacy − `protocol_values` − `schema_migrations` − `sample_documents` + `sample_tracking`;
U-3 boshqacha hal bo'lsa 25) + runner'ning `schema_migrations` jadvali.

## Migratsiya fayllari (faza bo'yicha)

| Faza | Fayl (taxminiy nom) | Tarkibi |
|---|---|---|
| P2 | `NNN_core.sql` | `set_updated_at()`; `user_role`; `companies`, `users` (Telegram ustunlari bilan — sxema tuzilmasi), `sessions`, `user_permissions`, `audit_log` |
| P3 | `NNN_substances.sql` | `pharmacopoeia`; `substances`, `substance_parameters` |
| P4 | `NNN_samples.sql` | `sample_type`, `sample_status`; `samples`, `sample_tracking` (+ U-3 natijasi) |
| P5 | `NNN_protocols_files.sql` | `protocol_status`, `protocol_role`; `files`, `protocols`, `protocol_signatures`, `protocol_files` |
| P6 | `NNN_notifications.sql` | `notification_type`; `notifications` |
| P7 | `NNN_reagents.sql` | `reagent_transaction_type`, `reagent_doc_type`; `reagents`, `reagent_transactions`, `reagent_documents` |
| P8 | `NNN_temperature.sql` | `sensor_configs`, `temperature_readings`, `temperature_alerts` |
| P9 | `NNN_stability.sql` | `stability_studies`, `stability_checkpoints`, `stability_results` |
| P11 | `NNN_telegram.sql` | `telegram_link_tokens` |
| P12 | — (migratsiya emas) | ETL skriptlari: legacy dump → yangi baza (SCHEMA_DIFF dagi ETL eslatmalari, D-63) |

- Bog'liqlik tartibi: `files.sample_id` → `samples` (P4) — `files` P5 da; `reagent_transactions.protocol_id` → `protocols`
  (P5) — P7 da; `stability_studies.sample_id` → `samples` — P9 da. Har FK faqat oldingi fazalardagi jadvallarga ishora qiladi.
- `audit_log` P2 da yaratiladi (D-64: har servis audit yozuvini o'zgartirish bilan bir tranzaksiyada yozadi — P2 dan
  boshlab kerak), jurnal sahifalari P10 da.
- Faza boshida shu fazaning ⚠ U-xx bandlari va OPEN_QUESTIONS (D-19 gate) hal bo'lgan bo'lishi kerak.
