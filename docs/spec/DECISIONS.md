# Qabul qilingan qarorlar

Bu qarorlar `LOYIHA.md` dagi noaniqlik yoki eski holatlarni hal qiladi va spec bilan teng kuchga ega.
Checklist'da ularga `DECISIONS.md D-NN` deb havola qilinadi.

| ID | Qaror |
|---|---|
| D-01 | Toza baseline schema yoziladi (038 migratsiyani ko'chirmaymiz). Eski bazadan ma'lumot ko'chirish ETL skripti P12 da. |
| D-02 | Rad etish oqimi: protokol `rejected` bo'lsa → kimyogar tuzatib qayta yuboradi (rad etilgan protokol draft'ga qaytadi, sabab saqlanadi); namuna `in_progress` ga qaytadi. |
| D-03 | Sensor avtomatik ma'lumot yuborishi (ingest endpoint, API key) KEYINGI versiyaga. Hozir: `sensor_configs` (min/max), qo'lda kiritish (`is_manual`), alertlar. Schema keyin qo'shishga tayyor bo'lsin. |
| D-04 | `low_stock` va `temperature_alert` xabarnomalari kompaniyaning `lab_head` va `admin` rollariga boradi. |
| D-05 | Stabilizatsiya 5 ta standart parametr: Tavsif (Description), Assay, Namlik miqdori (Water content), Qo'shimcha aralashmalar (Related substances), Eruvchanlik (Dissolution). Qo'shish/olib tashlash mumkin. |
| D-06 | Fayl limitlari: protokol fayllari 20MB, generic `files` moduli 50MB; hammasi Cloudflare R2'da; ruxsat etilgan: PDF, .doc, .docx, JPEG, PNG. |
| D-07 | Direktor finalizatsiyasi (`finalized`) faqat protokol statusiga ta'sir qiladi, namuna statusiga emas. Reyestr `approved` namunalardan iborat. |
| D-08 | Reaktiv "xarajat" = `out` tipidagi `reagent_transactions` (narx maydoni yo'q). Xarajat jurnali/ro'yxati shularni kalendar va ro'yxat ko'rinishida ko'rsatadi. |
| D-09 | `protocol_values` jadvali yangi schemaga KIRMAYDI (eski tuzilma; faqat ETL'da kerak bo'lsa ko'rib chiqiladi). |
| D-10 | `user_permissions` resource:action katalogi P2 da tuziladi va foydalanuvchiga tasdiqlatiladi. |
| D-11 | Docker yo'q; `Dockerfile` ixtiyoriy, P12 da. |
| D-12 | Multi-tenancy: ilova darajasida — HAR BIR tenant jadvaliga so'rov `company_id` bo'yicha filtrlanadi; buni tekshiradigan integration test P12 da (lekin har fazada yoziladi). |
