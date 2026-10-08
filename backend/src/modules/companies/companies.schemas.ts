import { z } from 'zod';
import { emailSchema } from '../auth/auth.schemas.js';
import { PASSWORD_MAX_LENGTH } from '../auth/password.js';
import { paginationQuerySchema } from '../../utils/pagination.js';

/** Q-10, D-95: slug formati: kichik harf, raqam, tire; 3–50 belgi. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug kamida 3 belgidan iborat bo'lishi kerak")
  .max(50, "Slug ko'pi bilan 50 belgidan iborat bo'lishi kerak")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug formati noto'g'ri (faqat kichik harf, raqam va tire)");

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgi bo'lishi kerak").max(255),
  slug: slugSchema,
  admin: z.object({
    email: emailSchema,
    fullName: z.string().trim().min(1, 'Administrator ismi kiritilmagan').max(255),
    password: z.string().min(1, 'Parol kiritilmagan').max(PASSWORD_MAX_LENGTH),
  }),
});

export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgi bo'lishi kerak").max(255).optional(),
    slug: slugSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "Kamida bitta maydon (name yoki slug) kiritilishi kerak",
  });

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
