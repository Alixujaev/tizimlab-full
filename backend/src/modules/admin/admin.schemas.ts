import { z } from 'zod';
import { PERMISSION_CATALOG } from '../../config/permissions.js';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { emailSchema } from '../auth/auth.schemas.js';
import { PASSWORD_MAX_LENGTH } from '../auth/password.js';

export const COMPANY_USER_ROLES = [
  'chemist',
  'lab_head',
  'director',
  'kontrolyor',
  'admin',
] as const;

export const companyUserRoleSchema = z.enum(COMPANY_USER_ROLES);

export const createUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1, 'Ism kiritilmagan').max(255),
  password: z.string().min(1, 'Parol kiritilmagan').max(PASSWORD_MAX_LENGTH),
  role: companyUserRoleSchema,
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Ism kiritilmagan').max(255).optional(),
    role: companyUserRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Kamida bitta maydon o'zgartirilishi kerak",
  });

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(1, 'Yangi parol kiritilmagan').max(PASSWORD_MAX_LENGTH),
});

export const setUserPermissionsSchema = z.object({
  permissions: z.array(z.enum(PERMISSION_CATALOG)),
});

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  role: companyUserRoleSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type SetUserPermissionsInput = z.infer<typeof setUserPermissionsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
