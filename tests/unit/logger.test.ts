import { describe, expect, it } from 'vitest';

import { createLogger, redact, REDACTED } from '@/lib/logging/logger';

describe('redact', () => {
  it('removes sensitive keys at any depth', () => {
    const output = redact({
      userId: 'u1',
      errorCode: 'graph.throttled',
      refreshToken: 'abc',
      nested: {
        authorization: 'Bearer x',
        subject: 'Salary review',
        body: '<p>hi</p>',
        email: 'a@b.co',
      },
    });
    expect(output).toEqual({
      userId: 'u1',
      errorCode: 'graph.throttled',
      refreshToken: REDACTED,
      nested: { authorization: REDACTED, subject: REDACTED, body: REDACTED, email: REDACTED },
    });
  });

  it('scrubs tokens, keys, connection strings and addresses inside free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlX3ZhbHVl';
    const text = redact(
      `failed with ${jwt} Bearer abc.def sb_secret_xyz postgresql://u:p@h/db for ana@example.com`,
    ) as string;
    expect(text).not.toContain(jwt);
    expect(text).not.toContain('abc.def');
    expect(text).not.toContain('sb_secret_xyz');
    expect(text).not.toContain('u:p@h');
    expect(text).not.toContain('ana@example.com');
  });

  it('reduces errors to name and redacted message', () => {
    expect(redact(new TypeError('token eyJaaaaaa.bbbbbbb.ccccccc'))).toEqual({
      name: 'TypeError',
      message: `token ${REDACTED}`,
    });
  });
});

describe('createLogger', () => {
  it('writes structured, redacted JSON lines and respects the level', () => {
    const lines: string[] = [];
    const log = createLogger((_level, line) => lines.push(line), 'info');
    log.debug('ignored');
    log.info('auth.sign_in', { userId: 'u1', password: 'hunter2' });
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry).toMatchObject({
      level: 'info',
      event: 'auth.sign_in',
      userId: 'u1',
      password: REDACTED,
    });
    expect(lines[0]).not.toContain('hunter2');
  });
});
