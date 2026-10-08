# SCHEMA_DIFF — eski production sxemasi ↔ spec/DECISIONS
 ✅ Qo'llandi → D-83 | ✅ Qo'llandi → D-84 | ✅ Qo'llandi → D-81 (`cancelled` umuman olib tashlandi — legacy izoh kerak emas) | ✅ Qo'llandi → D-85 | ✅ Checklist'da (P0.9) | ✅ D-67 | ✅ D-69, checklist |
Eski (production) sxema va yangi tizim talablari (`LOYIHA.md` → `docs/spec/*`, `DECISIONS.md`) orasidagi farqlar.
Manba: [`docs/legacy/schema.sql`](../legacy/schema.sql) (pg_dump 18, faqat DDL). `:NNN` — shu fayldagi qator raqami.
Yangi baseline rejasi — [`BASELINE_PLAN.md`](BASELINE_PLAN.md).

## Qoidalar (foydalanuvchi tasdiqlagan, D-70)

| Kod | Qoida |
|---|---|
| **R1** | Ma'lumot saqlovchi ustun, ustun turi, enum/CHECK qiymatlari — **sxema** ustun (ETL osonligi uchun). |
| **R2** | Xatti-harakat, ruxsatlar, status o'tishlari — **spec va DECISIONS** ustun; sxema moslashtiriladi, ETL konvertatsiya qiladi. |
| **R3** | Sxemada yo'q, lekin spec/DECISIONS talab qiladigan element — spec bo'yicha **qo'shiladi**. |
| **R4** | R1–R3 hal qila olmagan farq — **⚠ FOYDALANUVCHI QARORI KERAK** (pastda U-xx ro'yxati; hammasi hal qilingan — D-71…D-80). |
| **B** | Baseline: UUID PK (`gen_random_uuid()`), `timestamptz`, har tenant jadvalida `company_id`, FK va indekslar saqlanadi. |

**Jadval holati:** MATCH — spec bilan mos · SCHEMA-ONLY — faqat sxemada · SPEC-ONLY — faqat spec'da · CONFLICT — ziddiyat bor.
**Baseline hukmi:** KEEP · RENAME · DROP · ADD (ustun darajasida ham: CHANGE — cheklov/default o'zgaradi).
**→ D-xx** — qaror; **U-xx** — R4 bandi (foydalanuvchi qarori; hozir hammasi ✅ RESOLVED).

Eski baza ETL sonlari (production, to'xtatilgan): `samples` = 12; `sample_documents`, `protocol_values`, `sample_id IS NULL` protokollar,
`finished_product` bo'lmagan protokollardagi `protocol_files`, `cancelled` study, `in_process` namuna — 0; `expires_at`/`deadline`
to'ldirilgan namuna — 1. ETL bu "0" larni boshida tekshiradi (D-82).

## Umumiy kuzatuvlar

- Sxemada 26 jadval, `public` sxema. Hamma PK — `uuid DEFAULT gen_random_uuid()`, cheklov nomi `<jadval>_pkey`
  (`schema_migrations` dan tashqari — PK `version`). Jadvallarda "uuid PK" deb berilgan; 54 ta FK ustun qatorlarida `→` bilan,
  `ON DELETE` yozilmagan bo'lsa — NO ACTION. Barcha vaqt belgilari `timestamp with time zone`; sana ustunlari `date` (`samples.manufactured_at` va h.k.) — R1, KEEP.
- **ENUM turlari (9):** `notification_type`, `pharmacopoeia`, `protocol_role`, `protocol_status`, `reagent_doc_type`,
  `reagent_transaction_type`, `sample_status`, `sample_type`, `user_role` (`:22-139`).
- **TEXT + CHECK (4):** `samples.passport_status`, `stability_checkpoints.status`, `stability_results.result_status`,
  `stability_studies.status` — bu ustunlarda ENUM o'rniga matn + CHECK. Baseline sxemadagi usulni davom ettiradi
  (BASELINE_PLAN).
- **Funksiyalar:** `audit_log_trigger()` (`:146`) — **DROP** (D-64: audit ilova darajasida); `set_updated_at()` (`:176`) — **KEEP**.
- **Triggerlar:** 7 ta `audit_*` (`:1474-1516`) — DROP (D-64); 9 ta `trg_*_updated_at` (`:1523-1579`) — KEEP: `companies`,
  `protocols`, `reagents`, `samples`, `sensor_configs`, `stability_checkpoints`, `stability_studies`, `substances`, `users`.
- **`company_id` yo'q tenant jadvallari (B → ADD):** `substance_parameters`, `protocol_files`, `protocol_signatures`,
  `reagent_transactions`, `reagent_documents`, `temperature_readings`, `temperature_alerts`, `stability_checkpoints`,
  `stability_results`, `user_permissions`. ETL — ota-jadvaldan to'ldiriladi. (`sample_documents` baseline'ga kirmaydi — D-73.)
  `sessions` va `telegram_link_tokens` — foydalanuvchi autentifikatsiya jadvallari (`super_admin` ham, `company_id = NULL`),
  tenant ma'lumoti emas — `company_id` qo'shilmaydi.
- `company_id` FK'lari asosan `ON DELETE RESTRICT`; `files` — `CASCADE`, `audit_logs` — `SET NULL`. D-34 bo'yicha kompaniya
  jismoniy o'chirilmaydi — farq amalda ta'sir qilmaydi, baseline sxemadagidek saqlaydi.

---

## P2 — Kompaniyalar, foydalanuvchilar, auth

### `companies` (`:213`) — MATCH · KEEP

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `name` | varchar(255) NOT NULL, UNIQUE | §2 "nomi" | — | KEEP |
| `slug` | varchar(100) NOT NULL, UNIQUE | §2 `slug` | format sxemada yo'q (Q-10, NON-BLOCKING, P2) | KEEP |
| `is_active` | boolean NOT NULL DEFAULT true | §2, D-34 | — | KEEP |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ `trg_companies_updated_at`) |

- Cheklovlar: `companies_pkey`, `companies_name_key UNIQUE(name)`, `companies_slug_key UNIQUE(slug)`.
- Indekslar: `idx_companies_is_active(is_active)`, `idx_companies_slug(slug)` (UNIQUE bilan takror — baseline'da ortiqcha, lekin B bo'yicha saqlanadi).
- `company_id`: — (jadvalning o'zi). ETL: to'g'ridan-to'g'ri.

### `users` (`:651`) — CONFLICT (kichik) · KEEP + CHANGE

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `email` | varchar(255) NOT NULL, UNIQUE (global) | D-66 (Q-60) | login identifikatori — sxemadan | KEEP → D-66 |
| `password_hash` | varchar(255) NOT NULL | §15 bcrypt 10 | — | KEEP (D-62: audit'ga yozilmaydi) |
| `full_name` | varchar(255) NOT NULL | — | spec nomlamaydi | KEEP (R1) |
| `role` | `user_role` NOT NULL | §1: 6 rol | enum to'liq mos | KEEP |
| `is_active` | boolean NOT NULL DEFAULT true | D-34 (kompaniya), foydalanuvchi nofaolligi spec'da yo'q | — | KEEP (R1) |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `last_login_at` | timestamptz NULL | — | — | KEEP (R1) |
| `created_by` | uuid NULL → `users(id)` ON DELETE SET NULL | — | — | KEEP |
| `company_id` | uuid NULL → `companies(id)` ON DELETE RESTRICT | §1, §2, R-ROLE-02/03 | `super_admin` ⇔ `company_id IS NULL` cheklovi sxemada yo'q | KEEP + **ADD CHECK** (R3) |
| `telegram_chat_id` | bigint NULL, UNIQUE | §13, §16 | bitta Telegram akkaunt — bitta foydalanuvchi (Q-55 ning bir qismi sxemada) | KEEP |
| `telegram_linked_at` | timestamptz NULL | §13 | — | KEEP |

- `user_role` enum: `chemist`, `lab_head`, `director`, `kontrolyor`, `admin`, `super_admin` — §1 bilan to'liq mos.
- Cheklovlar: `users_pkey`, `users_email_key UNIQUE(email)`, `users_telegram_chat_id_key UNIQUE(telegram_chat_id)`.
- Indekslar: `idx_users_active`, `idx_users_company_id`, `idx_users_created_by`, `idx_users_email` (UNIQUE bilan takror), `idx_users_role`, `idx_users_telegram_chat_id`.
- Amalda (P2a, `001_core.sql`): qo'shimcha CHECK `email = lower(email)` (D-91) — og'ish, BASELINE_PLAN "Amalga oshirish" bo'limida.
- Amalda (P2a, `001_core.sql`): `audit_log.record_id` CHECK `(record_id IS NOT NULL OR table_name = 'auth')` (D-80, D-92) — auth hodisalari uchun `record_id` NULL bo'lishi mumkin.
- Amalda (P2a frontend): `'/'` bosh sahifasi `super_admin` uchun `/companies` ga yo'naltiriladi, kompaniya rollari uchun `'/'` dashboard (D-28).
- ETL: to'g'ridan-to'g'ri (`password_hash` bcrypt — §15 bilan mos, qayta xeshlash shart emas). Emaillar kichik harfga keltiriladi (to'qnashuv — ETL hisobotiga); CHECK'lar qo'shilishidan oldin
  `super_admin`/`company_id` mosligi ETL'da tekshiriladi.

### `sessions` (`:483`) — MATCH · KEEP

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `user_id` | uuid NOT NULL → `users(id)` ON DELETE CASCADE | — | — | KEEP |
| `token_hash` | varchar(64) NOT NULL, UNIQUE | §15 SHA-256 xesh (64 hex) | — | KEEP (D-62) |
| `ip_address` | inet NULL | — | — | KEEP |
| `user_agent` | text NULL | — | — | KEEP |
| `expires_at` | timestamptz NOT NULL | §15 7 kun | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `last_activity` | timestamptz NULL | §15 idle timeout (Q-58, Q-59) | — | KEEP |

- Cheklovlar: `sessions_pkey`, `sessions_token_hash_key UNIQUE(token_hash)`.
- Indekslar: `idx_sessions_expires_at`, `idx_sessions_token_hash` (takror), `idx_sessions_user_id`, `idx_sessions_user_last_activity(user_id, last_activity)`.
- `company_id`: yo'q — auth jadvali (Umumiy kuzatuvlar). ETL: **ko'chirilmaydi** (refresh tokenlar yangi tizim sirlari bilan mos emas; foydalanuvchilar qayta login qiladi).

### `user_permissions` (`:637`) — CONFLICT (tenant) · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `user_id` | uuid NOT NULL → `users(id)` ON DELETE CASCADE | §10 | — | KEEP |
| `resource` | varchar(50) NOT NULL | §10, D-10 (katalog P2) | qiymatlar ro'yxati sxemada yo'q (CHECK yo'q) | KEEP (katalog — D-10) |
| `action` | varchar(50) NOT NULL | §10, D-10 | xuddi shunday | KEEP |
| `granted_by` | uuid NOT NULL → `users(id)` | D-16 (faqat admin) | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `company_id` | — | B, D-12 | yo'q | **ADD** (ETL: `users.company_id`) |

- Cheklovlar: `user_permissions_pkey`, `uq_user_permissions UNIQUE(user_id, resource, action)` — D-32 (faqat grant) bilan mos.
- Indekslar: `idx_user_permissions_granted_by`, `idx_user_permissions_user_id`.
- ETL: `resource`/`action` qiymatlari D-10 katalogiga moslanadi; katalogda yo'q juftliklar ETL hisobotiga chiqariladi.

### `audit_logs` (`:194`) → `audit_log` — CONFLICT · RENAME

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `user_id` | uuid NULL → `users(id)` ON DELETE SET NULL | D-64 (to'ldiriladi) | trigger to'ldirmagan | KEEP |
| `table_name` | varchar(100) NOT NULL | D-60 | — | KEEP |
| `record_id` | uuid NOT NULL | D-60: muvaffaqiyatsiz login ham yoziladi | yozuvsiz hodisa uchun qiymat yo'q | **CHANGE**: NULL faqat auth hodisalari uchun, CHECK bilan → D-80 (U-10) |
| `action` | varchar(20) NOT NULL | D-60 | trigger `TG_OP` yozgan | KEEP |
| `old_values`, `new_values` | jsonb NULL | D-62 (sezgir ustunlarsiz) | — | KEEP |
| `ip_address` | inet NULL | D-64 | trigger to'ldirmagan | KEEP |
| `user_agent` | text NULL | D-64 | trigger to'ldirmagan | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | D-60 (sana filtri) | — | KEEP |
| `company_id` | uuid NULL → `companies(id)` ON DELETE SET NULL | D-60, D-64 | trigger to'ldirmagan | KEEP (`super_admin` hodisalari uchun NULL) |

- Nom: spec §16 va D-60 — `audit_log`; D-63 bo'yicha eski yozuvlar ko'chirilmaydi, shuning uchun nom spec bo'yicha → **RENAME**.
- Indekslar: `idx_audit_logs_company_id`, `idx_audit_logs_created_at(created_at DESC)`, `idx_audit_logs_record_id`, `idx_audit_logs_table_name`, `idx_audit_logs_user_id` — KEEP (yangi nom bilan).

#### Eski audit mexanizmi

- Funksiya `public.audit_log_trigger()` (`schema.sql:146-170`, `SECURITY DEFINER`) — har `INSERT`/`UPDATE`/`DELETE` da
  `audit_logs` ga yozadi: `table_name` (`TG_TABLE_NAME`), `record_id`, `action` (`TG_OP`),
  `old_values = to_jsonb(OLD)`, `new_values = to_jsonb(NEW)` — ya'ni qatorning **barcha** ustunlari.
- `AFTER INSERT OR DELETE OR UPDATE ... FOR EACH ROW` triggerlari (`schema.sql:1474-1516`) — 7 ta jadval:
  `protocol_signatures`, `protocol_values`, `protocols`, `reagent_transactions`, `sample_documents`, `samples`, `users`.
- `audit_logs` jadvali (`schema.sql:194-206`) da `user_id`, `company_id`, `ip_address`, `user_agent` ustunlari bor, lekin
  trigger ularni **to'ldirmaydi** (INSERT faqat 5 ustun bilan) — trigger yozuvlarida harakatni kim, qaysi kompaniyada
  bajargani yo'q.

#### (a) Sezgir ustunlar → D-62

`audit_users` triggeri (`schema.sql:1516`) `to_jsonb(NEW/OLD)` orqali `users.password_hash` ni
`audit_logs.old_values`/`new_values` ga yozadi. Boshqa sezgir ustunlar: `sessions.token_hash` (`:486`),
`telegram_link_tokens.token` (`:595`, xom token) — ularning jadvallarida trigger yo'q, lekin qoida umumiy.

Qaror **D-62**: yangi tizimda audit yozuviga yozishdan oldin `password_hash` va token/token hash'lari olib tashlanadi.
Qo'shimcha: `telegram_link_tokens.token` eski sxemada xom saqlanadi — yangi tizimda SHA-256 xesh, bir martalik (**D-65**).

#### (b) ETL (P12): eski `audit_logs` tarixi — ✅ RESOLVED → D-63

| Variant | Mazmuni | Oqibatlari |
|---|---|---|
| 1. Ko'chirish + scrub | `audit_logs` ko'chiriladi; `table_name = 'users'` qatorlarida `old_values` va `new_values` dan `password_hash` kaliti olib tashlanadi (`jsonb - 'password_hash'`). | Tarix saqlanadi. Ko'chirilgan yozuvlarda `user_id`/`company_id` yo'q — faoliyat jurnalida (kompaniya bo'yicha, D-60) ko'rinmaydi, faqat `super_admin` audit jurnalida. `protocol_values` yozuvlari yangi sxemada yo'q jadvalga (D-09) tegishli. Eski `password_hash` dump/backup'larda qolishi mumkin — ETL'dan keyin ham eski bazani himoyalash kerak. |
| 2. Ko'chirmaslik | `audit_logs` yangi bazaga o'tkazilmaydi; yangi audit noldan boshlanadi. | Sezgir ma'lumot ko'chish xavfi yo'q. Eski harakatlar tarixi yangi tizimda ko'rinmaydi (faqat eski bazada/arxivda). |

Tanlangan: **variant 2** (D-63) — eski `audit_logs` yangi audit jadvaliga ko'chirilmaydi, eski baza dump'i arxivlanadi.
Eski sxemada `sample_tracking` yo'qligi sababli ETL har ko'chirilgan namuna va protokol uchun bitta sintetik tracking
voqeasini yozadi: "legacy'dan ko'chirildi", joriy status, asl `created_at`/`updated_at`.

#### (c) Qamrov: eski triggerlar ↔ D-60 (Q-51)

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

**Xulosa:** eski trigger qamrovi D-60 uchun yetarli emas. Yangi audit P10 da **ilova darajasida** quriladi (**D-64**,
DB trigger emas): servis qatlami audit yozuvini o'zgartirish bilan bir tranzaksiyada yozadi va `user_id`, `company_id`,
`ip_address`, `user_agent` ni to'ldiradi; D-60 va D-62 amal qiladi.

### `schema_migrations` (`:453`) — CONFLICT · DROP (legacy) — yangi runner o'z jadvalini yaratadi

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `version` | varchar(255) PK | D-24 | yangi runner: `version`, `name`, `checksum`, `applied_at` (`backend/src/db/migrator.ts`) | yangi tuzilma (P1 da bor) |
| `applied_at` | timestamptz NOT NULL DEFAULT now() | D-24 | — | — |

- ETL: ko'chirilmaydi (eski 038 migratsiya tarixi yangi baseline'ga tegishli emas — D-01).

---

## P3 — Moddalar

### `substances` (`:572`) — MATCH · KEEP

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `name_uz` | varchar(255) NOT NULL | §5 | — | KEEP |
| `name_ru`, `name_en` | varchar(255) NULL | §5 | — | KEEP |
| `pharmacopoeia` | `pharmacopoeia` NOT NULL | §5, D-67 (Q-35) | modda darajasida — sxemadan | KEEP → D-67 |
| `cas_number` | varchar(50) NULL | §5 ixtiyoriy | — | KEEP |
| `description` | text NULL | — | spec nomlamaydi | KEEP (R1) |
| `is_active` | boolean NOT NULL DEFAULT true | D-30 o'chirish (bog'lanmagan bo'lsa) | sxemada nofaollashtirish bayrog'i ham bor | KEEP (R1); o'chirish qoidasi — D-30 (R2) |
| `created_by` | uuid NOT NULL → `users(id)` | — | — | KEEP |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-12 | — | KEEP |

- `pharmacopoeia` enum: `EP`, `BP`, `UzDSt`, `USP`, `OTHER` — §5 bilan to'liq mos.
- Indekslar: `idx_substances_active`, `idx_substances_company_id`, `idx_substances_name_uz` (GIN, `to_tsvector('simple', name_uz)`), `idx_substances_pharmacopoeia`. Unikal cheklov (nom bo'yicha) yo'q.
- ETL: to'g'ridan-to'g'ri.

### `substance_parameters` (`:555`) — CONFLICT · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `substance_id` | uuid NOT NULL → `substances(id)` ON DELETE CASCADE | §5 | — | KEEP |
| `parameter_name` | varchar(255) NOT NULL | §5 "nomi"; Q-35 taklifi — uch tilda | sxemada **bitta** nom ustuni | KEEP → D-67 (R1) |
| `unit` | varchar(50) NULL | §5 o'lchov birligi | — | KEEP |
| `spec_min`, `spec_max` | numeric(12,4) NULL | §5 min/max | — | KEEP |
| `method` | varchar(255) NULL | §5 metod | erkin matn | KEEP → D-67 |
| `sort_order` | smallint NOT NULL DEFAULT 0 | — | — | KEEP (R1) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | `updated_at` yo'q | KEEP |
| `company_id` | — | B | yo'q | **ADD** (ETL: `substances.company_id`) |

- Indeks: `idx_substance_parameters_substance_id`. FK: `protocol_values.parameter_id` bu jadvalga — `protocol_values` DROP (D-09).

---

## P4 — Namunalar

### `samples` (`:415`) — CONFLICT · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `created_by` | uuid NOT NULL → `users(id)` | §3 (kontrolyor), D-13 | — | KEEP |
| `substance_id` | uuid NULL → `substances(id)` | §3 "modda tanlaydi" | NULL bo'lishi mumkin | KEEP (R1) |
| `substance_name` | varchar(500) NOT NULL | — | modda nomining nusxasi | KEEP (R1, D-68) |
| `type` | `sample_type` NOT NULL | §3: 5 tur | enum'da qo'shimcha `in_process` | KEEP; `in_process` qiymati **olib tashlanadi** → D-72 (U-2) |
| `serial_number` | varchar(100) NULL | §3 seriya raqam | — | KEEP |
| `lot_number` | varchar(100) NULL | §3 lot | — | KEEP |
| `quantity` | varchar(50) NULL | §3 miqdor | matn (son emas) | KEEP (R1) |
| `manufacturer` | varchar(255) NULL | spec'da yo'q | — | KEEP (R1, D-68) |
| `manufactured_at` | date NULL | spec'da yo'q | — | KEEP (R1, D-68) |
| `expires_at` | date NULL | D-17: namunada muddat maydoni yo'q | ziddiyat | **DROP** → D-71 (U-1) |
| `deadline` | date NULL | D-17 | ziddiyat | **DROP** → D-71 (U-1) |
| `analysis_start`, `analysis_end` | date NULL | spec'da yo'q | — | KEEP (R1, D-68) |
| `notes` | text NULL | — | — | KEEP (R1) |
| `status` | `sample_status` NOT NULL DEFAULT `'pending_assignment'` | §3, D-14, D-36 | enum mos | KEEP; o'tishlar ilovada (R2) |
| `assigned_to` | uuid NULL → `users(id)` | §3, D-37 | — | KEEP |
| `assigned_by` | uuid NULL → `users(id)` | §3 | — | KEEP |
| `assigned_at` | timestamptz NULL | — | — | KEEP |
| `stop_reason` | text NULL | §3 (≥5 belgi), D-38 | — | KEEP |
| `stopped_at` | timestamptz NULL | — | — | KEEP |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-12 | — | KEEP |
| `passport_file_name` | text NULL | §3 namuna pasporti | — | KEEP |
| `passport_file_path` | text NULL | §3 (R2 kaliti) | — | KEEP |
| `passport_file_size` | integer NULL | — | `passport_file_mime` yo'q (protokolda bor) | KEEP (R1) |
| `passport_status` | text NULL, CHECK (`pending`, `approved`, `rejected`) | §3, D-39 | — | KEEP |
| `passport_uploaded_by` | uuid NULL → `users(id)` | §3 (egasi o'chiradi) | — | KEEP |
| `deleted_at` | — | D-43 soft-delete | yo'q | **ADD** (R3) |

- `sample_type` enum (sxema): `raw_material`, `finished_product`, `in_process`, `reagent`, `standard_substance`, `other`;
  baseline: `in_process` siz 5 qiymat (D-72; eski bazada 0 ta).
- `sample_status` enum: `pending_assignment`, `in_progress`, `stopped`, `submitted`, `approved`, `rejected` — §3 bilan mos;
  D-14 dagi `rejected → submitted` o'tishi enum o'zgarishini talab qilmaydi (R2, ilova status machine'i).
- Pasport rad etish sababi uchun ustun yo'q — sabab `sample_tracking` voqeasida saqlanadi (D-85).
- Indekslar: `idx_samples_assigned_to`, `idx_samples_company_id`, `idx_samples_created_at(DESC)`, `idx_samples_created_by`, `idx_samples_status`, `idx_samples_substance`, `idx_samples_substance_name`.
- FK: `assigned_by`, `assigned_to`, `created_by`, `passport_uploaded_by`, `substance_id` — ON DELETE amalsiz (NO ACTION); `company_id` — RESTRICT.
- ETL: to'g'ridan-to'g'ri; `deleted_at = NULL`; har namunaga sintetik tracking voqea (D-63). `expires_at`/`deadline` qiymati bor
  yagona namunada qiymat shu voqea izohiga yoziladi (D-71).

### `sample_tracking` — SPEC-ONLY · ADD

- Spec §16 (`samples / sample_tracking`), R-SAMPLE-31; D-14 (rad sababi), D-37 (qayta biriktirish), D-39 (pasport rad sababi),
  D-42 ("pasport orqali yopildi"), D-63 (ETL sintetik voqea — namuna **va protokol** uchun).
- Talab qilinadigan ma'lumot: `company_id`, `sample_id`, (ixtiyoriy) `protocol_id`, voqea turi, kim (`user_id`, ETL voqeasida
  NULL), sabab/izoh, status (D-63: joriy status), vaqt (D-63: asl `created_at`/`updated_at`).
- Aniq ustunlar va voqea turlari ro'yxati — P4 boshida Q-25 (NON-BLOCKING) default'i bilan; tur — TEXT + CHECK (BASELINE_PLAN).

### `sample_documents` (`:400`) — SCHEMA-ONLY · DROP → D-73 (U-3)

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | DROP |
| `sample_id` | uuid NOT NULL → `samples(id)` ON DELETE CASCADE | — | — | DROP |
| `uploaded_by` | uuid NOT NULL → `users(id)` | — | — | DROP |
| `file_name` | varchar(255) NOT NULL | — | — | DROP |
| `file_path` | varchar(500) NOT NULL | — | — | DROP |
| `file_size` | integer NULL | — | mime yo'q | DROP |
| `uploaded_at` | timestamptz NOT NULL DEFAULT now() | — | — | DROP |

- Spec'da bu jadval umuman yo'q. Namuna pasporti **emas** — pasport `samples.passport_*` ustunlarida (§3, §18 aniqlashtirish);
  bu namunaga biriktirilgan umumiy hujjatlar ro'yxati (tur/holat ustuni yo'q). `company_id` yo'q. Indeks: `idx_sample_docs_sample_id`.
  Eski `audit_sample_documents` triggeri bor edi. Eski bazada 0 ta qator — baseline'ga kirmaydi, ETL qadami yo'q (D-73, D-82).

---

## P5 — Protokollar va fayllar

### `protocols` (`:307`) — CONFLICT · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `sample_id` | uuid **NULL** → `samples(id)` | §3/§4: protokol namunaga tegishli; D-15 | NULL — namunasiz legacy protokollar | **CHANGE: NOT NULL** → D-74 (U-4; eski bazada 0 ta) |
| `substance_id` | uuid NULL → `substances(id)` | — (namuna orqali) | eski tuzilma | **DROP** → D-74 |
| `batch_number` | varchar(100) NULL | — | eski tuzilma | **DROP** → D-74 |
| `sample_source` | varchar(255) NULL | — | eski tuzilma | **DROP** → D-74 |
| `notes` | text NULL | — | — | **DROP** → D-74 |
| `created_by` | uuid NOT NULL → `users(id)` | §4 kirish qoidasi (R-PROTO-41) | — | KEEP |
| `status` | `protocol_status` NOT NULL DEFAULT `'draft'` | §4, D-14 | enum mos | KEEP; o'tishlar ilovada (R2) |
| `protocol_role` | `protocol_role` **NULL** DEFAULT `'standard'` | §4, D-15 | NULL ruxsat etilgan | KEEP (R1); ilova har doim qiymat beradi (R2); ETL: NULL → `'standard'` |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `submitted_at`, `approved_at`, `finalized_at`, `rejected_at` | timestamptz NULL | §4, D-14 | — | KEEP |
| `rejection_reason` | text NULL | §4, D-14 | — | KEEP |
| `file_path` | varchar(500) NULL | §4 asosiy fayl | — | KEEP |
| `file_name` | varchar(255) NULL | §4 | — | KEEP |
| `file_size` | integer NULL | §4 (≤20MB, D-06) | — | KEEP |
| `file_mime` | varchar(100) NULL | §4 | — | KEEP |
| `passport_file_name`, `passport_file_path`, `passport_file_mime` | text NULL | §4 protokol pasporti | — | KEEP |
| `passport_file_size` | integer NULL | §4 | — | KEEP |
| `passport_uploaded_by` | — | D-47 (yuklagan foydalanuvchi o'chiradi) | yo'q | **ADD** (R3); ETL: NULL (faqat `lab_head`/`admin` o'chira oladi) |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-12 | — | KEEP |

- `protocol_status` enum: `draft`, `submitted`, `approved`, `rejected`, `finalized` — §4 bilan mos.
- `protocol_role` enum: `standard`, `final`, `in_process` — §4 bilan mos.
- `uq_protocols_sample_role` — UNIQUE INDEX `(sample_id, protocol_role) WHERE sample_id IS NOT NULL AND protocol_role IS NOT NULL`
  — D-15 ("har `protocol_role` bo'yicha ko'pi bilan bitta") bilan mos, KEEP.
- Indekslar: `idx_protocols_company_id`, `idx_protocols_created_at(DESC)`, `idx_protocols_created_by`, `idx_protocols_sample_id`, `idx_protocols_status`, `idx_protocols_substance_id` (ustun bilan birga tushadi — D-74).
- FK: `company_id` RESTRICT; `created_by`, `sample_id`, `substance_id` — NO ACTION (`substance_id` FK tushadi — D-74).
- ETL: `protocol_role IS NULL` → `'standard'` (shu namunada `standard` allaqachon bo'lsa — ETL hisobotiga); har protokolga sintetik tracking voqea (D-63).

### `protocol_signatures` (`:277`) — CONFLICT · KEEP + CHANGE + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `protocol_id` | uuid NOT NULL → `protocols(id)` ON DELETE CASCADE | §4 | — | KEEP |
| `user_id` | uuid NOT NULL → `users(id)` | D-46 | — | KEEP |
| `role` | `user_role` NOT NULL | D-46 | — | KEEP |
| `signature_hash` | varchar(64) NOT NULL | D-46 (parolsiz yozuv) | nimadan xeshlanishi sxemada ko'rinmaydi | KEEP (R1); tarkibi — P5 rejasida |
| `signed_at` | timestamptz NOT NULL DEFAULT now() | D-46 vaqt | — | KEEP |
| `ip_address` | inet NULL | — | — | KEEP |
| `action` | — | D-46 "harakat" (yuborish/tasdiq/yakunlash) | yo'q | **ADD** (R3); ETL: `role` dan (`chemist`→yuborish, `lab_head`→tasdiq, `director`→yakunlash) |
| `company_id` | — | B | yo'q | **ADD** (ETL: `protocols.company_id`) |

- `protocol_signatures_protocol_id_role_key UNIQUE(protocol_id, role)` — D-46 ga zid (rad etilgandan keyin qayta yuborishda
  kimyogarning ikkinchi imzosi) → **CHANGE: olib tashlanadi** (R2).
- Indeks: `idx_protocol_signatures_protocol_id`.

### `protocol_values` (`:292`) — SCHEMA-ONLY · DROP (D-09)

| Ustun | Sxema | Hukm |
|---|---|---|
| `id` | uuid PK | DROP |
| `protocol_id` | uuid NOT NULL → `protocols(id)` ON DELETE CASCADE | DROP |
| `parameter_id` | uuid NOT NULL → `substance_parameters(id)` | DROP |
| `value` | numeric(12,4) NULL | DROP |
| `passed` | boolean NULL | DROP |
| `recorded_at` | timestamptz NOT NULL DEFAULT now() | DROP |
| `recorded_by` | uuid NOT NULL → `users(id)` | DROP |

- `protocol_values_protocol_id_parameter_id_key UNIQUE(protocol_id, parameter_id)`, indeks `idx_protocol_values_protocol_id`.
- ETL: eski bazada 0 ta qator — ETL'ga kirmaydi (D-75, D-82).

### `protocol_files` (`:261`) — CONFLICT · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `protocol_id` | uuid NOT NULL → `protocols(id)` ON DELETE CASCADE | §4, D-49 | — | KEEP |
| `file_name`, `file_path` | text NOT NULL | §4 | — | KEEP |
| `file_size` | integer NULL | §4 (≤20MB) | — | KEEP |
| `file_mime` | text NULL | §4 | — | KEEP |
| `uploaded_by` | uuid NULL → `users(id)` | D-47 (yuklagan o'chiradi) | NULL bo'lishi mumkin | KEEP (R1) |
| `uploaded_at` | timestamptz **NULL** DEFAULT now() | — | NULL ruxsat | KEEP (R1) |
| `company_id` | — | B | yo'q | **ADD** (ETL: `protocols.company_id`) |

- D-49: faqat `finished_product` protokollariga — ilovada (R2); sxemada cheklov yo'q. Eski bazada boshqa protokollarda 0 ta fayl — istisno yo'q (D-76, D-82).
- Indeks: `idx_protocol_files_protocol_id`.

### `files` (`:227`) — MATCH · KEEP

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE CASCADE | D-12 | — | KEEP |
| `sample_id` | uuid NULL → `samples(id)` ON DELETE SET NULL | — | — | KEEP (R1) |
| `r2_key` | text NOT NULL, UNIQUE | §12, D-61 | — | KEEP |
| `filename` | text NOT NULL | — | — | KEEP |
| `mime_type` | text NOT NULL | §12 (PDF/Word/JPEG/PNG) | — | KEEP |
| `size_bytes` | bigint NOT NULL | D-06 (≤50MB) | — | KEEP |
| `uploaded_by` | uuid NOT NULL → `users(id)` | — | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |

- Cheklovlar: `files_pkey`, `files_r2_key_key UNIQUE(r2_key)`. Indekslar: `files_company_id_idx`, `files_sample_id_idx`.
- ETL: to'g'ridan-to'g'ri (R2 kalitlari o'zgarmaydi).

---

## P6 — Xabarnomalar

### `notifications` (`:244`) — CONFLICT · KEEP + CHANGE

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `user_id` | uuid NOT NULL → `users(id)` ON DELETE CASCADE | §9, D-13 | — | KEEP |
| `type` | `notification_type` NOT NULL DEFAULT `'general'` | §9 (10 tur), D-13, D-17 | enum farqi (pastda); `'general'` default | KEEP turi; **CHANGE: DEFAULT olib tashlanadi** (R2 — ilova faqat §9 turini beradi) |
| `title` | varchar(255) NOT NULL | — | saqlangan matn (bitta tilda — Q-50 bilan bog'liq) | KEEP (R1) |
| `message` | text NOT NULL | — | xuddi shunday | KEEP (R1) |
| `reference_id` | uuid NULL | — | FK yo'q (polimorf havola) | KEEP (R1) |
| `is_read` | boolean NOT NULL DEFAULT false | D-59 | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-13 (faqat o'sha kompaniya) | — | KEEP |

- `notification_type` enum (sxema, 11 qiymat): `sample_created`, `sample_assigned`, `sample_overdue`, `general`,
  `stability_due_soon`, `stability_overdue`, `sample_approved`, `sample_rejected`, `protocol_rejected`, `protocol_submitted`, `protocol_approved`.
- Spec §9 (10 tur) bilan solishtirish:
  - Sxemada bor, spec'da yo'q: `sample_created`, `sample_overdue`, `general` — **enum'da qoladi** (R1, legacy qatorlar ETL'i);
    ilova ularni **yaratmaydi** (R2: §9, D-13; D-17 — namuna muddati xabarnomasi yo'q).
  - Spec'da bor, sxemada yo'q: `temperature_alert`, `low_stock` — **ADD** (R3).
- Indekslar: `idx_notifications_company_id`, `idx_notifications_created(DESC)`, `idx_notifications_is_read(user_id, is_read) WHERE is_read = false`, `idx_notifications_user_id`.
- ETL: to'g'ridan-to'g'ri (legacy turlar o'zgarishsiz).

---

## P7 — Reaktivlar

### `reagents` (`:378`) — MATCH · KEEP

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `name` | varchar(255) NOT NULL | D-69 | — | KEEP |
| `cas_number` | varchar(50) NULL | D-69 | — | KEEP |
| `unit` | varchar(30) NOT NULL | D-69 | — | KEEP |
| `quantity` | numeric(12,3) NOT NULL DEFAULT 0, CHECK ≥ 0 | §6 | — | KEEP |
| `low_stock_threshold` | numeric(12,3) NOT NULL DEFAULT 0 | §6 | — | KEEP |
| `expires_at` | date NULL | §6, D-17 | — | KEEP |
| `supplier` | varchar(255) NULL | D-69 | — | KEEP |
| `storage_conditions` | varchar(255) NULL | D-69 | — | KEEP |
| `is_hazardous` | boolean NOT NULL DEFAULT false | §6 | — | KEEP |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-12 | — | KEEP |

- CHECK `reagents_quantity_non_negative (quantity >= 0)`. `is_low_stock`, `is_expired` — hisoblanadi (ustun emas).
- Sxemada `lot`, ishlab chiqaruvchi ustunlari yo'q (D-69).
- Indekslar: `idx_reagents_company_id`, `idx_reagents_expires_at`, `idx_reagents_name`.

### `reagent_transactions` (`:357`) — CONFLICT (tenant) · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `reagent_id` | uuid NOT NULL → `reagents(id)` | §6 | — | KEEP |
| `user_id` | uuid NOT NULL → `users(id)` | D-51 | — | KEEP |
| `type` | `reagent_transaction_type` NOT NULL | §6 | — | KEEP |
| `quantity` | numeric(12,3) NOT NULL, CHECK > 0 | — | — | KEEP |
| `quantity_before`, `quantity_after` | numeric(12,3) NOT NULL | — | — | KEEP (R1) |
| `note` | text NULL | — | — | KEEP |
| `protocol_id` | uuid NULL → `protocols(id)` | — | — | KEEP (R1) |
| `analysis_purpose` | text NULL | — | — | KEEP (R1) |
| `recorded_date` | date NULL | D-08 (xarajat kalendari) | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `company_id` | — | B | yo'q | **ADD** (ETL: `reagents.company_id`) |

- `reagent_transaction_type` enum: `in`, `out`, `adjustment`, `disposal` — §6 bilan mos.
- Indekslar: `idx_reagent_transactions_created_at(DESC)`, `idx_reagent_transactions_reagent_id`, `idx_reagent_transactions_user_id`, `idx_reagent_tx_recorded_date`.

### `reagent_documents` (`:340`) — CONFLICT (tenant) · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `reagent_id` | uuid NOT NULL → `reagents(id)` ON DELETE CASCADE | §6 | — | KEEP |
| `doc_type` | `reagent_doc_type` NOT NULL | §6 "passport va tahlil natijasi", D-69 | — | KEEP |
| `file_name` | varchar(255) NOT NULL | — | — | KEEP |
| `file_path` | varchar(500) NOT NULL | — | — | KEEP |
| `file_size` | integer NULL | fayl limiti | sxemada cheklov yo'q | KEEP; limit 20MB ilovada → D-79 (U-9) |
| `file_mime` | varchar(100) NULL | — | — | KEEP |
| `uploaded_by` | uuid NOT NULL → `users(id)` | — | — | KEEP |
| `uploaded_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `company_id` | — | B | yo'q | **ADD** (ETL: `reagents.company_id`) |

- `reagent_doc_type` enum: `passport`, `analysis`. Indeks: `idx_reagent_documents_reagent_id`.

---

## P8 — Harorat

### `sensor_configs` (`:463`) — CONFLICT · KEEP + CHANGE → D-78 (U-8)

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `sensor_id` | varchar(100) NOT NULL, **UNIQUE (global)** | D-52 "nomi" | identifikator butun platforma bo'yicha unikal; boshqa jadvallar shu matn orqali bog'langan | KEEP; **CHANGE**: `UNIQUE(company_id, sensor_id)` → D-78 |
| `location_name` | varchar(255) NOT NULL | D-52 "joyi (xona)" | — | KEEP |
| `temp_min`, `temp_max` | numeric(5,1) NOT NULL, CHECK `temp_min < temp_max` | §7 | — | KEEP |
| `humidity_min`, `humidity_max` | numeric(5,1) NULL | D-52 (ixtiyoriy) | — | KEEP |
| `is_active` | boolean NOT NULL DEFAULT true | — | — | KEEP (R1) |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-12 | — | KEEP |

- Cheklovlar: `sensor_configs_pkey`, `sensor_configs_sensor_id_key UNIQUE(sensor_id)` (→ `UNIQUE(company_id, sensor_id)`, D-78), CHECK `temp_range_valid`. Indeks: `idx_sensor_configs_company_id`.
- D-83: sensor — `sensor_id` (identifikator) + `location_name` (joyi).

### `temperature_readings` (`:621`) — CONFLICT (tenant) · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `sensor_id` | varchar(100) NOT NULL → `sensor_configs(sensor_id)` | §7 | matnli FK | **CHANGE** → `sensor_config_id uuid` → `sensor_configs(id)`; matnli `sensor_id` ko'chirilmaydi (D-78) |
| `temperature` | numeric(5,2) NOT NULL | §7 | — | KEEP |
| `humidity` | numeric(5,2) NULL | §7 | — | KEEP |
| `alert_triggered` | boolean NOT NULL DEFAULT false | §7 | — | KEEP |
| `recorded_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `is_manual` | boolean NOT NULL DEFAULT false | §7, D-03 | — | KEEP |
| `recorded_by` | uuid NULL → `users(id)` ON DELETE SET NULL | D-52 | — | KEEP |
| `company_id` | — | B | yo'q | **ADD** (ETL: `sensor_configs.company_id`) |

- Indekslar: `idx_temp_readings_alerts(alert_triggered) WHERE alert_triggered = true`, `idx_temp_readings_recorded_at(DESC)`, `idx_temp_readings_sensor_id`, `idx_temperature_readings_recorded_by WHERE recorded_by IS NOT NULL`.

### `temperature_alerts` (`:606`) — CONFLICT (tenant) · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `sensor_id` | varchar(100) NOT NULL → `sensor_configs(sensor_id)` | §7 | matnli FK | **CHANGE** → `sensor_config_id uuid` → `sensor_configs(id)`; matnli `sensor_id` ko'chirilmaydi (D-78) |
| `reading_id` | uuid NOT NULL → `temperature_readings(id)` | §7 | — | KEEP |
| `temperature` | numeric(5,2) NOT NULL | — | — | KEEP |
| `alert_type` | varchar(50) NOT NULL | — | qiymatlar ro'yxati sxemada yo'q (CHECK yo'q) | KEEP (R1) |
| `notified_at` | timestamptz NULL | D-13/D-04 xabarnoma | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `company_id` | — | B | yo'q | **ADD** (ETL: `sensor_configs.company_id`) |

- D-52: alertni yopish/"ko'rildi" yo'q — sxemada ham bunday ustun yo'q (mos). Indeks: `idx_temp_alerts_notified(notified_at) WHERE notified_at IS NULL`.

---

## P9 — Stabilizatsiya

### `stability_studies` (`:537`) — CONFLICT · KEEP + CHANGE

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `sample_id` | uuid NOT NULL → `samples(id)` | §8 | — | KEEP |
| `started_at` | date NOT NULL DEFAULT CURRENT_DATE | — | — | KEEP |
| `storage_conditions` | text NULL | — | — | KEEP (R1) |
| `status` | text NOT NULL DEFAULT `'active'`, CHECK (`active`, `completed`, `cancelled`) | §8, D-56 (`active`/`completed`, bekor qilish yo'q) | `cancelled` qiymati bor | **CHANGE**: CHECK faqat `active`, `completed` → D-81 (eski bazada 0 ta) |
| `created_by` | uuid NOT NULL → `users(id)` | — | — | KEEP |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `company_id` | uuid NOT NULL → `companies(id)` ON DELETE RESTRICT | D-12 | — | KEEP |

- `uq_stability_sample UNIQUE(sample_id)` — namunada **umrbod bitta** study; D-58: bir vaqtda bitta **faol** → **CHANGE**:
  qisman unikal `(sample_id) WHERE status = 'active'` (R2).
- Indekslar: `idx_stability_studies_company_id`, `idx_stability_studies_sample`, `idx_stability_studies_status`.
- ETL: `cancelled` qatorlar yo'q (D-82 tekshiradi).

### `stability_checkpoints` (`:499`) — CONFLICT (tenant) · KEEP + ADD

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `study_id` | uuid NOT NULL → `stability_studies(id)` ON DELETE CASCADE | §8 | — | KEEP |
| `interval_tag` | text NOT NULL | §8 checkpoint nomi (T9, T18…) | nom ustuni shu | KEEP |
| `due_date` | date NOT NULL | §8 sana | — | KEEP |
| `status` | text NOT NULL DEFAULT `'pending'`, CHECK (`pending`, `in_progress`, `completed`, `overdue`) | §8, D-55 | mos | KEEP |
| `assigned_to` | uuid NULL → `users(id)` | D-53 | **bor** | KEEP |
| `completed_at` | timestamptz NULL | D-55 | — | KEEP |
| `completed_by` | uuid NULL → `users(id)` | D-55 | — | KEEP |
| `notes` | text NULL | — | — | KEEP |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP (+ trigger) |
| `company_id` | — | B | yo'q | **ADD** (ETL: `stability_studies.company_id`) |

- `uq_checkpoint UNIQUE(study_id, interval_tag)` — §8 (bir study'da bir xil nom yo'q) bilan mos.
- Indekslar: `idx_stability_cp_due`, `idx_stability_cp_status`, `idx_stability_cp_study`.

### `stability_results` (`:519`) — CONFLICT · KEEP + ADD + CHANGE → D-77 (U-7)

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `checkpoint_id` | uuid NOT NULL → `stability_checkpoints(id)` ON DELETE CASCADE | §8 | — | KEEP |
| `parameter` | varchar(200) NOT NULL | §8, D-05 | — | KEEP |
| `initial_value` | text NULL | §8 T0, D-57 | har natija qatorida | KEEP — T0 study yaratilganda yoziladi (D-77) |
| `current_value` | text **NOT NULL** | §8 | qator faqat qiymat bilan yaratiladi | **CHANGE: NULL ruxsat** — parametr qatorlari oldindan yaratiladi (D-77) |
| `specification` | text NULL | D-57 | — | KEEP |
| `result_status` | text NOT NULL DEFAULT `'pass'`, CHECK (`pass`, `fail`, `warning`) | §8, D-57 (qo'lda) | — | KEEP (R1); ilova qiymatni har doim aniq beradi (R2) |
| `recorded_by` | uuid NOT NULL → `users(id)` | — | — | KEEP |
| `recorded_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |
| `company_id` | — | B | yo'q | **ADD** (ETL: study orqali) |

- Indeks: `idx_stability_results_cp`.

---

## P11 — Telegram

### `telegram_link_tokens` (`:592`) — CONFLICT · KEEP + RENAME (ustun)

| Ustun | Sxema | Spec / D-xx | Farq | Hukm |
|---|---|---|---|---|
| `id` | uuid PK | — | — | KEEP |
| `user_id` | uuid NOT NULL → `users(id)` ON DELETE CASCADE | §13 | — | KEEP |
| `token` | varchar(64) NOT NULL, UNIQUE | D-65: SHA-256 xesh | xom token saqlanadi | **RENAME → `token_hash`** (64 hex — tur mos) |
| `expires_at` | timestamptz NOT NULL | D-65 (muddat — Q-55) | — | KEEP |
| `used_at` | timestamptz NULL | D-65 bir martalik | — | KEEP |
| `created_at` | timestamptz NOT NULL DEFAULT now() | — | — | KEEP |

- Cheklovlar: `telegram_link_tokens_pkey`, `telegram_link_tokens_token_key UNIQUE(token)`; indeks `idx_tlt_token` (takror).
- `company_id`: yo'q — auth jadvali. ETL: **ko'chirilmaydi** (qisqa muddatli tokenlar).

---

## Yig'ma: FOYDALANUVCHI QARORI KERAK bandlari (R4) — hammasi hal qilingan

"Taklif" — P0.9 dagi dastlabki taklif (tarix uchun); amaldagi yechim — "Qaror" ustunida.
Qo'shimcha: `stability_studies.status` dan `cancelled` olib tashlandi (D-81); ETL xavfsizlik tekshiruvi — D-82.

| # | Jadval.ustun | Sxema | Spec / D-xx | Ziddiyat | Taklif | Qaror |
|---|---|---|---|---|---|---|
| U-1 | `samples.expires_at`, `samples.deadline` | `date NULL` ikkalasi | D-17: namunada muddat maydoni yo'q | R1 (sxema) va D-17 (foydalanuvchi qarori) to'qnashadi | Ustunlar saqlanadi (ETL ma'lumoti yo'qolmaydi), lekin D-17 bo'yicha ilovada ishlatilmaydi va xabarnoma yo'q — faqat namuna sahifasida o'qish uchun ko'rsatiladi. | ✅ RESOLVED → **D-71**: ikkala ustun baseline'ga kirmaydi (D-17); eski bazadagi yagona qiymat ETL tracking voqeasi izohiga yoziladi. |
| U-2 | `samples.type = 'in_process'` | `sample_type` enum'da bor | §3: 5 tur; R-SAMPLE-06 ro'yxatdan tashqarisini rad etadi | enum qiymati R1 bo'yicha qoladi, lekin bu turdagi namunaning xatti-harakati (pasport, protokol roli) spec'da yo'q | Enum'da qoladi (legacy qatorlar); yangi namuna yaratishda ruxsat berilmaydi; legacy `in_process` namunalar `standard` protokol oqimi bilan ko'rsatiladi. | ✅ RESOLVED → **D-72**: `in_process` enum'dan olib tashlanadi (eski bazada 0 ta). |
| U-3 | `sample_documents` (butun jadval) | Namunaga biriktirilgan umumiy hujjatlar | Spec'da yo'q (pasport — `samples.passport_*`) | Jadval spec'da yo'q, xatti-harakati (kim yuklaydi/ko'radi/o'chiradi) noma'lum | ETL'da `files` jadvaliga ko'chirish (`files.sample_id` bor, D-61 generic fayllar); `sample_documents` baseline'ga kirmaydi. | ✅ RESOLVED → **D-73**: jadval baseline'ga kirmaydi, ETL qadami yo'q (0 ta qator). |
| U-4 | `protocols.sample_id IS NULL` qatorlar; `protocols.substance_id`, `batch_number`, `sample_source`, `notes` | Namunasiz legacy protokollar mumkin | §3/§4, D-15: protokol namunaga tegishli | Legacy protokollarni namunasiz ko'chirsak, ilova oqimlari (D-14/D-15, reyestr) ishlamaydi | Ustunlar saqlanadi (R1). `sample_id IS NULL` protokollar ETL'da ko'chiriladi, lekin faqat arxiv sifatida (o'qish uchun, status o'zgarmaydi); keyinchalik `NOT NULL` qilinmaydi. Muqobil — ETL har biri uchun sintetik namuna yaratadi. | ✅ RESOLVED → **D-74**: `sample_id` NOT NULL; 4 ta eski ustun kirmaydi (0 ta namunasiz protokol, ustunlarda qiymat yo'q). |
| U-5 | `protocol_values` ma'lumoti | Qo'lda kiritilgan parametr qiymatlari (2026-iyungacha) | D-09: jadval yangi sxemada yo'q; "faqat ETL'da kerak bo'lsa ko'rib chiqiladi" | Fayl asosidagi yangi protokolda bu qiymatlar uchun joy yo'q | ETL qiymatlarni protokol bo'yicha bitta hujjatga (PDF/CSV) aylantirib, protokolning asosiy fayli bo'sh bo'lsa shu faylni biriktiradi; aks holda faqat arxiv dump'ida qoladi. | ✅ RESOLVED → **D-75**: ETL'ga ham kirmaydi (0 ta qator). |
| U-6 | `protocol_files` (`finished_product` bo'lmagan protokollar) | Har qanday protokolga fayl mumkin | D-49: faqat `finished_product` | Legacy qatorlar D-49 ga zid bo'lishi mumkin | Ko'chiriladi va ko'rsatiladi (o'qish/yuklab olish), yangi fayl qo'shish D-49 bo'yicha bloklanadi. | ✅ RESOLVED → **D-76**: faqat `finished_product` (D-49), istisno yo'q (0 ta). |
| U-7 | `stability_results.current_value NOT NULL`; T0/parametr ro'yxati joyi | Natija qatori faqat joriy qiymat bilan; study darajasida parametr ro'yxati yo'q | D-05 (5 standart parametr oldindan), D-55 ("barcha parametrlar to'ldirilgach"), D-57 (T0 study yaratishda kiritiladi va checkpointlarga ko'chadi) | Parametr ro'yxati va T0 natijalardan oldin saqlanadigan joy sxemada yo'q | Study yaratishda har checkpoint uchun parametr qatorlari oldindan yaratiladi: `current_value` NULL ga ruxsat beriladi (R1 dan istisno), `initial_value` T0 bilan to'ldiriladi. Muqobil — yangi `stability_study_parameters` jadvali (R3). | ✅ RESOLVED → **D-77**: taklif qabul — `current_value` NULL, parametr qatorlari oldindan, T0 `initial_value` da. |
| U-8 | `sensor_configs.sensor_id` UNIQUE (global); `temperature_readings.sensor_id`, `temperature_alerts.sensor_id` → matnli FK | Sensor identifikatori butun platforma bo'yicha unikal | D-12 (kompaniyalar izolyatsiyasi), B (UUID FK) | Ikki kompaniya bir xil sensor nomini ishlata olmaydi; matnli FK B qoidasiga zid | `UNIQUE(company_id, sensor_id)`; o'qish/alert jadvallari `sensor_config_id uuid` FK orqali bog'lanadi (ETL `sensor_id` → `id` moslaydi), `sensor_id` matni nusxa sifatida qolmaydi. | ✅ RESOLVED → **D-78**: taklif qabul. |
| U-9 | `reagent_documents.file_size` (limit) | Cheklov yo'q | D-06: protokol 20MB, generic 50MB; reaktiv hujjatlari nomlanmagan (Q-39) | Sxema javob bermaydi | 20MB (protokol fayllari bilan bir xil, xuddi shu formatlar). | ✅ RESOLVED → **D-79**: 20MB, protokol formatlari. |
| U-10 | `audit_logs.record_id NOT NULL` | Har audit yozuvida yozuv ID'si majburiy | D-60: muvaffaqiyatsiz login ham yoziladi | Noma'lum email bilan urinishda `record_id` uchun qiymat yo'q | `record_id` NULL ga ruxsat (faqat auth hodisalari uchun, `table_name = 'auth'`); muvaffaqiyatli login/logout — `sessions.id`. | ✅ RESOLVED → **D-80**: NULL faqat auth hodisalari uchun, CHECK bilan. |

## Yig'ma: spec/DECISIONS ga sxema sabab o'zgartirish tavsiyalari

| Joy | Hozirgi matn | Sxema | Tavsiya | Holat |
|---|---|---|---|---|
| D-52 | Sensor: "nomi, joyi (xona)" | `sensor_id` (identifikator) + `location_name`; alohida "nom" ustuni yo'q | "Sensor: `sensor_id` (identifikator) va `location_name` (joyi)" deb aniqlashtirish. |
| D-48 | `.docx` tarkibi: "namuna (tur, modda, lot, seriya, **kod**)" | Namuna kodi ustuni yo'q (D-68: avtomatik kod yo'q) | "kod" ni olib tashlash. |
| R-NOTIF-11 | "Ro'yxatdan tashqari xabarnoma turi yaratib bo'lmaydi (DB CHECK/enum)" | Enum'da legacy `sample_created`, `sample_overdue`, `general` | "Ilova faqat §9 turlarini yaratadi; enum'dagi legacy turlar faqat ko'chirilgan yozuvlar uchun" (checklist'da yangilandi). |
| D-56 | "bekor qilish yo'q" | CHECK'da `cancelled` | "Yangi bekor qilish yo'q; legacy `cancelled` study'lar faqat ko'rish uchun" deb qo'shish. |
| Q-35 taklifi / D-67 | "Parametr nomi uch tilda" | `substance_parameters.parameter_name` — bitta ustun | D-67 da yangilandi (sxema bo'yicha). |
| §6 / R-REAG-13 | "passport, tahlil natijasi" | `reagent_doc_type`: `passport`, `analysis` | Enum qiymati `analysis` (D-69, checklist yangilandi). |
| D-39 | Pasport rad sababi majburiy | Saqlash ustuni yo'q | Sabab `sample_tracking` voqeasida saqlanadi (yangi ustun yo'q) — D-39 ga izoh. |
