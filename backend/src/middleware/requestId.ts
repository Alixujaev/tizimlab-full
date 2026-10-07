import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'winston';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Har so'rovga ID beradi (proxy'dan kelgan `X-Request-Id` ishonchli formatda bo'lsa — o'shani) va yakunda loglaydi. */
export function requestId(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      // Body, query va sarlavhalar loglanmaydi — sirlar sizmasligi uchun
      logger.info('http', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(ms),
      });
    });
    next();
  };
}
