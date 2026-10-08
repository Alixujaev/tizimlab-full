# BASELINE_PLAN — yangi baseline sxema rejasi

Toza baseline (D-01) qaysi jadvallardan iborat bo'lishi va qaysi fazada qaysi migratsiya fayli bilan qo'shilishi.
Asos — [`SCHEMA_DIFF.md`](SCHEMA_DIFF.md) (qoidalar R1–R4, B; D-70). Bu yerda SQL yo'q — SQL har fazada yoziladi.
U-1…U-10 (`SCHEMA_DIFF.md`) hal qilingan — D-71…D-80; qo'shimcha D-81 (`cancelled` yo'q), D-82 (ETL xavfsizlik tekshiruvi).

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
| `audit_logs` → `audit_log` | RENAME; `record_id` NULL faqat auth hodisalari uchun (CHECK) | §16, D-60, D-62, D-63, D-64, D-80 | P2 (jadval), P10 (jurnallar) |
| `schema_migrations` (legacy) | DROP — runner o'z jadvalini yaratadi (P1 da bor) | D-24 | — |
| `substances` | KEEP | §5, D-30, D-67 | P3 |
| `substance_parameters` | KEEP + `company_id` | §5, D-67 | P3 |
| `samples` | KEEP + `deleted_at`; − `expires_at`, − `deadline` | §3, D-14, D-43, D-68, D-71 | P4 |
| `sample_tracking` | ADD | §16, D-14, D-37, D-39, D-42, D-63; ustunlar — Q-25 (P4) | P4 |
| `sample_documents` | DROP (ETL qadami ham yo'q) | D-73 | — |
| `files` | KEEP | §12, D-61 | P5 |
| `protocols` | KEEP + `passport_uploaded_by`; `sample_id` NOT NULL; − `substance_id`, − `batch_number`, − `sample_source`, − `notes` | §4, D-14, D-15, D-47, D-74 | P5 |
| `protocol_signatures` | KEEP + `action`, `company_id`; `UNIQUE(protocol_id, role)` olib tashlanadi | D-46 | P5 |
| `protocol_files` | KEEP + `company_id` (faqat `finished_product` — ilovada) | §4, D-49, D-76 | P5 |
| `protocol_values` | DROP (ETL'ga ham kirmaydi) | D-09, D-75 | — |
| `notifications` | KEEP; `notification_type` + `temperature_alert`, `low_stock`; `type` DEFAULT olib tashlanadi | §9, D-13, D-59 | P6 |
| `reagents` | KEEP | §6, D-69 | P7 |
| `reagent_transactions` | KEEP + `company_id` | §6, D-08, D-51 | P7 |
| `reagent_documents` | KEEP + `company_id` (20MB — ilovada) | §6, D-69, D-79 | P7 |
| `sensor_configs` | KEEP; `UNIQUE(sensor_id)` → `UNIQUE(company_id, sensor_id)` | §7, D-03, D-78, D-83 | P8 |
| `temperature_readings` | KEEP + `company_id`; `sensor_id` (matn) → `sensor_config_id uuid` FK | §7, D-03, D-78 | P8 |
| `temperature_alerts` | KEEP + `company_id`; `sensor_id` (matn) → `sensor_config_id uuid` FK | §7, D-78, D-83 | P8 |
| `stability_studies` | KEEP; `UNIQUE(sample_id)` → qisman unikal `WHERE status = 'active'`; CHECK faqat `active`, `completed` | §8, D-56, D-58, D-81 | P9 |
| `stability_checkpoints` | KEEP + `company_id` | §8, D-53, D-55 | P9 |
| `stability_results` | KEEP + `company_id`; `current_value` NULL ruxsat | §8, D-05, D-57, D-77 | P9 |
| `telegram_link_tokens` | KEEP; `token` → `token_hash` | §13, D-65 | P11 |

Natija: 24 jadval (26 legacy − `protocol_values` − `schema_migrations` − `sample_documents` + `sample_tracking`)
+ runner'ning `schema_migrations` jadvali.

## Baseline'dan tushirilganlar (eski sxemada bor, yangisida yo'q)

| Tur | Element | Qaror | Eski bazadagi soni |
|---|---|---|---|
| Jadval | `protocol_values` | D-09, D-75 | 0 qator |
| Jadval | `sample_documents` | D-73 | 0 qator |
| Jadval | `schema_migrations` (legacy tuzilma) | D-24 | — (runner o'z jadvali) |
| Ustun | `samples.expires_at`, `samples.deadline` | D-17, D-71 | 1 namunada qiymat — ETL tracking izohiga |
| Ustun | `protocols.substance_id`, `batch_number`, `sample_source`, `notes` | D-74 | qiymat yo'q |
| Ustun | `temperature_readings.sensor_id`, `temperature_alerts.sensor_id` (matnli FK) | D-78 | `sensor_config_id` ga almashtiriladi |
| Ustun | `telegram_link_tokens.token` | D-65 | `token_hash` ga almashtiriladi (ETL yo'q) |
| Enum qiymati | `sample_type.in_process` | D-72 | 0 namuna |
| CHECK qiymati | `stability_studies.status = 'cancelled'` | D-81 | 0 study |
| Cheklov | `protocol_signatures UNIQUE(protocol_id, role)` | D-46 | — |
| Cheklov | `stability_studies UNIQUE(sample_id)` | D-58 | qisman unikalga almashtiriladi |
| Cheklov | `sensor_configs UNIQUE(sensor_id)` | D-78 | `(company_id, sensor_id)` ga almashtiriladi |
| Funksiya/trigger | `audit_log_trigger()`, 7 ta `audit_*` trigger | D-64 | — |

## Migratsiya fayllari (faza bo'yicha)

| Faza | Fayl (taxminiy nom) | Tarkibi |
|---|---|---|
| P2 | `NNN_core.sql` | `set_updated_at()`; `user_role`; `companies`, `users` (Telegram ustunlari bilan — sxema tuzilmasi), `sessions`, `user_permissions`, `audit_log` |
| P3 | `NNN_substances.sql` | `pharmacopoeia`; `substances`, `substance_parameters` |
| P4 | `NNN_samples.sql` | `sample_type` (5 qiymat), `sample_status`; `samples`, `sample_tracking` |
| P5 | `NNN_protocols_files.sql` | `protocol_status`, `protocol_role`; `files`, `protocols`, `protocol_signatures`, `protocol_files` |
| P6 | `NNN_notifications.sql` | `notification_type`; `notifications` |
| P7 | `NNN_reagents.sql` | `reagent_transaction_type`, `reagent_doc_type`; `reagents`, `reagent_transactions`, `reagent_documents` |
| P8 | `NNN_temperature.sql` | `sensor_configs`, `temperature_readings`, `temperature_alerts` |
| P9 | `NNN_stability.sql` | `stability_studies`, `stability_checkpoints`, `stability_results` |
| P11 | `NNN_telegram.sql` | `telegram_link_tokens` |
| P12 | — (migratsiya emas) | ETL skriptlari: legacy dump → yangi baza (SCHEMA_DIFF dagi ETL eslatmalari, D-63, D-71); boshida xavfsizlik tekshiruvi (D-82): `sample_documents`, `protocol_values`, namunasiz protokollar, `finished_product` bo'lmagan protokollardagi `protocol_files`, `cancelled` study, `in_process` namuna — hammasi 0 bo'lmasa ETL to'xtaydi |

- Bog'liqlik tartibi: `files.sample_id` → `samples` (P4) — `files` P5 da; `reagent_transactions.protocol_id` → `protocols`
  (P5) — P7 da; `stability_studies.sample_id` → `samples` — P9 da. Har FK faqat oldingi fazalardagi jadvallarga ishora qiladi.
- `audit_log` P2 da yaratiladi (D-64: har servis audit yozuvini o'zgartirish bilan bir tranzaksiyada yozadi — P2 dan
  boshlab kerak), jurnal sahifalari P10 da.
- Faza boshida shu fazaga tegishli OPEN_QUESTIONS (D-19 gate) ko'riladi; SCHEMA_DIFF da ochiq U-band yo'q.

## Amalga oshirish: og'ishlar va aniqlashtirishlar

| Faza | Joy | Reja / sxema | Amalda | Sabab |
|---|---|---|---|---|
| P2a | `users` | `users_email_key UNIQUE(email)` | + CHECK `users_email_lower_check (email = lower(email))` | D-91: email kichik harfda saqlanadi; registr bo'yicha dublikatlar DB darajasida yopiladi. ETL (P12) emaillarni kichik harfga keltiradi va to'qnashuvlarni tekshiradi (R-ARCH-85). |
| P2a | `users` | CHECK super_admin ⇔ `company_id IS NULL` | nomi `users_super_admin_company_check`: `(role = 'super_admin') = (company_id IS NULL)` | — |
| P2a | `audit_log` | `record_id` NULL faqat auth hodisalari uchun (D-80) | CHECK `audit_log_record_id_check (record_id IS NOT NULL OR table_name = 'auth')`; indekslar `idx_audit_log_*` (jadval nomi bilan) | Auth hodisasi `table_name = 'auth'` bilan belgilanadi (D-92). |
| P2a | `user_permissions` | + `company_id` | + `idx_user_permissions_company_id` indeksi | Tenant filtri (`requirePermission`) shu ustun bo'yicha. |
| P2a | Migratsiya fayli | `NNN_core.sql` | `001_core.sql` | Birinchi baseline fayli. |
| P2a | Frontend routing | `'/'` bosh sahifasi | `super_admin` uchun `/companies` ga yo'naltirish, kompaniya rollari uchun `'/'` (Dashboard) | D-28: super_admin alohida interfeysga ega, uning bosh sahifasi `/companies`. |
