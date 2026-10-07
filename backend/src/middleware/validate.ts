import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

type Part = 'body' | 'query' | 'params';
type Schemas = Partial<Record<Part, z.ZodType>>;

declare module 'express-serve-static-core' {
  interface Request {
    /** `validate()` dan o'tgan, tiplangan ma'lumotlar (Express 5 da `req.query` faqat o'qish uchun). */
    validated: { body?: unknown; query?: unknown; params?: unknown };
  }
}

export interface FieldIssue {
  path: string;
  message: string;
}

/** Zod sxemalari bo'yicha tekshiradi; xatolar 400 VALIDATION_ERROR, `details` — maydonlar bo'yicha. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const issues: FieldIssue[] = [];
    const validated: Request['validated'] = { ...req.validated };
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            path: [part, ...issue.path.map(String)].join('.'),
            message: issue.message,
          });
        }
      }
    }
    if (issues.length) return next(new ValidationError(undefined, issues));
    req.validated = validated;
    next();
  };
}
