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
 *   4. LENSED_CLASS живёт в области glass ПОСЛЕ glass/acrylic и ДО деградаций;
 *      рецепты и engine-held имеют специфичность 0-1-0, деградации — 0-2-0;
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

/** Средняя колонка специфичности для используемых здесь простых селекторов.
 * :where(:scope) не добавляет вес; обычный :scope добавил бы единицу. */
function classLevelSpecificity(selector: string): number {
  const contributing = selector.replace(/:where\([^()]*\)/g, '');
  const attrs = contributing.match(/\[[^\]]*\]/g)?.length ?? 0;
  const withoutAttrs = contributing.replace(/\[[^\]]*\]/g, '');
  const classes = withoutAttrs.match(/\.[\w-]+/g)?.length ?? 0;
  const pseudoClasses = withoutAttrs.match(/:[\w-]+/g)?.length ?? 0;
  return attrs + classes + pseudoClasses;
}

const lensedBlock = css.match(
  new RegExp(
    `@scope \\(\\[data-material="glass"\\]\\) to \\(\\[data-material\\]\\)\\s*\\{\\s*([^{}]*\\.${LENSED_CLASS}[^{}]*)\\{([^{}]*)\\}\\s*\\}`,
  ),
);

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
    expect(lensedBlock, 'material.css must carry the --lensed re-bind block').not.toBeNull();
    const radius = (lensedBlock as RegExpMatchArray)[2]?.match(/--_blur:\s*([^;]+);/)?.[1]?.trim();
    expect(radius).toBeTruthy();
    expect(engineSrc).toContain(`blur(var(--_blur, ${radius}))`);
  });
});

describe('--lensed cascade position (the comment claims, as assertions)', () => {
  const lensedIdx = css.indexOf(`.${LENSED_CLASS}`);
  const glassIdx = css.indexOf('@scope ([data-material="glass"]) to ([data-material])');
  const acrylicIdx = css.indexOf('@scope ([data-material="acrylic"]) to ([data-material])');
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

  it('рецепты и lensed имеют специфичность 0-1-0 внутри своих областей', () => {
    expect(lensedBlock, 'lensed ограничен областью glass').not.toBeNull();
    const lensedSelectors = lensedBlock?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(lensedSelectors).toEqual([`:where(:scope).${LENSED_CLASS}`, `.${LENSED_CLASS}`]);
    for (const selector of lensedSelectors) {
      expect(classLevelSpecificity(selector)).toBe(1);
    }
    for (const mode of ['glass', 'acrylic', 'solid']) {
      const recipe = css.match(
        new RegExp(
          `@scope \\(\\[data-material="${mode}"\\]\\) to \\(\\[data-material\\]\\)\\s*\\{\\s*([^{}]*)\\{`,
        ),
      );
      expect(recipe, `рецепт ${mode} ограничен ближайшей областью`).not.toBeNull();
      const selectors = recipe?.[1]?.split(',').map((s) => s.trim()) ?? [];
      expect(selectors).toEqual([':where(:scope).lab-material', '.lab-material']);
      for (const selector of selectors) {
        expect(classLevelSpecificity(selector)).toBe(1);
      }
    }
  });

  it('деградации сохраняют селекторы 0-2-0, сильнее рецептов и lensed', () => {
    const degradations = css.slice(firstDegradationIdx);
    for (const mode of ['glass', 'acrylic']) {
      for (const separator of [' ', '']) {
        const selector = `[data-material="${mode}"]${separator}.lab-material`;
        expect(degradations).toContain(selector);
        expect(classLevelSpecificity(selector)).toBe(2);
      }
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
