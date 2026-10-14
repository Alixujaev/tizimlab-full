# UI audit (1-bosqich, 2026-10-14)

Frontend UI qayta qurilishidan oldingi holat. Maqsad — har sahifa `src/ui` dizayn tizimiga ko'chirilganda shu ro'yxat
nolga tushishi (D-158; ESLint `LEGACY_UI_FILES` ro'yxati shu fayllar bilan bir xil).

## Xulosa

| Ko'rsatkich | Qiymat |
| --- | --- |
| Native `<button>` | 175 (51 fayl) |
| Native `<input>` | 104 (29 fayl), shundan `type="date"` 14, `type="checkbox"` 7, `type="file"` 7 |
| Native `<select>` | 22 (18 fayl) |
| Native `<textarea>` | 9 |
| Native `<table>` | 5 (+ `components/ui/Table` orqali 13 sahifa) |
| `window.confirm()` | 3 (ReagentDetailPage, StabilityDetailPage ×2) |
| `alert()` | 2 (ReagentDetailPage) |
| `prompt()` | 0 |
| Radio | 0 |
| Arbitrary qiymatlar (`text-[10px]`, `max-h-[90vh]`, `min-w-[500px]` ...) | 16 |
| Tailwind palitra ranglari to'g'ridan | ~2000 ishlatish, 12 xil palitra (slate 1130, indigo 206, blue 195, rose 167, red 88, emerald 81, amber 68 ...) |
| Brauzer standart scrollbar | hamma joyda (maxsus uslub yo'q) |
| JS bundle | 930.10 kB (gzip 246.08 kB) — bitta chunk, Vite 500 kB ogohlantirishi |
| CSS | 41.62 kB |

## Nomuvofiqliklar va takroriy stil

- **Asosiy rang ikki xil:** asosiy tugmalar `bg-indigo-600` (21+19 hover) va `bg-blue-600` (20+16 hover) aralash; xavfli amallar
  `rose-600` va `red-600` aralash; muvaffaqiyat `emerald` va `green` aralash.
- **Radius besh xil:** `rounded` 126, `rounded-md` 158, `rounded-lg` 131, `rounded-xl` 32, `rounded-full` 34 — bir xil
  turdagi elementlar (tugma, karta, input) turli sahifalarda turlicha.
- **Mayda matn arbitrary px:** `text-[10px]`, `text-[11px]` (Reagents, Protocol, Substances, Stability) — tipografiya
  shkalasidan tashqarida.
- **Holat badge'lari takrorlanadi:** `SampleStatusBadge`, `SampleTypeBadge`, `StabilityStatusBadge` va
  `ReagentDetailPage` ichidagi xarita — har biri o'z rang xaritasiga ega (bir xil holat turli sahifada turli rang).
- **Statistika kartalari ikki marta:** `dashboard/_dashboards/StatCard.tsx` va `users/UserStatsCards.tsx`.
- **Modal o'rniga maxsus overlay:** `stability/CreateCheckpointModal`, `CreateStudyModal`, `RecordResultsModal`
  o'z `fixed inset-0` qatlamini quradi — focus trap, Esc va fokus qaytishi yo'q.
- **Toast to'g'ridan sonner'dan** 7 faylda (`richColors` standart ko'rinishi) — `notify` o'rami yo'q.
- **Yuklanish holati:** hamma joyda `Spinner` (kontent shakli yo'q); ba'zi joyda `className="h-8 w-8 text-indigo-600"` bilan
  qo'lda o'lcham/rang.
- **Bo'sh/xato holatlari:** har sahifada o'zicha matn (`common.noData`) yoki umuman yo'q; qayta urinish tugmasi yo'q.
- **Formalar:** label/xato bog'lanishi (`aria-describedby`, `aria-invalid`) ko'p joyda yo'q; xato matni forma ostida umumiy.
- **Sana maydonlari** brauzer `type="date"` — ko'rinish brauzer/OS tiliga bog'liq (D-110 DD.MM.YYYY bilan zid).
- **Fayl maydonlari** brauzer standart "Choose file" tugmasi.
- **Dark mode** yo'q; ranglar tokensiz bo'lgani uchun qo'shib bo'lmaydi.

## Fayllar bo'yicha (native elementlar)

| Fayl | button | input | select | textarea | table | date | checkbox | file | confirm/alert |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `components/layout/LanguageSwitcher.tsx` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `components/layout/TopBar.tsx` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `components/substances/SubstanceSelect.tsx` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `components/ui/NotificationBell.tsx` | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/activity/ActivityPage.tsx` | 2 | 5 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| `pages/audit/AuditLogPage.tsx` | 2 | 5 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| `pages/audit/LogDetailsModal.tsx` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/auth/LoginPage.tsx` | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/companies/CompaniesPage.tsx` | 4 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/companies/CompanyConfirmModal.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/companies/CompanyFormModal.tsx` | 2 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/profile/ProfilePage.tsx` | 6 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/reagents/ExpensesPage.tsx` | 1 | 3 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| `pages/reagents/ReagentDetailPage.tsx` | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| `pages/reagents/ReagentDocumentModal.tsx` | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| `pages/reagents/ReagentFormModal.tsx` | 2 | 9 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |
| `pages/reagents/ReagentJournalPage.tsx` | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/reagents/ReagentsPage.tsx` | 10 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/reagents/ReagentTransactionModal.tsx` | 2 | 4 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| `pages/registry/RegistryDeleteModal.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/registry/RegistryDetailPage.tsx` | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/registry/RegistryPage.tsx` | 4 | 6 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `pages/samples/PassportDeleteModal.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/PassportRejectModal.tsx` | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/PassportSection.tsx` | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| `pages/samples/ProtocolRejectModal.tsx` | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/ProtocolSection.tsx` | 19 | 5 | 0 | 0 | 0 | 0 | 0 | 5 | 0 |
| `pages/samples/SampleAssignModal.tsx` | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/SampleDetailPage.tsx` | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/SampleFormModal.tsx` | 2 | 8 | 1 | 1 | 0 | 3 | 0 | 0 | 0 |
| `pages/samples/SampleResumeModal.tsx` | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/SamplesPage.tsx` | 6 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/samples/SampleStopModal.tsx` | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `pages/stability/CreateCheckpointModal.tsx` | 3 | 2 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| `pages/stability/CreateStudyModal.tsx` | 7 | 7 | 1 | 0 | 0 | 2 | 0 | 0 | 0 |
| `pages/stability/RecordResultsModal.tsx` | 3 | 2 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `pages/stability/StabilityDetailPage.tsx` | 4 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 2 |
| `pages/stability/StabilityPage.tsx` | 6 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `pages/substances/SubstanceDeleteModal.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/substances/SubstanceDetailModal.tsx` | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| `pages/substances/SubstanceFormModal.tsx` | 4 | 10 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| `pages/substances/SubstancesPage.tsx` | 7 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/temperature/ManualReadingModal.tsx` | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/temperature/ResolveAlertModal.tsx` | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `pages/temperature/SensorConfigModal.tsx` | 6 | 8 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| `pages/temperature/TemperaturePage.tsx` | 5 | 2 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| `pages/users/PermissionsModal.tsx` | 2 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| `pages/users/ResetPasswordModal.tsx` | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/users/UserFormModal.tsx` | 2 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/users/UserLogsModal.tsx` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `pages/users/UsersPage.tsx` | 5 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

## Reja (bosqichlar)

1. `ui-1-foundation` — tokenlar (`src/styles/tokens.css`), `src/ui` komponentlari, ESLint qoidasi + legacy ro'yxat.
2. `ui-2-shell` — layout, navigatsiya, login, xato sahifalari, dark mode.
3. `ui-3-pages` — barcha sahifalar; ro'yxat bo'shaydi, Tailwind standart palitrasi o'chiriladi.
4. `ui-4-performance` — code splitting, React Query keshlash, Lighthouse.
