import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './no-literal-colour-fallback.js';
import {
  MIGRATED,
  canonicalTokens,
  fallbackMatchesCanon,
  fallbackSurfaceFiles,
  normalizeLit,
  scanDimensionSource,
  scanFallbackDrift,
  scanMigrated,
} from './no-magic-dimension.js';

/**
 * CI-гард no-magic-dimension (docs/dimension-contract.md) в скоупе списка
 * MIGRATED. Утверждает чистоту живого дерева И доказывает, что сканер ловит
 * каждый класс нарушений (зелёный прогон значит «чисто», никогда «слепо») —
 * та же структура, что у соседних цветовых гардов.
 */
describe('no magic dimensions in migrated components (dimension contract)', () => {
  const canon = canonicalTokens();

  it.each([
    'function stylesheet(p) { return `.x { border-radius: ${p.radius}px; }`; } stylesheet({radius: 77});',
    'function stylesheet(p) { return `.x { border-radius: ${rem(p.radius)}; }`; } stylesheet({radius: 77});',
    'const css = `.x { border-radius: ${p.radius * 0 + 77}px; }`;',
    'const css = `.x { border-radius: ${rem(p.radius * 0 + 77)}; }`;',
    'const css = `.x { border-radius: ${p.radius - p.radius + 77}px; }`;',
    'const css = `.x { border-radius: ${p.radius / p.radius * 77}px; }`;',
    'const css = `.x { border-radius: ${p.radius + 77}px; }`;',
    'const alias = p; alias.radius = 77; const css = `.x { border-radius: ${rem(p.radius)}; }`;',
    'const read = (o, unused = Object.assign(o, { radius: 77 })) => o.radius; read(p); const css = `.x { border-radius: ${rem(p.radius)}; }`;',
    '(p.radius as number) = 77; const css = `.x { border-radius: ${rem(p.radius)}; }`;',
    'p.radius! = 77; const css = `.x { border-radius: ${rem(p.radius)}; }`;',
  ])('does not confuse a profile name or cancelled term with authored geometry: %s', (source) => {
    const prefix =
      "import { tooltipProfile as p } from '@labpics/ui-tokens'; const rem = (n: number) => `${n / 16}rem`;";
    expect(
      scanDimensionSource('p.ts', prefix + source).some((hit) => hit.rule === 'magic-radius'),
    ).toBe(true);
  });

  it('accepts circular geometry and imported profile lengths, not disguised literals', () => {
    expect(scanDimensionSource('p.css', '.dot { border-radius: 50%; }')).toEqual([]);
    expect(scanDimensionSource('p.css', '.dot { border-radius: 48%; }')).toMatchObject([
      { rule: 'magic-radius' },
    ]);
    const prefix =
      "import { tooltipProfile as p } from '@labpics/ui-tokens'; const rem = (n: number) => `${n / 16}rem`;";
    expect(
      scanDimensionSource(
        'p.ts',
        `${prefix}const css = \`.x { border-radius: \${rem(p.radius)}; }\`;`,
      ),
    ).toEqual([]);
    expect(
      scanDimensionSource('p.ts', `${prefix}const css = \`.x { border-radius: \${rem(77)}; }\`;`),
    ).toMatchObject([{ rule: 'magic-radius' }]);
    expect(
      scanDimensionSource(
        'p.ts',
        'const p = { radius: 77 }; const rem = (n: number) => `${n / 16}rem`; const css = `.x { border-radius: ${rem(p.radius)}; }`;',
      ),
    ).toMatchObject([{ rule: 'magic-radius' }]);
  });

  // ── (1) Утверждение по живому дереву: мигрированные компоненты держат НОЛЬ нарушений.
  it('every MIGRATED component is clean (magic lengths / radii / drifted fallbacks)', () => {
    const violations = scanMigrated();
    const report = violations
      .map((v) => `  ${v.file}:${v.line} [${v.rule}] ${v.token} — ${v.detail}`)
      .join('\n');
    expect(
      violations,
      `dimension-contract violations (consume --lab-size-*/--lab-space-*/--lab-radius-* or the concentric calc):\n${report}`,
    ).toEqual([]);
  });

  // ── (1б) Fallback-drift — ГЛОБАЛЬНО (не по волнам): кеш канона обязан быть
  // честным в любом файле компонентов уже сегодня; найдено 85 протухших
  // фолбэков, писавшихся против старого канона токенов.
  it('every component file caches token fallbacks at canonical values (repo-wide)', () => {
    const violations = scanFallbackDrift();
    const report = violations
      .map((v) => `  ${v.file}:${v.line} ${v.token} — ${v.detail}`)
      .join('\n');
    expect(
      violations,
      `протухшие var()-фолбэки (обнови литерал до канона generated/tokens.css):\n${report}`,
    ).toEqual([]);
  });

  it('every MIGRATED path resolves to a real file (a stale list is a silent hole)', () => {
    const missing = Object.values(MIGRATED)
      .flat()
      .filter((rel) => !existsSync(resolve(repoRoot, rel)));
    expect(missing).toEqual([]);
  });

  // ── (2) Доказательства детекции — каждый класс нарушений даёт находку.
  it('DETECTS a bare length literal in a size knob (the pre-contract radio form)', () => {
    expect(scanDimensionSource('p.css', '.x { --_ring: 1.25rem; }', canon)).toMatchObject([
      { rule: 'magic-length', token: '1.25rem' },
    ]);
  });

  it('DETECTS a magic border-radius literal', () => {
    const hits = scanDimensionSource('p.css', '.x { border-radius: 0.375rem; }', canon);
    expect(hits.some((v) => v.rule === 'magic-radius')).toBe(true);
  });

  it('DETECTS a drifted var() fallback — the exact bug this guard was born from', () => {
    // radio-group кешировал --lab-space-md как 0.75rem при каноне 1rem
    // (найдено КРАСНЫМ этим гардом во время миграции, затем исправлено).
    expect(
      scanDimensionSource('p.css', '.x { gap: var(--lab-space-md, 0.75rem); }', canon),
    ).toMatchObject([{ rule: 'fallback-drift' }]);
  });

  it('DETECTS a literal fallback on a token that has no canon (unknown --lab-*)', () => {
    expect(
      scanDimensionSource('p.css', '.x { width: var(--lab-space-ghost, 1rem); }', canon),
    ).toMatchObject([{ rule: 'fallback-drift' }]);
  });

  it('runtime contour properties are not caches of generated dimension tokens', () => {
    expect(
      scanDimensionSource(
        'p.css',
        '.x { inset: var(--lab-contour-inset, 0px); clip-path: var(--lab-contour-clip, none); }',
        canon,
      ),
    ).toEqual([]);
    expect(
      scanDimensionSource('p.css', '.x { width: var(--lab-contour-typo, 1rem); }', canon),
    ).toMatchObject([{ rule: 'fallback-drift' }]);
  });

  it('DETECTS violations through the Lit litVar() form (normalizeLit)', () => {
    const lit = "a: ${litVar('--lab-space-md', '0.75rem')};";
    expect(normalizeLit(lit)).toBe('a: var(--lab-space-md, 0.75rem);');
    expect(scanDimensionSource('p.ts', lit, canon)).toMatchObject([{ rule: 'fallback-drift' }]);
  });

  // ── (3) Негативные доказательства — контрактные формы никогда не флагаются.
  it('IGNORES token-composed sizes, derived ratios and the concentric form', () => {
    const ok = [
      '.x { --_ring: var(--lab-size-control-m, 1rem); }',
      '.x { --_dot: calc(var(--_ring) / 2); }',
      '.x { border-radius: var(--lab-radius-circle, 9999px); }',
      '.x { border-radius: max(calc(var(--_radius) - var(--_pad)), var(--lab-radius-concentric-min, 0.125rem)); }',
      '.x { border-radius: inherit; } .y { border-radius: 0; }',
    ].join('\n');
    expect(scanDimensionSource('p.css', ok, canon)).toEqual([]);
  });

  it('IGNORES §4 hairline px literals (0 / ±1px / ±2px) but flags 3px', () => {
    expect(
      scanDimensionSource(
        'p.css',
        '.x { width: 1px; height: 1px; margin: -1px; top: 2px; }',
        canon,
      ),
    ).toEqual([]);
    expect(scanDimensionSource('p.css', '.x { width: 3px; }', canon)).toMatchObject([
      { rule: 'magic-length', token: '3px' },
    ]);
  });

  it('IGNORES in-range fallbacks of fluid clamp() tokens and exact scalar caches', () => {
    expect(fallbackMatchesCanon('0.8333rem', canon.get('--lab-font-size-xs') as string)).toBe(true);
    expect(fallbackMatchesCanon('1.2rem', canon.get('--lab-font-size-lg') as string)).toBe(true);
    expect(fallbackMatchesCanon('2rem', canon.get('--lab-font-size-lg') as string)).toBe(false);
    expect(fallbackMatchesCanon('0.5rem', canon.get('--lab-space-sm') as string)).toBe(true);
    expect(fallbackMatchesCanon('8px', canon.get('--lab-space-sm') as string)).toBe(true);
  });

  it('IGNORES a nested var() fallback (a token reference is not a literal cache)', () => {
    expect(
      scanDimensionSource(
        'p.css',
        '.x { border-radius: var(--lab-radius-control, var(--lab-radius-m)); }',
        canon,
      ),
    ).toEqual([]);
  });

  it('the fallback-drift surface covers React .tsx carriers (proof.tsx)', () => {
    const surface = fallbackSurfaceFiles();
    expect(surface).toContain('packages/react/src/proof.tsx');
    expect(surface.some((f) => f.endsWith('.test.ts'))).toBe(false);
  });

  it('IGNORES unitless numbers, durations and percentages (not fixed lengths)', () => {
    expect(
      scanDimensionSource(
        'p.css',
        '.x { opacity: 0.45; transition: all 120ms ease; flex: 1 0 100%; clip-path: inset(50%); }',
        canon,
      ),
    ).toEqual([]);
  });

  // ── (4) Санити канон-таблицы — SSOT-артефакт разрешает цепочки алиасов.
  it('canonicalTokens resolves alias chains to final values', () => {
    expect(canon.get('--lab-space-md')).toBe('1rem'); // md -> space-4 -> 1rem
    expect(canon.get('--lab-radius-circle')).toBe('9999px'); // circle -> full -> 9999px
    expect(canon.get('--lab-radius-concentric-min')).toBe('0.125rem'); // -> xs
    expect(canon.get('--lab-size-control-s')).toBe('0.75rem');
  });

  // ── (5) Доказательство скоупа — гард правит ТОЛЬКО списком мигрированных;
  // немигрированный компонент с легаси-литералами здесь покраснеть не может.
  it('follows migrated component imports including shared styles without obsolete twin paths', () => {
    const governed = Object.values(MIGRATED).flat();
    // Честный скоуп (аудит 2026-07-09): мигрированы 22 компонента;
    // menu / select / pagination НЕ мигрированы — гард их не трогает.
    expect(governed).not.toContain('packages/core/src/components/menu/lab-menu.ts');
    expect(MIGRATED.card).toContain('packages/core/src/components/card/styles.ts');
    expect(MIGRATED.input).toContain('packages/core/src/components/input/styles.ts');
    expect(MIGRATED.input).toContain('packages/core/src/components/field/outlined-styles.ts');
    expect(MIGRATED.textarea).toContain('packages/core/src/components/field/outlined-styles.ts');
    expect(MIGRATED['radio-group']).toContain('packages/core/src/components/selection/styles.ts');
    expect(governed).not.toContain('packages/react/src/radio-group.css');
    expect(governed).not.toContain('packages/react/src/card.css');
  });

  // ── (6) RED-proof (диверсия): прогон сканера по ДО-миграционному блоку
  // размеров radio-group обязан упасть — зелёное живое дерево выше означает
  // «миграция состоялась», а не «сканер слеп».
  it('the pre-migration radio-group size block FAILS the guard (diversion)', () => {
    const preMigration = `
      :host {
        --_ring: 1.25rem;
        --_dot: 0.625rem;
        --_list-gap: \${litVar('--lab-space-md', '0.75rem')};
      }`;
    const hits = scanDimensionSource('p.ts', preMigration, canon);
    expect(hits.map((v) => v.rule).sort()).toEqual([
      'fallback-drift',
      'magic-length',
      'magic-length',
    ]);
  });
});
