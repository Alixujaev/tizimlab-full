## 11. Audit va Faoliyat jurnali

Ikki xil jurnal mavjud:

| Sahifa | Kim ko'radi | Ko'lami |
|---|---|---|
| **Audit jurnali** (`/logs`) | `super_admin` | Butun platforma — barcha kompaniyalar bo'yicha tizim darajasidagi hodisalar |
| **Faoliyat jurnali** (`/activity`) | `lab_head`, `director`, `admin` | Faqat o'z kompaniyasi ichidagi foydalanuvchi harakatlari |

Ikkalasi ham backend'da bitta `audit` modulida joylashgan (`audit.router.ts` — global, `activity.router.ts` — kompaniya bo'yicha filtrlangan).

---
