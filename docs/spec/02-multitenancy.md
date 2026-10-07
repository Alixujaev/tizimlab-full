## 2. Ko'p-kompaniyali arxitektura (multi-tenancy)

TizimLab bitta o'rnatilgan tizim sifatida bir nechta laboratoriya-kompaniyaga xizmat qiladi:

- Har bir `users` yozuvi `company_id` ga ega (super_admin bundan mustasno — uniki `null`).
- Har bir asosiy jadval (`samples`, `substances`, `protocols`, `reagents`, ...) kompaniya bo'yicha ajratilgan.
- JWT tokenida `company_id` bor — `requireCompany` middleware kompaniya kontekstisiz so'rovlarni bloklaydi.
- **Kompaniyalar** sahifasi (`/companies`, faqat `super_admin`) — yangi kompaniya yaratish (nomi + `slug`), faollashtirish/o'chirish, tahrirlash.

Bitta kompaniya — bitta mustaqil laboratoriya: o'z foydalanuvchilari, o'z namunalari, o'z reaktiv va moddalar ro'yxati bilan, boshqa kompaniyalarning ma'lumotini ko'rmaydi.

---
