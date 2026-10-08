import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

/** Async handler xatolarini `next()` ga uzatadi (Express 5 buni o'zi ham qiladi; aniqlik uchun). */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

/** D-22: muvaffaqiyatli javob `{ data }`. */
export function sendOk<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

/** D-22: yangi resurs yaratilganda `{ data }` status 201. */
export function sendCreated<T>(res: Response, data: T): Response {
  return sendOk(res, data, 201);
}

/** D-22: ro'yxat javobi `{ data, meta: { page, limit, total } }`. */
export function sendPaginated<T>(res: Response, items: T[], meta: PageMeta): Response {
  return res.status(200).json({ data: items, meta });
}
