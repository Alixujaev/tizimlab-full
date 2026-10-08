import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

// Uzunliklar farqi ham sizmasligi uchun xeshlar solishtiriladi
const digest = (v: string) => createHash('sha256').update(v, 'utf8').digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** D-93 (Q-63): Swagger UI uchun HTTP Basic himoya (faqat development'da ulanadi). */
export function swaggerBasicAuth(credentials: { user: string; password: string }): RequestHandler {
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Basic\s+(\S+)$/i.exec(header);
    if (match) {
      const decoded = Buffer.from(match[1]!, 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      if (sep >= 0) {
        const userOk = safeEqual(decoded.slice(0, sep), credentials.user);
        const passOk = safeEqual(decoded.slice(sep + 1), credentials.password);
        if (userOk && passOk) return next();
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="TizimLab API docs", charset="UTF-8"');
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Swagger uchun login talab qilinadi',
        requestId: req.id,
      },
    });
  };
}
