# Xodimlar analitikasi — ko'rsatkichlar formulalari (P13)

Qarorlar: DECISIONS.md **D-159..D-165**. Bu hujjat D-163 ning to'liq matni (formulalar jadvali).
SQL: `backend/src/modules/analytics/analytics.service.ts`, view/funksiya: `014_analytics.sql`.

## Umumiy qoidalar

- **Davr P** = `[from 00:00, to+1 00:00)` Asia/Tashkent vaqtida (D-161). Presetlar 7d/30d/90d (bugun bilan), `custom` ≤ 366 kun, kelajak emas.
  Oldingi davr — shu uzunlikdagi bevosita oldingi oraliq (▲▼ taqqoslash). Trend: ≤ 31 kun — kunlik, aks holda haftalik (dushanbadan).
- **Tenant**: barcha so'rovlar `company_id` (tokendan) bo'yicha. O'chirilgan namunalar (`deleted_at`) hech qayerda hisoblanmaydi.
- **Sof muddat** (D-162): `analytics_net_hours(sample, start, end)` = `end − start − Σ to'xtatilgan oraliqlar`; oraliq = `stopped` voqeasi → keyingi `resumed` (bo'lmasa `end`), `[start, end]` ga qirqiladi. Soat, 1 xona.
- **Birinchi biriktirish / birinchi tasdiq** = `sample_tracking` dagi eng erta `assigned|reassigned` / `approved` voqeasi.
- **Qaror atributsiyasi**: protokolni tasdiqlash/rad etish (`protocol_signatures`) o'zidan oldingi oxirgi `submitted` imzosi egasiga (yuboruvchi) yoziladi — qayta biriktirishda ham to'g'ri kimyogarga tushadi.
- **Foiz**: maxraj 0 → `null` ("ma'lumot yo'q"). Bo'sh davr: sonlar 0, o'rtachalar `null`.
- **Snapshot** ko'rsatkichlar joriy holatni bildiradi, davr va taqqoslashga bog'liq emas.
- Sub'ektiv "ball/reyting" yo'q; jadval faqat quyidagi ko'rsatkichlar bo'yicha saralanadi.
- Namuna kodi tizimda yo'q (D-68); natijalar ro'yxatida namuna modda nomi, tur, lot/seriya bilan ko'rsatiladi (D-84 bilan mos).

## Kimyogar (`chemist`)

| Kalit | Ko'rsatkich | Formula |
|---|---|---|
| `assigned` | Biriktirilgan namunalar | `assigned_to = U` va `assigned_at ∈ P` |
| `completed` | Bajarilgan | `assigned_to = U` va birinchi `approved` ∈ P |
| `inProgress` | Jarayonda (snapshot) | `assigned_to = U`, status ∈ {in_progress, stopped, submitted, rejected} |
| `rejected` | Rad etilgan | `rejected` qarorlar ∈ P, yuboruvchi = U |
| `rejectionRate` | Rad etish foizi | rad ÷ (tasdiq + rad) × 100 (yuboruvchi = U, qarorlar ∈ P) |
| `firstPassRate` | Birinchi urinishda tasdiq | shu protokolda avval rad bo'lmagan tasdiqlar ÷ barcha tasdiqlar × 100 (yuboruvchi = U, ∈ P) |
| `resubmissions` | Qayta yuborishlar | U ning `submitted` imzolari ∈ P, ulardan oldin shu protokolda `rejected` bo'lgan |
| `avgCompletionHours` | O'rtacha bajarish muddati | o'rtacha `net(assigned_at, birinchi approved)`, bajarilganlar bo'yicha |
| `overdueCheckpoints` | Muddati o'tgan checkpointlar (snapshot) | `stability_checkpoints.assigned_to = U`, `completed` emas, `overdue` yoki `due_date < bugun` |
| trend | Bajarilganlar | birinchi `approved` ∈ P bo'yicha kun/hafta |

## Kontrolyor (`kontrolyor`)

| Kalit | Ko'rsatkich | Formula |
|---|---|---|
| `created` | Kiritgan namunalar | `created_by = U`, `created_at ∈ P` |
| `passportsUploaded` | Yuklangan pasportlar | `passport_uploaded` voqealari, `user_id = U`, ∈ P |
| `createdApproved` | Tasdiqlangan (o'z namunalari) | `created_by = U`, birinchi `approved` ∈ P |
| `createdRejected` | Rad etilgan (o'z namunalari) | `created_by = U`, ∈ P da kamida bitta `rejected` voqeasi (namunalar soni) |
| `avgIntakeHours` | O'rtacha kiritish → biriktirish | o'rtacha `net(created_at, birinchi biriktirish)`, biriktirish ∈ P |
| trend | Kiritilganlar | `created_at` bo'yicha |

## Lab boshlig'i (`lab_head`)

| Kalit | Ko'rsatkich | Formula |
|---|---|---|
| `reviewedApproved` / `reviewedRejected` | Tasdiqlagan / rad etgan protokollar | U imzolagan `approved` / `rejected` ∈ P |
| `avgReviewHours` | O'rtacha ko'rib chiqish vaqti | o'rtacha (qaror − oldingi `submitted`), soat |
| `assignedByMe` | Biriktirgan namunalar | `assigned`/`reassigned` voqealari `user_id = U`, ∈ P |
| `queueApprovals` | Tasdiq kutayotganlar (snapshot) | kompaniyadagi `submitted` protokollar |
| `queueAssignments` | Biriktirish kutayotganlar (snapshot) | kompaniyadagi `pending_assignment` namunalar |
| trend | Ko'rib chiqilganlar | U qarorlari bo'yicha |

## Direktor (`director`)

| Kalit | Ko'rsatkich | Formula |
|---|---|---|
| `finalized` | Yakunlagan protokollar | U ning `finalized` imzolari ∈ P |
| `avgFinalizeHours` | Yakunlash kechikishi | o'rtacha (finalized − shu protokolning oxirgi `approved` imzosi), soat |

## Kompaniya (`GET /analytics/overview`)

| Kalit | Ko'rsatkich | Formula |
|---|---|---|
| `samplesCreated` | Kiritilgan namunalar | `created_at ∈ P` |
| `samplesApproved` | Tasdiqlangan namunalar | birinchi `approved` ∈ P |
| `protocolsFinalized` | Yakunlangan protokollar | `finalized` imzolar ∈ P |
| `rejectionRate` / `firstPassRate` | Rad etish / birinchi urinish foizi | yuqoridagi formulalar, butun kompaniya qarorlari bo'yicha |
| `avgTatHours` | O'rtacha aylanish vaqti (TAT) | o'rtacha `net(created_at, birinchi approved)`, tasdiq ∈ P |
| `openSamples` | Ochiq namunalar (snapshot) | status ≠ approved |
| `lateSamples` | Kechikayotgan namunalar (snapshot) | ochiq va `analysis_end < bugun` (D-17: alohida deadline yo'q — rejadagi tahlil tugash sanasi) |
| voronka | kiritilgan → biriktirilgan → tahlilda → yuborilgan → tasdiqlangan → yakunlangan | P da kiritilgan namunalar; har namuna erishgan eng yuqori bosqich bo'yicha kumulyativ: biriktirilgan (`assigned_at`/voqea), tahlilda (fayli bor protokol), yuborilgan (`submitted` voqeasi), tasdiqlangan (birinchi `approved`), yakunlangan (`finalized` protokol) |
| rad sabablari | taqsimot | P dagi `rejected` qarorlar; sabab = shu rad etishning tracking sababi (in_process — protokolning oxirgi sababi); `lower(trim(bo'shliqlar ixchamlangan))` bo'yicha guruh, top-8 + "boshqa", bo'sh → "ko'rsatilmagan" |
| turlar | namuna turlari bo'yicha | P da kiritilganlar, `type` bo'yicha |
| yuklama | kimyogar ochiq namunalari | faol kimyogarlar, status ∈ {in_progress, stopped, submitted, rejected} |
| harorat | yopilmagan / davrdagi alertlar | `temperature_alerts.resolved_at IS NULL` / `created_at ∈ P` |
| stabilizatsiya | faol tadqiqotlar, muddati o'tgan va 14 kun ichidagi checkpointlar | `stability_studies.status = 'active'`; checkpoint qoidalari yuqoridagidek |

## Ruxsat matritsasi (D-159, D-160)

| Endpoint | kontrolyor | chemist | lab_head | director | admin | super_admin |
|---|---|---|---|---|---|---|
| `GET /analytics/me` | ✅ | ✅ | ✅ | ✅ | 403 | 403 |
| `GET /analytics/overview` | 403 | 403 | 403 | ✅ | 403 | 403 |
| `GET /analytics/team` | 403 | 403 | ✅ chemist, kontrolyor + o'zi | ✅ lab_head, chemist, kontrolyor + o'zi | 403 | 403 |
| `GET /analytics/users/:id`, `/samples` | faqat o'zi | faqat o'zi | chemist, kontrolyor, o'zi | lab_head, chemist, kontrolyor, o'zi | 403 | 403 |

Doiradan tashqari (o'z kompaniyasi) — 403; boshqa kompaniya xodimi — 404 `USER_NOT_FOUND`.
