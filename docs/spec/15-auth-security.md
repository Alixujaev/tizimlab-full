## 15. Autentifikatsiya va xavfsizlik

### Token tizimi (ikki tokenli)

| Token | Davomiyligi | Joylashuvi |
|---|---|---|
| Access token (JWT) | 30 daqiqa | `Authorization: Bearer ...`, har so'rovda |
| Refresh token (JWT) | 7 kun | HTTP-only cookie, faqat `/auth/refresh` da |

Refresh token bazada xom holda emas, faqat `SHA-256` xeshi saqlanadi (`sessions` jadvali); har refresh'da token rotatsiya qilinadi. Bir foydalanuvchi bir vaqtda **3 ta** aktiv sessiyaga ega bo'lishi mumkin — 4-chisi eskisini avtomatik o'chiradi. Uzoq harakatsizlikda (`SESSION_IDLE_TIMEOUT_MINUTES`, standart 30 daqiqa) sessiya avtomatik tugaydi.

Access token va Socket.IO handshake bitta funksiyadan (`verifyAccessToken`) foydalanadi — ikkalasi ham bir xil tarzda tasdiqlanadi.

### Parol

bcrypt (10 round) bilan xeshlangan. Foydalanuvchi o'z parolini o'zgartira oladi, admin boshqa foydalanuvchi parolini tiklashi mumkin.

### Boshqa himoya choralari

- `helmet` — HTTP xavfsizlik sarlavhalari.
- Global rate-limit — 15 daqiqada IP boshiga 2000 so'rov (faqat production'da).
- Zod orqali barcha kiruvchi ma'lumotlar va muhit o'zgaruvchilari validatsiyasi.

---
