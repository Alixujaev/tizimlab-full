## 12. Fayllarni saqlash

Fayllar (protokol hujjatlari, pasportlar, reaktiv hujjatlari) **Cloudflare R2** (S3-mos ob'ekt xotirasi) da saqlanadi — `@aws-sdk/client-s3` orqali. Backend `files` moduli generic yuklash/ro'yxat/imzolangan-URL/o'chirish funksiyalarini taqdim etadi (`multer` xotira-saqlash bilan, max 50MB, PDF/Word/JPEG/PNG cheklovi bilan). `R2_*` muhit o'zgaruvchilari orqali sozlanadi.

---
