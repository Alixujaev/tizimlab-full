## 16. Texnik arxitektura

### Backend

```
Express.js + TypeScript + PostgreSQL (raw pg, ORM yo'q)
├── src/
│   ├── app.ts                    # Entry point, middleware, router ulash, Socket.IO va botni ishga tushirish
│   ├── config/
│   │   ├── database.ts           # pg pool, query() va withTransaction()
│   │   ├── env.ts                # Zod bilan env validatsiyasi (cloud DB yoki lokal, R2, Telegram)
│   │   └── swagger.ts            # API docs
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT tekshiruv, requireRole(), requireCompany(), requirePermission()
│   │   ├── sessionTimeout.ts     # Harakatsizlikda sessiyani tugatish
│   │   └── errorHandler.ts       # Markazlashtirilgan xato handler
│   ├── modules/
│   │   ├── auth/                 # Login, logout, refresh, me
│   │   ├── admin/                # Foydalanuvchilar CRUD, ruxsatlar, statistikasi (kompaniya darajasida)
│   │   ├── companies/            # Kompaniyalar CRUD (faqat super_admin)
│   │   ├── substances/           # Moddalar + parametrlar
│   │   ├── protocols/            # Protokollar + fayl/pasport yuklash + imzolar
│   │   ├── samples/              # Namunalar + biriktirish + to'xtatish
│   │   ├── reagents/             # Reaktivlar + tranzaksiyalar
│   │   ├── temperature/          # Sensorlar + o'qishlar + alertlar
│   │   ├── stability/            # Stabilizatsiya + ixtiyoriy checkpointlar + natijalar
│   │   ├── notifications/        # Xabarnomalar (DB + socket + Telegram)
│   │   ├── dashboard/            # Rol bo'yicha dashboard statistikasi
│   │   ├── files/                # Cloudflare R2 fayl saqlash (generic)
│   │   ├── audit/                # Audit (platforma) va Activity (kompaniya) jurnallari
│   │   └── telegram/             # Bot + Mini App autentifikatsiyasi
│   ├── realtime/
│   │   └── socket.ts             # Socket.IO server, JWT handshake, user:<id> xonalar
│   ├── jobs/
│   │   └── stabilityAlertJob.ts  # 6 soatlik fon jarayoni
│   ├── db/
│   │   └── migrations/           # 001..038 raqamlangan SQL migratsiyalar
│   └── utils/
│       └── logger.ts             # Winston logger
```

Har bir modul bir xil naqshda: `*.router.ts` (Express Router + Swagger annotatsiya), `*.controller.ts` (parse/validate + chaqirish), `*.service.ts` (barcha SQL va biznes-logika, domen xato klassi bilan), `*.schemas.ts` (Zod sxemalar).

### Frontend

```
React + TypeScript + Vite + Tailwind CSS
├── src/
│   ├── api/                      # Axios client + har modul uchun funksiyalar
│   │   ├── client.ts             # Axios instance + 401 interceptor + token refresh navbati
│   │   ├── companies.ts, admin.ts, auditLogs.ts, dashboard.ts, notifications.ts, telegram.ts, ...
│   ├── hooks/                    # React Query hooks (har modul uchun)
│   │   └── useNotificationSocket.ts  # Socket.IO ulanishi va real vaqtli yangilash
│   ├── lib/socket.ts             # Socket.IO client ulanish/uzish
│   ├── pages/
│   │   ├── auth/, dashboard/ (+_dashboards: Chemist/Director/LabHead/Inspector/SuperAdmin)
│   │   ├── samples/, registry/ (Reyestr — tasdiqlangan namunalar arxivi)
│   │   ├── substances/, reagents/ (+ expenses/journal), temperature/, stability/
│   │   ├── companies/ (+SuperAdminDashboard), logs/ (Audit), activity/ (Faoliyat)
│   │   └── users/
│   ├── store/authStore.ts        # Zustand — foydalanuvchi, token
│   ├── i18n/locales/             # uz.json, ru.json, en.json
│   ├── components/layout/        # AppLayout, Sidebar (rol bo'yicha, super_admin uchun alohida menyu)
│   ├── components/ui/            # Table, Modal, Spinner, Pagination, NotificationBell
│   └── types/index.ts            # Barcha TypeScript interfeyslari
```

> **Eslatma:** Moddalar, Reaktivlar va Stabilizatsiya sahifalari asosiy yon menyuda (Sidebar) endi ko'rsatilmaydi — ular namuna sahifasi va ichki havolalar orqali ochiladi (menyu soddalashtirilgan: Dashboard, Namunalar, Reyestr, Harorat, Foydalanuvchilar, Faoliyat).

### Ma'lumotlar bazasi (PostgreSQL)

| Jadval | Tavsif |
|--------|--------|
| `companies` | Platformadagi kompaniyalar (multi-tenancy) |
| `users` | Foydalanuvchilar (`company_id`, Telegram bog'lanish maydonlari bilan) |
| `sessions` | Refresh token sessiyalari (hash ko'rinishda) |
| `user_permissions` | Individual ruxsatlar |
| `telegram_link_tokens` | Telegram akkaunt ulash tokenlari |
| `substances` / `substance_parameters` | Moddalar va ularning parametrlari |
| `protocols` / `protocol_values` / `protocol_signatures` | Protokollar, qiymatlar (eski tuzilma), imzolar |
| `samples` / `sample_tracking` | Namunalar va voqealar tarixi |
| `reagents` / `reagent_transactions` / `reagent_documents` | Reaktivlar, tranzaksiyalar, hujjatlar |
| `sensor_configs` / `temperature_readings` / `temperature_alerts` | Harorat monitoringi |
| `stability_studies` / `stability_checkpoints` / `stability_results` | Stabilizatsiya |
| `notifications` | Tizim xabarnomalari |
| `files` | Cloudflare R2'dagi generic fayllar metama'lumoti |
| `audit_log` | Tizim darajasidagi audit yozuvlari |

### Migratsiyalar

`001`dan `038`gacha raqamlangan SQL fayllar (`npm run migrate` bilan qo'llaniladi, `schema_migrations` jadvalida kuzatiladi). Asosiy bosqichlar: asosiy jadvallar (001–013) → protokol fayllari (014) → namuna turlari kengaytirilishi va ko'p-protokol (017, 029) → kompaniyalar/multi-tenancy (021–023) → protokol pasporti (026–027) → notification turlari (028, 037) → Telegram (032–033) → generic fayllar/R2 (034) → moslashuvchan stabilizatsiya checkpointlari (036).

### Infratuzilma

- **Ma'lumotlar bazasi:** cloud PostgreSQL (Neon/Railway/Supabase — `DATABASE_URL` orqali) yoki lokal PostgreSQL.
- **Fayl xotira:** Cloudflare R2 (S3-mos).
- **Real vaqtli aloqa:** Socket.IO (bir xil HTTP server ustida).
- **Bildirishnoma kanali:** Telegram Bot API (`grammy`).
- **API hujjatlari:** Swagger UI, faqat `development` muhitida, login formasi bilan.

---
