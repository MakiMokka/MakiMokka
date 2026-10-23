import { describe, expect, it } from 'vitest';

import { interpolate, matchAcceptLanguage, resolveLocale } from '@/lib/i18n/config';
import { en } from '@/lib/i18n/dictionaries/en';
import { es } from '@/lib/i18n/dictionaries/es';
import { formatDateTime, isValidTimeZone } from '@/lib/i18n/format';

function leaves(value: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result.set(path, child);
    else for (const [k, v] of leaves(child, path)) result.set(k, v);
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  const english = leaves(en);
  const spanish = leaves(es);

  it('have identical keys', () => {
    expect([...spanish.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of [...english, ...spanish]) expect(value.trim(), key).not.toBe('');
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, value] of english)
      expect(placeholders(spanish.get(key)!), key).toEqual(placeholders(value));
  });

  it('are actually translated (spot check)', () => {
    expect(es.nav.inbox).not.toBe(en.nav.inbox);
    expect(es.settings.title).toBe('Ajustes');
  });
});

describe('locale resolution', () => {
  it('prefers profile, then cookie, then Accept-Language, then English', () => {
    expect(resolveLocale({ profileLocale: 'es', cookieLocale: 'en' })).toBe('es');
    expect(resolveLocale({ cookieLocale: 'es', acceptLanguage: 'en-US' })).toBe('es');
    expect(resolveLocale({ acceptLanguage: 'fr-FR, es-MX;q=0.8, en;q=0.5' })).toBe('es');
    expect(resolveLocale({ cookieLocale: 'de', acceptLanguage: 'de' })).toBe('en');
    expect(resolveLocale({})).toBe('en');
  });

  it('honours q-values and ignores q=0', () => {
    expect(matchAcceptLanguage('en;q=0.4, es;q=0.9')).toBe('es');
    expect(matchAcceptLanguage('es;q=0, en')).toBe('en');
    expect(matchAcceptLanguage('')).toBeNull();
  });

  it('interpolates named values and leaves unknown ones', () => {
    expect(interpolate('Version {version} {x}', { version: '0.1.0' })).toBe('Version 0.1.0 {x}');
  });
});

describe('formatting', () => {
  it('formats dates per locale and time zone', () => {
    const date = '2026-01-15T18:30:00Z';
    expect(formatDateTime(date, 'en', 'UTC')).toContain('Jan');
    expect(formatDateTime(date, 'es', 'America/Mexico_City')).toContain('ene');
    expect(formatDateTime(null, 'en')).toBe('');
    expect(formatDateTime('not a date', 'en')).toBe('');
  });

  it('validates time zones', () => {
    expect(isValidTimeZone('America/Mexico_City')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
