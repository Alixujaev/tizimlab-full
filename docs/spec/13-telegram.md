## 13. Telegram integratsiyasi

Ikki qatlamli arxitektura:

- **Bot** (`grammy` kutubxonasi) — akkaunt ulash, push-bildirishnomalar, `/start`, `/help`, `/status`, `/unlink` buyruqlari.
- **Mini App** — mavjud React frontend Telegram WebApp sifatida ochiladi (mobil qurilmada Telegram ilovasi ichida to'liq LIMS).

**Auth oqimlari:**
1. Birinchi ulash: veb-login → Profil → "Telegram ulash" → `POST /telegram/link-token` → bot `/start <token>`.
2. WebApp login: Telegram WebApp `initData` → `POST /telegram/webapp-auth` (HMAC-SHA256 tekshiruvi bilan) → avtomatik kirish.
3. Push-bildirishnomalar: `createNotification()` chaqirilganda DB yozuvi bilan birga Telegram orqali ham yuboriladi (fire-and-forget).

**Sozlash:** @BotFather orqali token olish → `.env` ga `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` → dasturlash muhitida polling avtomatik ishga tushadi, production'da `TELEGRAM_WEBHOOK_URL`+`TELEGRAM_WEBHOOK_SECRET` kerak.

---
