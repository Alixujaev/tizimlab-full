import type { RequestHandler } from 'express';
import { NotFoundError } from '../utils/errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Yo'l topilmadi: ${req.method} ${req.path}`));
};
