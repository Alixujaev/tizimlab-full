-- D-200: refresh rotatsiyasida grace oynasi.
-- Oxirgi rotatsiya vaqti va shu oynada almashtirilgan (eski) token xeshlari.
-- Oyna `rotated_at` ga bog'langan: grace qayta ishlatish uni uzaytirmaydi.
ALTER TABLE sessions
  ADD COLUMN rotated_at timestamp with time zone,
  ADD COLUMN prev_token_hashes text[] NOT NULL DEFAULT '{}';
