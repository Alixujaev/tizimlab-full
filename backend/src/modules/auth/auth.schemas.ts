import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from './password.js';

/** D-91: email kichik harfga keltiriladi (saqlash va solishtirish). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Email formati noto'g'ri").max(255));

// Login'da parol siyosati tekshirilmaydi (siyosat parol o'rnatilganda) — faqat bo'sh/haddan uzun emas
export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Parol kiritilmagan').max(PASSWORD_MAX_LENGTH),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
