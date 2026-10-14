# TizimLab spec — indeks

Yagona haqiqat manbai: [`../LOYIHA.md`](../LOYIHA.md). Quyidagi fayllar undan **aynan** ko'chirilgan bo'laklar
(matn o'zgartirilmagan; faqat "Mundarija" bo'limi kiritilmagan). Ziddiyat bo'lsa — `LOYIHA.md` + `DECISIONS.md` ustun.

| Fayl | LOYIHA.md bo'limi |
|---|---|
| [00-overview.md](00-overview.md) | Sarlavha, kirish, §0 Loyiha maqsadi |
| [01-roles.md](01-roles.md) | §1 Foydalanuvchi rollari + ruxsat matritsasi |
| [02-multitenancy.md](02-multitenancy.md) | §2 Ko'p-kompaniyali arxitektura |
| [03-samples-registry.md](03-samples-registry.md) | §3 Namunalar, status machine, namuna pasporti, Reyestr |
| [04-protocols.md](04-protocols.md) | §4 Protokollar, holatlar, fayllar, DOCX eksport, imzolar |
| [05-substances.md](05-substances.md) | §5 Moddalar |
| [06-reagents.md](06-reagents.md) | §6 Reaktivlar va Xarajat jurnali |
| [07-temperature.md](07-temperature.md) | §7 Harorat monitoringi |
| [08-stability.md](08-stability.md) | §8 Stabilizatsiya tekshiruvi |
| [09-notifications.md](09-notifications.md) | §9 Xabarnomalar |
| [10-users-admin-permissions.md](10-users-admin-permissions.md) | §10 Foydalanuvchilar, Admin panel, Ruxsatlar |
| [11-audit-activity.md](11-audit-activity.md) | §11 Audit va Faoliyat jurnali |
| [12-files.md](12-files.md) | §12 Fayllarni saqlash |
| [13-telegram.md](13-telegram.md) | §13 Telegram integratsiyasi |
| [14-i18n.md](14-i18n.md) | §14 Ko'p tillilik |
| [15-auth-security.md](15-auth-security.md) | §15 Autentifikatsiya va xavfsizlik |
| [16-architecture.md](16-architecture.md) | §16 Texnik arxitektura (backend, frontend, DB, migratsiyalar, infratuzilma) |
| [17-workflow.md](17-workflow.md) | §17 Asosiy ish oqimi |
| [18-changelog.md](18-changelog.md) | §18 O'zgarishlar tarixi + "Aniqlashtirish" + hujjat izohi |

## Qo'shimcha hujjatlar

| Fayl | Maqsad |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Qabul qilingan qarorlar (D-01..D-95) — spec bilan teng kuchli |
| [SCHEMA_DIFF.md](SCHEMA_DIFF.md) | Eski production sxemasi (`docs/legacy/schema.sql`) ↔ spec/DECISIONS farqlari, foydalanuvchi qarori bandlari (U-xx — hal qilingan, D-71…D-80) |
| [BASELINE_PLAN.md](BASELINE_PLAN.md) | Yangi baseline sxema: jadvallar (KEEP/RENAME/DROP/ADD) va faza bo'yicha migratsiya fayllari |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Ziddiyatlar, noaniqliklar, yetishmayotgan joylar — faza bo'yicha, taklif (default) va BLOCKING/NON-BLOCKING bilan (gate — D-19) |
| [ANALYTICS_METRICS.md](ANALYTICS_METRICS.md) | P13 xodimlar analitikasi: ko'rsatkichlar formulalari va ruxsat matritsasi (D-159..D-165) |
| [SPEC_CHECKLIST.md](SPEC_CHECKLIST.md) | Har bir tekshiriladigan talab, faza va holat bilan |
