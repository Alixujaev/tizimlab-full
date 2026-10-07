import { describe, expect, it } from 'vitest';
import { REDACTED, redact } from '../src/utils/logger.js';
import { memoryLogger } from './helpers/app.js';

describe('logger redact', () => {
  it("sezgir kalitlar rekursiv yashiriladi, asl ob'ekt o'zgarmaydi", () => {
    const input = {
      user: 'ali',
      password: 'hunter2',
      nested: { accessToken: 'eyJ.x', headers: { Authorization: 'Bearer abc', cookie: 'rt=1' } },
      list: [{ refresh_token: 'r1' }, { ok: 1 }],
      JWT_ACCESS_SECRET: 'zzz',
    };
    const out = redact(input) as typeof input;
    expect(out.user).toBe('ali');
    expect(out.password).toBe(REDACTED);
    expect(out.nested.accessToken).toBe(REDACTED);
    expect(out.nested.headers.Authorization).toBe(REDACTED);
    expect(out.nested.headers.cookie).toBe(REDACTED);
    expect(out.list[0]?.refresh_token).toBe(REDACTED);
    expect(out.list[1]).toEqual({ ok: 1 });
    expect(out.JWT_ACCESS_SECRET).toBe(REDACTED);
    expect(input.password).toBe('hunter2');
  });

  it.each(['production', 'development'])('%s logida parol va token chiqmaydi', (nodeEnv) => {
    const { logger, sink } = memoryLogger(nodeEnv);
    logger.info('login urinish', {
      body: { email: 'a@b.uz', password: 'hunter2' },
      token: 'eyJhbGciOi',
      headers: { authorization: 'Bearer abc.def' },
    });
    const text = sink.text();
    expect(text).toContain('a@b.uz');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('eyJhbGciOi');
    expect(text).not.toContain('abc.def');
  });
});
