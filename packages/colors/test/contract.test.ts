import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * roles.json задаёт публичные имена, contract.css объявляет их в каждой теме.
 * Этот гейт удерживает состав и форму контракта; авторские значения независимо
 * проверяются в golden-parity.test.mjs.
 */

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const css = readFileSync(resolve(pkgRoot, 'contract.css'), 'utf8');
const roles = JSON.parse(readFileSync(resolve(pkgRoot, 'roles.json'), 'utf8')) as {
  groups: Record<string, string[]>;
  aliases: string[];
};

const allRoles = Object.values(roles.groups).flat();

/** Extract the body of a top-level CSS scope by its selector header. */
function scopeBody(source: string, selectorPrefix: string): string {
  const start = source.indexOf(selectorPrefix);
  if (start === -1) throw new Error(`scope not found: ${selectorPrefix}`);
  const open = source.indexOf('{', start);
  // Balance braces to capture the full block (handles the nested @media wrapper).
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces for: ${selectorPrefix}`);
}

const lightBody = scopeBody(css, ':root,\n[data-theme="light"]');
const darkBody = scopeBody(css, '[data-theme="dark"]');
const mediaBody = scopeBody(css, '@media (prefers-color-scheme: dark)');

function declares(body: string, role: string): boolean {
  // Match `<role>:` at a declaration position (start or after `{`/`;`/whitespace).
  const re = new RegExp(`(^|[;{\\s])${role.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*:`, 'm');
  return re.test(body);
}

describe('--lab-* semantic color contract', () => {
  it('declares every contracted role in the light scope (:root)', () => {
    const missing = allRoles.filter((r) => !declares(lightBody, r));
    expect(missing, `missing in light scope: ${missing.join(', ')}`).toEqual([]);
  });

  it('declares every contracted role in the [data-theme="dark"] scope', () => {
    const missing = allRoles.filter((r) => !declares(darkBody, r));
    expect(missing, `missing in dark scope: ${missing.join(', ')}`).toEqual([]);
  });

  it('declares every contracted role in the prefers-color-scheme:dark fallback', () => {
    const missing = allRoles.filter((r) => !declares(mediaBody, r));
    expect(missing, `missing in media fallback: ${missing.join(', ')}`).toEqual([]);
  });

  it('carries no legacy back-compat aliases — consumers read only canonical roles', () => {
    // The original 5-var bridge aliases (--lab-surface-base/-raised, --lab-accent)
    // were retired once every consumer moved to the systematic --lab-bg-*/--lab-label-*
    // roles the published @labpics/colors engine emits. Guard against reintroduction so
    // the generated contract stays compatible (a bridge-only alias would silently vanish).
    expect(roles.aliases, 'roles.json must declare no aliases').toEqual([]);
    const LEGACY = ['--lab-surface-base', '--lab-surface-raised', '--lab-accent'];
    const resurrected = LEGACY.filter((r) => declares(lightBody, r));
    expect(
      resurrected,
      `legacy alias re-declared in contract.css: ${resurrected.join(', ')}`,
    ).toEqual([]);
  });

  it('exposes the expected per-group role counts', () => {
    const counts = Object.fromEntries(
      Object.entries(roles.groups).map(([g, list]) => [g, list.length]),
    );
    expect(counts).toEqual({
      Backgrounds: 26,
      Labels: 36,
      Fills: 33,
      Border: 26,
      FX: 12,
      Misc: 3,
      Component: 27,
    });
  });

  it('declares the derived component roles consumed by Button/proof in every scope', () => {
    // These are NOT in the faithful Figma taxonomy — they are derived component
    // roles (solid fills, on-fill contrast, focus ring). Assert them by name so a
    // regression that drops the reconciliation set fails CI loudly.
    const derived = roles.groups.Component ?? [];
    expect(derived.length, 'Component group must be present in roles.json').toBe(27);
    for (const [scopeName, body] of [
      ['light', lightBody],
      ['dark', darkBody],
      ['media', mediaBody],
    ] as const) {
      const missing = derived.filter((r) => !declares(body, r));
      expect(missing, `derived roles missing in ${scopeName} scope: ${missing.join(', ')}`).toEqual(
        [],
      );
    }
  });

  it('has no unresolved reference or placeholder markers left in the contract', () => {
    expect(css).not.toMatch(/unresolved|undefined|NaN|\{[A-Za-z]/);
  });

  it('resolves every declared --lab-* value to a concrete color or var() reference', () => {
    // Каждая публичная роль содержит цвет или ссылку на другую роль.
    const decls = [...css.matchAll(/(--lab-[a-z0-9-]+)\s*:\s*([^;]+);/g)];
    expect(decls.length).toBeGreaterThan(0);
    const bad = decls
      .map((m) => ({ name: m[1] ?? '', value: (m[2] ?? '').trim() }))
      .filter(
        ({ value }) => !/^(oklch\(|rgb\(|rgba\(|#[0-9a-fA-F]{3,8}\b|var\(--lab-)/.test(value),
      );
    expect(bad, `non-color values: ${bad.map((b) => `${b.name}=${b.value}`).join(', ')}`).toEqual(
      [],
    );
  });
});
