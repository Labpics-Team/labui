import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOOP_ALLOWLIST,
  motionSurfaceFiles,
  scanMotionSource,
  scanMotionSurface,
} from './no-magic-motion.js';
import { repoRoot } from './no-literal-colour-fallback.js';

/**
 * CI-гард no-magic-motion (wiring #125). Утверждает чистоту живого дерева И
 * доказывает, что сканер ловит каждый класс нарушений (зелёный прогон значит
 * «чисто», никогда «слепо») — та же структура, что у размерного и цветовых
 * гардов по соседству.
 */
describe('no magic motion in component styles (motion contract)', () => {
  // ── (1) Живое дерево: ноль временных литералов вне закона.
  it('the whole motion surface is clean (transitions on tokens, loops pinned)', () => {
    const violations = scanMotionSurface();
    const report = violations
      .map((v) => `  ${v.file}:${v.line} [${v.rule}] ${v.token} — ${v.detail}`)
      .join('\n');
    expect(
      violations,
      `motion-contract violations (consume var(--lab-motion-…) or pin the loop):\n${report}`,
    ).toEqual([]);
  });

  it('the surface covers both stacks and skips tests', () => {
    const surface = motionSurfaceFiles();
    expect(surface).toContain('packages/react/src/switch.css');
    expect(surface).toContain('packages/core/src/components/switch/lab-switch.ts');
    expect(surface.some((f) => f.endsWith('.test.ts'))).toBe(false);
  });

  it('every LOOP_ALLOWLIST path is on the scanned surface (a stale pin is a silent hole)', () => {
    const surface = new Set(motionSurfaceFiles());
    expect(Object.keys(LOOP_ALLOWLIST).filter((f) => !surface.has(f))).toEqual([]);
  });

  // ── (2) Доказательства детекции — каждый класс нарушений даёт находку.
  it('DETECTS the pre-wiring literal pair (the exact form #125 migrated away)', () => {
    expect(
      scanMotionSource('p.css', '.x { transition: background-color 120ms ease; }'),
    ).toMatchObject([{ rule: 'magic-transition', token: '120ms' }]);
  });

  it('DETECTS a bare transition-duration / -delay literal', () => {
    const hits = scanMotionSource(
      'p.css',
      '.x { transition-duration: 150ms; transition-delay: 0.2s; }',
    );
    expect(hits.map((v) => v.token)).toEqual(['150ms', '0.2s']);
  });

  it('DETECTS an unpinned animation loop, even at an allowlisted value', () => {
    // 0.7s легитимен ТОЛЬКО в файлах, где петля пришпилена, — не глобально.
    expect(scanMotionSource('p.css', '.x { animation: spin 0.7s linear infinite; }')).toMatchObject(
      [{ rule: 'magic-animation', token: '0.7s' }],
    );
  });

  it('DETECTS a literal fallback on a motion token (reduced-motion resurrection)', () => {
    expect(
      scanMotionSource('p.css', '.x { transition: opacity var(--lab-motion-transition-duration, 120ms); }'),
    ).toMatchObject([{ rule: 'motion-fallback' }]);
  });

  // ── (3) Негативные доказательства — контрактные формы никогда не флагаются.
  it('IGNORES token-composed transitions, `none` and zero stilling', () => {
    const ok = [
      '.x { transition: color var(--lab-motion-transition-duration) var(--lab-motion-transition-easing); }',
      '.y { transition: none; }',
      '.z { animation-duration: 0s; }',
      '.w { animation: none; }',
    ].join('\n');
    expect(scanMotionSource('p.css', ok)).toEqual([]);
  });

  it('IGNORES a pinned loop in its own file but not elsewhere', () => {
    const loop = '.s { animation: lab-loader-spin 0.7s linear infinite; }';
    expect(scanMotionSource('packages/react/src/loader.css', loop)).toEqual([]);
    expect(scanMotionSource('packages/react/src/badge.css', loop)).toMatchObject([
      { rule: 'magic-animation' },
    ]);
  });

  it('IGNORES durations in prose (comments are stripped, offsets preserved)', () => {
    const prose = '/* the old 120ms ease grid */\n.x { transition: none; } // was 160ms ease';
    expect(scanMotionSource('p.ts', prose)).toEqual([]);
  });

  it('IGNORES time-shaped tokens outside motion properties (grid answers to the size guard)', () => {
    expect(scanMotionSource('p.css', '.x { grid-template: "a" 120ms; }')).toEqual([]);
  });

  // ── (4) Замок на токен-слое: удаление 32 ручных reduced-motion-блоков
  // легально, ПОКА generated/motion.css перепривязывает роль transition в ноль
  // под prefers-reduced-motion. Этот якорь красный = блоки должны вернуться.
  it('generated motion.css rebinds the transition role to instant under reduced motion', () => {
    const css = readFileSync(
      resolve(repoRoot, 'packages/tokens/src/generated/motion.css'),
      'utf8',
    );
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain(
      '--lab-motion-transition-duration: var(--lab-motion-duration-instant)',
    );
    expect(css).toContain('--lab-motion-duration-instant: 0ms');
  });

  // ── (5) RED-proof (диверсия): до-wiring блок switch обязан упасть — зелёное
  // живое дерево выше означает «миграция состоялась», а не «сканер слеп».
  it('the pre-wiring switch block FAILS the guard (diversion)', () => {
    const preWiring = `
      .control { transition: background-color 140ms ease; }
      .thumb { transition: transform 140ms ease; }
      .icon { transition: opacity 140ms ease; }`;
    const hits = scanMotionSource('p.css', preWiring);
    expect(hits.map((v) => v.rule)).toEqual([
      'magic-transition',
      'magic-transition',
      'magic-transition',
    ]);
  });

  // ── (6) Живой кросс-чек: дыра reduced-motion в lab-card закрыта токеном, а
  // не вернувшимся ручным media-query (карточка была единственным компонентом
  // с transition без RM-блока — теперь RM владеет токен-слой).
  it('lab-card rides the transition role on both stacks, with no manual RM query', () => {
    const core = readFileSync(
      resolve(repoRoot, 'packages/core/src/components/card/lab-card.ts'),
      'utf8',
    );
    const react = readFileSync(resolve(repoRoot, 'packages/react/src/card.css'), 'utf8');
    for (const src of [core, react]) {
      expect(src).toContain('var(--lab-motion-transition-duration)');
      expect(src).not.toContain('prefers-reduced-motion');
    }
  });
});
