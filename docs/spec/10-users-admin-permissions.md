## 10. Foydalanuvchilar, Admin panel, Ruxsatlar

**Admin panel** (`/users`, `lab_head`/`director`/`admin` uchun ochiq): foydalanuvchilar ro'yxati va statistikasi, yangi foydalanuvchi yaratish, parolni tiklash, foydalanuvchi loglarini ko'rish.

**Individual ruxsatlar** — rol asosidagi ruxsatlardan tashqari `user_permissions` jadvali orqali `resource`+`action` darajasida qo'shimcha huquq berish/olib tashlash mumkin (`requirePermission` middleware, natija so'rov davomida keshlanadi).

Har bir foydalanuvchi o'z profilida (`/profile`) parolini o'zgartira oladi, Telegram akkauntini ulay/uzay oladi.

---
