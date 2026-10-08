import { z } from 'zod';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** D-22: `page` (default 1), `limit` (default 20, max 100). Boshqa query sxemalari `.extend()` bilan kengaytiradi. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export function toOffset({ page, limit }: PaginationQuery): number {
  return (page - 1) * limit;
}
