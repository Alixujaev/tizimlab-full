import { z } from 'zod';

export const webAppAuthBodySchema = z.object({
  initData: z.string().min(1, 'initData majburiy'),
});

export type WebAppAuthBody = z.infer<typeof webAppAuthBodySchema>;
