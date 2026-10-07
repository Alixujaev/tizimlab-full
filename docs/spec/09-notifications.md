## 9. Xabarnomalar — real vaqtli va Telegram

### Turlari

| Tur | Qachon yuboriladi |
|---|---|
| `sample_assigned` | Kimyogarga namuna biriktirilganda |
| `sample_approved` / `sample_rejected` | Namuna tasdiqlanganda/rad etilganda |
| `protocol_submitted` | Kimyogar protokolni yuborganda |
| `protocol_approved` / `protocol_rejected` | Protokol tasdiqlanganda/rad etilganda |
| `temperature_alert` | Harorat chegaradan chiqqanda |
| `low_stock` | Reaktiv zaxirasi kam qolganda |
| `stability_due_soon` / `stability_overdue` | Checkpoint muddati yaqinlashganda/o'tganda |

### Yetkazish kanallari

1. **Bazaga yozish** — `notifications` jadvali, ekranning yuqori o'ng burchagidagi bell ikonasi orqali ko'rinadi.
2. **Real vaqtli push** — Socket.IO orqali. Har bir foydalanuvchi ulanishda o'zining `user:<id>` xonasiga qo'shiladi; yangi bildirishnoma `notification:new` hodisasi bilan brauzerga to'g'ridan-to'g'ri, sahifani yangilamasdan yetib boradi (React Query keshiga yoziladi + toast ko'rsatiladi). Socket handshake xuddi REST so'rovlar kabi JWT access-token bilan tasdiqlanadi.
3. **Telegram push** — foydalanuvchi Telegram akkauntini ulagan bo'lsa, bot orqali xabar yuboriladi (pastga qarang).

---
