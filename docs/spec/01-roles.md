## 1. Foydalanuvchi rollari

Tizimda 6 ta rol mavjud:

| Rol | Uzbekcha | Asosiy vazifa | Ko'lam |
|-----|----------|---------------|--------|
| `super_admin` | Super-administrator | Platformani boshqaradi: kompaniyalarni yaratish/faollashtirish, barcha kompaniyalar bo'yicha audit jurnali | Butun platforma (kompaniyaga bog'liq emas) |
| `kontrolyor` | Kontrolyor | Namuna kiritish, laboratoriyaga topshirish | Bitta kompaniya |
| `chemist` | Kimyogar | Tahlil o'tkazish, protokol to'ldirish, stabilizatsiya natijasi kiritish | Bitta kompaniya |
| `lab_head` | Lab boshlig'i | Kimyogarga yo'naltirish, protokolni tasdiqlash, foydalanuvchilarni boshqarish | Bitta kompaniya |
| `director` | Direktor | Protokolni yakunlash (finalizatsiya), umumiy statistika | Bitta kompaniya |
| `admin` | Kompaniya administratori | Foydalanuvchilar, ruxsatlar, parol tiklash — kompaniya darajasida | Bitta kompaniya |

> **Muhim:** `super_admin` boshqa rollardan tubdan farq qiladi — u hech qanday kompaniyaga bog'lanmagan (`company_id = null`) va oddiy ish oqimlarida (namuna, protokol va h.k.) qatnashmaydi. Uning interfeysi butunlay boshqacha — faqat **Kompaniyalar** va **Audit jurnali** sahifalarini ko'radi (`SuperAdminDashboard`).

### Kim nimaga kirishi mumkin (kompaniya ichidagi rollar)

| Modul | kontrolyor | chemist | lab_head | director | admin |
|-------|-----------|---------|----------|----------|-------|
| Namuna yaratish | ✅ | — | — | — | — |
| Namuna ko'rish | Faqat o'ziniki | O'ziga biriktirilgan | ✅ Hammasi | ✅ Hammasi | ✅ Hammasi |
| Kimyogarga biriktirish | — | — | ✅ | — | — |
| Protokol fayl yuklash | — | ✅ | ✅ | — | ✅ |
| Protokol tasdiqlash | — | — | ✅ | — | — |
| Protokol yakunlash | — | — | — | ✅ | — |
| Reyestrni ko'rish | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moddalar | Ko'rish | Ko'rish | Ko'rish + tahrirlash | Ko'rish | ✅ To'liq |
| Reaktivlar | Ko'rish | Ko'rish | ✅ To'liq | Ko'rish | ✅ To'liq |
| Harorat | Ko'rish | Ko'rish | ✅ To'liq | Ko'rish | ✅ To'liq |
| Stabilizatsiya boshlash | — | — | ✅ | ✅ | ✅ |
| Stabilizatsiya natija kiritish | — | ✅ (biriktirilgan) | ✅ | ✅ | ✅ |
| Foydalanuvchilar boshqaruvi | — | — | ✅ | ✅ (ko'rish) | ✅ To'liq |
| Faoliyat jurnali | — | — | ✅ | ✅ | ✅ |

Rol asosidagi ruxsatlardan tashqari, `user_permissions` jadvali orqali **individual ruxsatlar** ham berilishi mumkin (`requirePermission(resource, action)` middleware) — masalan, bitta kimyogarga alohida qo'shimcha huquq berish.

---
