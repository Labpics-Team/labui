/*
 * Engine ↔ material.css cross-file contract (ADR-0003 ch-02 drift guards).
 *
 * The engine's inline backdrop stack and the package stylesheet are TWO files
 * claiming ONE set of facts. Each claim below was, until this test, held only
 * by comments — now a rename/reorder in either file fails here instead of
 * silently un-syncing the cascade:
 *
 *   1. every custom property the engine references (var() in the inline stack,
 *      getPropertyValue() reads) is actually DECLARED in material.css;
 *   2. the CSS engine-knob defaults equal the engine's DEFAULTS (the numbers
 *      must agree, or a knob-less surface renders differently depending on
 *      whether getComputedStyle managed to resolve the token);
 *   3. the engine's var() fallbacks for brightness/contrast equal the CSS
 *      defaults, and the blur fallback equals the `--lensed` re-bind radius;
 *   4. LENSED_CLASS exists in CSS, its block sits AFTER the glass/blur mode
 *      blocks (later order wins at equal specificity) and BEFORE the first
 *      degradation (degradations still win), and its selectors carry exactly
 *      the mode blocks' 0-2-0 class-level specificity;
 *   5. the runtime is an inert no-op without a DOM (SSR safety).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';
import { LENSED_CLASS } from '../src/engine/liquid-glass';
import { mountMaterialRuntime } from '../src/engine/runtime';

const here = dirname(fileURLToPath(import.meta.url));
const css = readMaterialCss();
const engineSrc = readFileSync(join(here, '../src/engine/liquid-glass.ts'), 'utf8');

/** Class-level specificity bucket (the middle number of a-b-c): attribute
 *  selectors and classes both count here; ids/elements are absent by design. */
function classLevelSpecificity(selector: string): number {
  const attrs = selector.match(/\[[^\]]*\]/g)?.length ?? 0;
  const classes = selector.replace(/\[[^\]]*\]/g, '').match(/\.[\w-]+/g)?.length ?? 0;
  return attrs + classes;
}

describe('token references resolve (engine → CSS)', () => {
  const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

  it('every var(--…) the engine emits inline is declared in material.css', () => {
    const referenced = [...engineSrc.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string);
    expect(referenced.length).toBeGreaterThan(0);
    for (const token of referenced) {
      expect(declared, `engine references ${token} but material.css never declares it`).toContain(
        token,
      );
    }
  });

  it('every custom property the engine READS is declared in material.css', () => {
    const reads = [...engineSrc.matchAll(/'(--_lg-[\w-]+)'/g)].map((m) => m[1] as string);
    expect(reads).toEqual(
      expect.arrayContaining(['--_lg-refraction', '--_lg-depth', '--_lg-dispersion']),
    );
    for (const token of reads) {
      expect(declared, `engine reads ${token} but material.css never declares it`).toContain(token);
    }
  });
});

describe('numeric defaults agree (CSS knobs ↔ engine DEFAULTS ↔ var() fallbacks)', () => {
  const cssKnob = (name: string): string => {
    const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
    expect(m, `material.css must declare ${name}`).not.toBeNull();
    return (m as RegExpMatchArray)[1]?.trim() as string;
  };
  const defaultsBlock = engineSrc.match(/const DEFAULTS = \{[\s\S]*?\n\};/)?.[0];
  const engineDefault = (key: string): string => {
    const m = (defaultsBlock ?? '').match(new RegExp(`${key}:\\s*([\\d.]+)`));
    expect(m, `engine DEFAULTS must carry ${key}`).not.toBeNull();
    return (m as RegExpMatchArray)[1] as string;
  };

  it('knob defaults: CSS values equal engine DEFAULTS', () => {
    expect(Number(cssKnob('--_lg-refraction'))).toBe(Number(engineDefault('refraction')));
    expect(Number(cssKnob('--_lg-depth'))).toBe(Number(engineDefault('depth')));
    expect(Number(cssKnob('--_lg-dispersion'))).toBe(Number(engineDefault('dispersion')));
  });

  it('inline-stack var() fallbacks equal the CSS defaults they shadow', () => {
    const brightness = cssKnob('--_lg-brightness');
    const contrast = cssKnob('--_lg-contrast');
    expect(engineSrc).toContain(`brightness(var(--_lg-brightness, ${brightness}))`);
    expect(engineSrc).toContain(`contrast(var(--_lg-contrast, ${contrast}))`);
  });

  it('blur fallback equals the --lensed re-bind radius (one lens calibration)', () => {
    const lensedBlock = css.match(
      new RegExp(`\\[data-material\\][^{]*${LENSED_CLASS}[^{]*\\{([^}]*)\\}`),
    );
    expect(lensedBlock, 'material.css must carry the --lensed re-bind block').not.toBeNull();
    const radius = (lensedBlock as RegExpMatchArray)[1]
      ?.match(/--_blur:\s*var\(--_lab-normal,\s*([^)]*)\)/)?.[1]
      ?.trim();
    expect(radius).toBeTruthy();
    expect(engineSrc).toContain(`blur(var(--_blur, ${radius}))`);
  });
});

describe('--lensed cascade position (the comment claims, as assertions)', () => {
  const lensedIdx = css.indexOf(`.${LENSED_CLASS}`);
  const glassIdx = css.indexOf('[data-material="glass"] .lab-material');
  const acrylicIdx = css.indexOf('[data-material="acrylic"] .lab-material');
  const firstDegradationIdx = css.indexOf('@supports not');

  it('the lensed block exists and sits after the glass and acrylic mode blocks', () => {
    expect(lensedIdx).toBeGreaterThan(-1);
    expect(glassIdx).toBeGreaterThan(-1);
    expect(acrylicIdx).toBeGreaterThan(-1);
    expect(lensedIdx).toBeGreaterThan(glassIdx);
    expect(lensedIdx).toBeGreaterThan(acrylicIdx);
  });

  it('…and before the first degradation, so degradations still win', () => {
    expect(firstDegradationIdx).toBeGreaterThan(-1);
    expect(lensedIdx).toBeLessThan(firstDegradationIdx);
  });

  it('lensed selectors carry exactly the mode blocks’ 0-2-0 specificity', () => {
    const lensedSelectors = [`[data-material] .${LENSED_CLASS}`, `[data-material].${LENSED_CLASS}`];
    for (const sel of lensedSelectors) {
      expect(css, `expected selector ${sel}`).toContain(sel);
      expect(classLevelSpecificity(sel)).toBe(
        classLevelSpecificity('[data-material="glass"] .lab-material'),
      );
    }
  });
});

describe('runtime without a DOM (SSR safety)', () => {
  it('mounts as an inert no-op and disposes without throwing', () => {
    expect(typeof document).toBe('undefined'); // this suite runs in node
    const dispose = mountMaterialRuntime();
    expect(typeof dispose).toBe('function');
    expect(() => dispose()).not.toThrow();
    expect(() => dispose()).not.toThrow(); // double-dispose is safe too
  });
});
