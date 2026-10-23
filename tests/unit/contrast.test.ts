import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Reads src/styles/tokens.css (the single source of truth) and checks WCAG
 * 2.2 contrast for every semantic pairing the components rely on.
 */
const css = readFileSync(path.resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8');

function block(selectorPattern: RegExp): Record<string, string> {
  const match = selectorPattern.exec(css);
  if (!match) throw new Error(`Block not found: ${selectorPattern}`);
  const start = css.indexOf('{', match.index + match[0].length - 1);
  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  const body = css.slice(start + 1, end);
  const vars: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
    vars[name!] = value!.trim();
  return vars;
}

const light = block(/:root,\s*\[data-theme='light'\]\s*\{/);
const darkMedia = block(/:root:not\(\[data-theme='light'\]\)\s*\{/);
const darkAttr = block(/\n\[data-theme='dark'\]\s*\{/);
const dark = { ...light, ...darkAttr };

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = 4.5; // WCAG 1.4.3 normal text
const NON_TEXT = 3; // WCAG 1.4.11 UI components / placeholders

const PAIRS: [fg: string, bg: string, min: number][] = [
  ['--text-primary', '--background', TEXT],
  ['--text-primary', '--surface', TEXT],
  ['--text-primary', '--surface-secondary', TEXT],
  ['--text-secondary', '--background', TEXT],
  ['--text-secondary', '--surface', TEXT],
  ['--text-secondary', '--surface-secondary', TEXT],
  ['--accent', '--background', TEXT],
  ['--accent', '--surface', TEXT],
  ['--accent', '--surface-secondary', TEXT],
  ['--accent', '--accent-soft', TEXT],
  ['--on-accent', '--accent-strong', TEXT],
  ['--danger', '--background', TEXT],
  ['--danger', '--surface', TEXT],
  ['--success', '--background', TEXT],
  ['--success', '--surface', TEXT],
  ['--text-tertiary', '--surface', NON_TEXT],
  ['--border-control', '--surface', NON_TEXT],
  ['--focus-ring', '--background', NON_TEXT],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, theme) => {
  it.each(PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    const a = theme[fg];
    const b = theme[bg];
    expect(a, fg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(b, bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrast(a!, b!)).toBeGreaterThanOrEqual(min);
  });
});

describe('token file integrity', () => {
  it('declares identical dark values for the media query and data-theme="dark"', () => {
    expect(darkMedia).toEqual(darkAttr);
  });

  it('keeps the approved brand palette unchanged', () => {
    expect(light['--brand-violet']).toBe('#735bff');
    expect(light['--brand-blue']).toBe('#458aff');
    expect(light['--brand-pink']).toBe('#f04bba');
    expect(light['--brand-coral']).toBe('#ff9673');
    expect(light['--background']).toBe('#f8f9ff');
    expect(dark['--background']).toBe('#0b1025');
  });

  it('defines the brand geometry scale', () => {
    const root = block(/\/\* Geometry, type and spacing[^]*?:root\s*\{/);
    expect([root['--shape-surface'], root['--shape-container'], root['--shape-control']]).toEqual([
      '24px',
      '16px',
      '12px',
    ]);
    expect(root['--gutter']).toBe('20px');
  });
});
