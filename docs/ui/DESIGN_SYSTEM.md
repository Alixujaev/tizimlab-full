# TizimLab dizayn tizimi

Butun frontend UI bitta tizimdan quriladi: **tokenlar → atomlar → molekulalar → shablonlar → sahifalar**.
Sahifalar faqat `@/ui` barrel'idan import qiladi; native/brauzer standart elementlari va tasodifiy stil taqiqlangan (D-153, D-158).

## 1. Struktura qoidasi

```
frontend/src/
  styles/tokens.css          # BARCHA dizayn qiymatlari (rang, o'lcham, soya, shrift, z-index, harakat)
  index.css                  # Tailwind @theme → tokenlar, @utility'lar, global base
  ui/
    lib/                     # cx, useFocusTrap, useDismiss, usePopoverPosition, useMediaQuery, useScrollLock, field
    atoms/<Name>/            # Name.tsx · index.ts · Name.test.tsx
    molecules/<Name>/
    templates/<Name>/
    index.ts                 # yagona barrel: import { Button, DataTable, PageHeader } from '@/ui'
```

- Har komponent **o'z papkasida**: komponent, `index.ts` eksporti, test. Props TypeScript bilan; variantlar komponent
  faylidagi bitta obyekt-xaritada (`buttonVariants`, `toneClasses` ...), boshqa joyda takrorlanmaydi.
- Qatlam yo'nalishi: atom → (atom, lib); molekula → (atom, molekula, lib); shablon → (atom, molekula, lib).
  Sahifa → `@/ui`. Teskari import yo'q.
- Komponent o'z stilini o'zi saqlaydi: sahifa faqat joylashuv uchun (`w-full`, `sm:w-56`, `gap-4`) klass beradi,
  rang/radius/soyani o'zgartirmaydi.
- Ko'rinadigan matn faqat `t()` orqali (`ui.*` kalitlari uz/ru/en uchalasida); `i18next/no-literal-string` `src/ui` da ham ishlaydi.

## 2. Tokenlar (`src/styles/tokens.css`)

| Guruh | Tokenlar | Tailwind |
| --- | --- | --- |
| Sirt | `--tl-canvas`, `--tl-surface`, `--tl-surface-muted`, `--tl-surface-sunken` | `bg-canvas`, `bg-surface`, `bg-surface-muted`, `bg-surface-sunken` |
| Matn | `--tl-fg`, `--tl-fg-muted`, `--tl-fg-subtle` | `text-fg`, `text-fg-muted`, `text-fg-subtle` |
| Chiziq | `--tl-line`, `--tl-line-strong` | `border-line`, `border-line-strong` |
| Asosiy | `--tl-primary`, `-hover`, `-fg`, `-subtle`, `-subtle-fg`, `-line` | `bg-primary`, `text-primary-fg`, `bg-primary-subtle` ... |
| Semantik | `success` · `warning` · `danger` · `info` · `accent` × (`""`, `-subtle`, `-fg`, `-line`) | `bg-success-subtle`, `text-danger-fg`, `border-warning-line` ... |
| Boshqa | `--tl-focus`, `--tl-overlay`, `--tl-skeleton` | `outline-focus`, `bg-overlay`, `bg-skeleton` |
| Tipografiya | `--tl-font-sans` (tizim shrifti, yuklanmaydi), `--tl-text-xs … 3xl` + `--tl-leading-*` | `text-xs … text-3xl` |
| O'lcham | `--tl-space-unit` (0.25rem), `--tl-radius-sm … 2xl` | `p-4`, `gap-3`, `rounded-lg` |
| Soya | `--tl-shadow-sm … xl` | `shadow-sm … shadow-xl` |
| Qatlam | `--tl-z-sticky 10 · drawer 40 · modal 50 · popover 60 · toast 70 · tooltip 80` | `z-sticky`, `z-modal`, `z-popover` ... |
| Harakat | `--tl-duration-fast 150ms · base 200ms · slow 250ms`, `--tl-ease-standard/out/in` | `transition-colors motion-fast`, `animate-fade-in`, `animate-scale-in`, `animate-slide-in-*` |
| Layout | `--tl-sidebar-width`, `--tl-topbar-height`, `--tl-page-max-width`, `--tl-modal-sm … xl`, `--tl-drawer-width` | `w-sidebar`, `h-topbar`, `max-w-page`, `max-w-modal-md`, `w-drawer` |

**Qoidalar**

- Komponentda hex/rgb rang, `[Npx]` arbitrary qiymat va Tailwind standart palitrasi (`bg-slate-100`, `text-indigo-600`) ishlatilmaydi —
  faqat semantik klasslar. Yangi qiymat kerak bo'lsa — avval token.
- **Dark mode** (D-154): semantik tokenlar `prefers-color-scheme: dark` va `<html data-theme="dark">` uchun qayta aniqlanadi;
  komponentlar `dark:` variantisiz o'zi moslashadi.
- **Harakat**: faqat `transform`/`opacity`/rang, 150–250ms. `prefers-reduced-motion: reduce` da global o'chadi.
- **Fokus**: `focus-ring` utility (2px `--tl-focus` outline, faqat klaviaturada). Input'larda — `focus:ring`.

## 3. Komponentlar

### Atomlar

| Komponent | Qachon | Muhim props |
| --- | --- | --- |
| `Button` | Har qanday amal | `variant` primary/secondary/ghost/danger/danger-ghost, `size` sm/md/lg, `loading`, `leftIcon`, `rightIcon` |
| `IconButton` | Faqat ikonli amal (yopish, tahrirlash) | `icon`, `label` (majburiy), `variant`, `size` |
| `ButtonLink` | Navigatsiya, ko'rinishi tugma ("Bosh sahifaga", "Ochish") | `to`, `variant`, `size`, `leftIcon` |
| `Pressable` | Boy mazmunli bosiladigan qator/karta (bildirishnoma, tanlov) | `variant` row/card, `highlighted` |
| `FileButton` | Darhol yuklanadigan fayl amali ("Yuklash", "Almashtirish") | `onSelect`, `accept`, `loading` |
| `Input` | Bir qatorli matn/son/email/parol | `size`, `invalid`, `leftIcon`, `rightSlot` |
| `Textarea` | Ko'p qatorli matn (izoh, sabab) | `rows`, `invalid` |
| `Select` | Ro'yxatdan bitta qiymat (≤ ~50 variant) | `options`, `value`, `onChange`, `placeholder`, `name` |
| `Checkbox` | Mustaqil ha/yo'q, ko'p tanlov | `label`, `description`, `indeterminate` |
| `Radio` / `RadioGroup` | 2–5 o'zaro istisno variant, hammasi ko'rinsin | `options`, `value`, `onChange`, `orientation` |
| `Switch` | Darhol kuchga kiradigan sozlama | `checked`, `onChange`, `label` |
| `DatePicker` | Sana (DD.MM.YYYY ko'rinish, ISO qiymat) | `value`, `onChange`, `min`, `max` |
| `FileDropzone` | Fayl yuklash | `value`, `onChange`, `accept`, `maxBytes`, `error` |
| `Badge` | Toifa/belgi (tur, rol, son) | `tone`, `size`, `icon` |
| `StatusPill` | Ish oqimi holati (namuna, protokol, tadqiqot) | `tone`, `pulse` |
| `Spinner` | Qisqa amal (tugma ichida `inline`) | `size`, `inline` |
| `Skeleton` | Sahifa/ro'yxat/karta yuklanishi | `variant` text/rect/circle, `lines` |
| `Avatar` | Foydalanuvchi | `name`, `src`, `size` |
| `Tooltip` | Ikonli tugma/qisqartma izohi | `content` |
| `Icon` | Ichki SVG to'plami (D-156) | `name`, `size`, `label` |

### Molekulalar

| Komponent | Qachon |
| --- | --- |
| `FormField` | Har bir forma maydoni: label, hint, inline xato; ichidagi elementga id/aria avtomatik |
| `Alert` | Sahifa/forma ichidagi xabar (server xatosi, ogohlantirish); `danger`/`warning` — `role=alert` |
| `DescriptionList` | Tafsilot maydonlari (yorliq → qiymat), bo'sh qiymat "—" | `items`, `columns` |
| `Modal` | Diqqatni to'liq talab qiladigan forma/tafsilot (`size` sm–xl) |
| `Drawer` | Yon panel: mobil navigatsiya, filtrlar |
| `ConfirmDialog` | `confirm()` o'rniga — o'chirish, to'xtatish, rad etish (`tone="danger"`) |
| `Toaster` / `notify` | `alert()` o'rniga — amal natijasi xabari (D-155) |
| `Dropdown` | Ixtiyoriy kontentli ochiluvchi panel (bildirishnomalar) |
| `Menu` | Amallar ro'yxati, til/mavzu tanlovi (`checked`) |
| `Tabs` | Bir sahifadagi bo'limlar yoki holat filtri |
| `Pagination` | Server sahifalash (D-22 `meta`) |
| `EmptyState` / `ErrorState` | Bo'sh ro'yxat / yuklash xatosi (qayta urinish bilan) |
| `SearchInput` | Ro'yxat qidiruvi (debounce 300ms) |
| `DataTable` | Har qanday ro'yxat: saralash, sticky header, skelet/bo'sh/xato, mobil karta |

### Shablonlar

| Komponent | Qachon |
| --- | --- |
| `PageContainer` | Har sahifaning tashqi ramkasi |
| `PageHeader` | Har sahifaning sarlavhasi (h1, tavsif, amallar, orqaga havola) |
| `FilterBar` | Ro'yxat ustidagi filtrlar; `onSubmit` bilan — ko'p maydonli qidiruv formasi (role=search) |
| `DetailLayout` | Tafsilot sahifasi (asosiy + yon panel) |
| `Card` | Mazmun bloki (bo'lim, forma) |
| `StatCard` | Dashboard ko'rsatkichi |
| `PageSkeleton` | Sahifa yuklanishi shakli (`list`, `detail`, `cards`) |

## 4. Sahifa andozasi

```tsx
<PageContainer>
  <PageHeader title={t('samples.title')} actions={<Button leftIcon="plus">{t('samples.create')}</Button>} />
  <FilterBar onReset={reset} canReset={hasFilters}>
    <SearchInput value={q} onChange={setQ} className="sm:w-64" />
    <Select options={statusOptions} value={status} onChange={setStatus} aria-label={t('common.status')} />
  </FilterBar>
  <DataTable columns={columns} rows={data?.data ?? []} rowKey={(r) => r.id} loading={isLoading} error={isError} onRetry={refetch} />
  {data && <Pagination meta={data.meta} onPageChange={setPage} />}
</PageContainer>
```

- Yuklanish → `Skeleton` (DataTable o'zi), bo'sh → `EmptyState`, xato → `ErrorState` + `refetch`.
- Formalar: har maydon `FormField` ichida; server xatosi tegishli maydonga `error`, umumiy xato — forma tepasida.
- Destruktiv amal → `ConfirmDialog`; natija → `notify.success/error`.

## 5. Kirish qulayligi (har komponent kafolati)

- Klaviatura: hamma narsa Tab bilan yetiladi; Select/Menu/Tabs/DatePicker — WAI-ARIA naqshlari bo'yicha strelkalar,
  Home/End, Enter/Space, Esc.
- Modal/Drawer/kalendar/Dropdown: focus trap, Esc, yopilganda fokus qaytadi; ichma-ich qatlamlarda faqat ustki qatlam
  klaviaturani boshqaradi (`useFocusTrap` stack).
- Nomlar: `IconButton.label` majburiy; forma elementlari `FormField` orqali label'ga bog'lanadi; xato — `aria-invalid` +
  `aria-describedby`; holat rang bilan yolg'iz ifodalanmaydi (StatusPill matni bor).
- Kontrast: `fg` / `fg-muted` sirtlarda AA (4.5:1); `fg-subtle` faqat placeholder/ikon uchun.

## 6. Lint himoyasi

`eslint.config.mjs` (D-158): `src/ui` dan tashqarida `<select> <button> <input> <textarea> <table>` va
`alert/confirm/prompt` — xato. Hali ko'chirilmagan fayllar `LEGACY_UI_FILES` ro'yxatida; ro'yxat faqat qisqaradi.
Test: `frontend/tests/lint-ui.test.ts`.

## 7. Qobiq (`components/layout`)

- `AppLayout`: "asosiy mazmunga o'tish" havolasi, desktop `Sidebar` (ixchamlashadi, `tizimlab.sidebar`), mobil `Drawer`,
  `TopBar` (til, mavzu, bildirishnomalar, profil, chiqish), `ErrorBoundary` ichida `PageContainer` — sahifalar
  o'zi `PageContainer` qo'ymaydi, faqat `PageHeader` dan boshlaydi. Sahifa almashganda `animate-slide-up`.
- Sessiya aniqlanguncha `AppSkeleton` (spinner emas). Router `errorElement` — `RouteErrorPage`.
- Mavzu: `store/themeStore.ts` (D-154), `ThemeToggle`; til: `LanguageSwitcher` (Menu, `menuitemradio`).

## 8. Statik himoya (testlar)

- `frontend/tests/no-adhoc-styles.test.ts` — `src` da Tailwind standart palitrasi, `[#hex]`/`[Npx]` va
  `src/ui` dan tashqarida native element / `alert|confirm|prompt` **0** ta bo'lishi shart. `@theme` da
  `--color-*: initial` — standart palitra umuman kompilyatsiya qilinmaydi.
- `frontend/tests/i18n-keys.test.ts` — koddagi har bir statik `t('...')` kaliti uz/ru/en uchalasida bor.
- Select bilan testlarda `selectOption(user, combobox, value)` (`tests/helpers.tsx`).
