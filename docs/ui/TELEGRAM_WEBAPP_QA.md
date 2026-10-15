# Telegram WebApp Mobil UI — Qo'lda tekshiruv (QA Checklist)

Ushbu hujjat P14 (Telegram WebApp mobil foydalanuvchi tajribasi) bo'yicha turli platformalar va muhitlarda qo'lda o'tkaziladigan tekshiruvlar ro'yxatini belgilaydi.

---

## 1. BotFather sozlamalari

- [ ] **Menu Button sozlash:**
  - BotFather ga `/setmenubutton` yuboring.
  - Botingizni tanlang.
  - Menyu tugmasi matnini kiriting: `Laboratoriya` (yoki `TizimLab`).
  - WebApp URL manzilini kiriting: `https://lab.tizimlab.uz`.
- [ ] **Buyruqlar ro'yxati:**
  - BotFather ga `/setcommands` yuboring.
  - Buyruqlar ro'yxatiga `/app - TizimLab laboratoriya tizimini WebApp da ochish` qo'shilganini tekshiring.
- [ ] **Inline Mode (agar kerak bo'lsa):**
  - `/setinline` yoniq bo'lishi ixtiyoriy, xabarnomalar to'g'ridan-to'g'ri `sendTelegramNotification` orqali inline tugma bilan yuboriladi.

---

## 2. Avto-kirish va Autentifikatsiya oqimlari

- [ ] **Bog'lanmagan foydalanuvchi:**
  - TizimLab da Telegram hisobi ulanmagan yangi Telegram akkauntidan WebApp ni oching.
  - Natija: "Telegram hisobingiz bog'lanmagan" sarlavhasi, aniq yo'riqnoma ("Profil bo'limiga o'ting...") va "Brauzerda ochish" tugmasi chiqadi.
  - "Brauzerda ochish" bosilganda tashqi brauzerda `https://lab.tizimlab.uz/profile` ochiladi.
- [ ] **Ulangan foydalanuvchi (Muvaffaqiyatli avto-kirish):**
  - WebApp ochilganda skeleton ko'rsatiladi, so'ng `POST /telegram/webapp-auth` muvaffaqiyatli o'tib, to'g'ridan-to'g'ri rolga mos bosh sahifa ochiladi.
  - Login forma ochilmaydi.
  - Tokenlar yoki `initData` brauzer konsoliga yoki URL manzil qatoriga chiqmaydi.
- [ ] **Eskirgan sessiya / Replay:**
  - Bir xil `initData` qayta yuborilganda yoki 24 soatdan eski bo'lsa: "Sessiya muddati eskirgan" ekrani va "Qayta yuklash" tugmasi chiqadi.
- [ ] **Tarmoq xatosi (Offline / Sekin tarmoq):**
  - Tarmoq uzilganda "Tarmoq xatosi" xabari va "Qayta urinish" tugmasi chiqadi.

---

## 3. Platformalar bo'yicha tekshiruv (iOS, Android, Desktop)

### iOS (iPhone / iPad)
- [ ] **Safe-area insets (Notch / Dynamic Island):**
  - Yuqori sarlavha ekranning yuqori qismidagi tirqish (notch/island) ostida qolmaydi (`env(safe-area-inset-top)` hisobga olingan).
- [ ] **Pastki uy indikatori (Home Indicator):**
  - Pastki navigatsiya paneli barmoq surish chizig'i bilan to'qnashmaydi (`env(safe-area-inset-bottom)` hisobga olingan).
- [ ] **Pastga surish (Pull-to-close) cheklovi:**
  - Sahifani yuqoridan pastga siljitganda Telegram WebApp tasodifan yopilib ketmaydi (`disableVerticalSwipes()` qo'llangan).
- [ ] **Haptic Feedback:**
  - Tablarni almashtirishda yengil tebranish (`selection`), xatoliklarda (`notification:error`), muvaffaqiyatda (`notification:success`) ishlaydi.

### Android
- [ ] **Pastki tizim navigatsiya tugmalari:**
  - Android ning 3 ta tugmali yoki jestli navigatsiya paneli pastki tablarni to'sib qo'ymaydi.
- [ ] **Klaviatura ochilishi:**
  - Input maydoniga (masalan tahlil natijasi yoki izoh) bosilganda virtual klaviatura ochiladi, fokusdagi maydon avtomatik ekranning o'rtasiga siljiydi, kiritish tugmalari ko'rinadi.
- [ ] **Kamera integratsiyasi:**
  - Fayl yuklashda "Kamera" tanlanganda Android tizim kamerasi to'g'ridan-to'g'ri ochiladi (`capture="environment"`).

### Telegram Desktop / Web
- [ ] **Katta o'lchamli modal oynada ochilish:**
  - Desktop Telegramda ochilganda markazlashtirilgan konteynerda to'g'ri joylashadi.
  - CSP `frame-ancestors` xatosi bermaydi.

---

## 4. Mavzu (Theme) va Rang Kontrasti

- [ ] **Telegram qorong'i rejimi (Dark Mode):**
  - Telegram mijozini "Dark" mavzuga o'tkazing.
  - WebApp fon ranglari va matn ranglari bir zumda qorong'i rejim tokenlariga moslashadi (`themeChanged` hodisasi).
- [ ] **Telegram yorug' rejimi (Light Mode):**
  - Telegram mijozini "Light" mavzuga o'tkazing.
  - Ranglar darhol yorug' holatga qaytadi.
- [ ] **WCAG AA Kontrast:**
  - Telegram dagi tugma matni va foni orasidagi kontrast kamida 4.5:1 bo'lishi tekshirilgan. Past kontrastli maxsus Telegram mavzularida xavfsiz standart tokenlarga fallback qilinadi.

---

## 5. Navigatsiya va Native elementlar

- [ ] **Native BackButton:**
  - Bosh sahifada (`/`) Telegram native orqaga tugmasi ko'rinmaydi.
  - Tafsilot sahifalariga (`/samples/:id`, `/registry`) o'tganda yuqori chap burchakda orqaga tugmasi paydo bo'ladi.
  - Orqaga tugmasi bosilganda oldingi sahifaga qaytadi.
- [ ] **Teginish maydonlari (Touch Targets):**
  - Barcha tablar, tugmalar va bosiladigan elementlar kamida 44px balandlik va kenglikka ega (`min-h-12`, `min-w-11`).
- [ ] **"Yana" (More) Sheet Drawer:**
  - Pastki paneldagi "Yana" tugmasi bosilganda pastdan yuqoriga ravon Drawer chiqadi.
  - Bo'lim tanlanganda Drawer yopiladi va tegishli sahifa ochiladi.

---

## 6. Rol bo'yicha bosh ekran va ruxsatlar (403 xavfsizligi)

- [ ] **Kimyogar (chemist):**
  - Biriktirilgan namunalar holati ko'rinadi.
  - "Protokol yuklash va yuborish" tezkor tugmasi mavjud.
  - Moddalar, xodimlar yoki korxona ma'lumotlariga ruxsatsiz 403 so'rov yuborilmaydi.
- [ ] **Nazoratchi (kontrolyor):**
  - "Yangi namuna kiritish" tezkor tugmasi mavjud.
  - Ro'yxatga olingan va tasdiqlash kutayotgan namunalar ko'rinadi.
- [ ] **Laboratoriya mudiri (lab_head):**
  - Tasdiqlash navbati va biriktirish kutayotgan namunalar ko'rinadi.
- [ ] **Direktor (director):**
  - Yakunlash kutayotgan protokollar va asosiy KPI ko'rsatkichlari ko'rinadi.

---

## 7. Deep link va Bot xabarnomalari

- [ ] **Bot xabarnomasidagi tugma:**
  - Namunaga mas'ul biriktirilganda yoki protokol tasdiqlanganda Telegram ga kelgan xabardagi "Ochish" tugmasini bosing.
  - WebApp to'g'ridan-to'g'ri o'sha namuna (`/samples/:id`) yoki protokol sahifasini ochadi.
- [ ] **Ruxsatsiz startParam:**
  - Boshqa rolga tegishli yo'l (masalan kimyogar uchun `/users`) startParam orqali berilsa, 403 xatosi o'rniga xavfsiz bosh sahifaga yo'naltiriladi.

---

## 8. Fayl yuklash (MobileFileUpload)

- [ ] **Hajm tekshiruvi:**
  - 20MB dan katta fayl tanlanganda serverga yuborilmasdan "Fayl hajmi 20MB dan oshmasligi kerak" ogohlantirishi chiqadi.
- [ ] **Format tekshiruvi:**
  - `.exe`, `.zip` yoki boshqa ruxsatsiz fayl tanlanganda darhol format xatosi chiqadi.
- [ ] **Yuklangan faylni ochish:**
  - Fayl muvaffaqiyatli yuklangach "Ochish" tugmasi bosilganda Telegram `openLink` orqali brauzerda yoki instant view da ochiladi.
