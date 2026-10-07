## 6. Reaktivlar va Xarajat jurnali

Reaktiv — tahlil uchun ishlatiladigan kimyoviy modda, zaxirasi kuzatiladi.

| Maydon | Tavsif |
|---|---|
| `quantity` | Joriy zaxira |
| `low_stock_threshold` | Shundan kam bo'lsa — ogohlantirish |
| `expires_at` | Yaroqlilik muddati |
| `is_hazardous` | Xavfli modda belgisi |

Har bir zaxira o'zgarishi (`in`, `out`, `adjustment`, `disposal`) `reagent_transactions` jadvalida loglanadi. **Xarajat jurnali** (`/reagents/journal`) va **xarajatlar ro'yxati** (`/expenses`) sahifalari orqali sarf-xarajatni kalendar/ro'yxat ko'rinishida kuzatish mumkin. Reaktivga passport va tahlil natijasi hujjatlari (`reagent_documents`) biriktiriladi.

`is_low_stock` va `is_expired` bayroqlari dashboardda ko'rsatiladi.

---
