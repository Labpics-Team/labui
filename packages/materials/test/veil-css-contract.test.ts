/*
 * Veil runtime ↔ material.css cross-file contract (lab-veil drift guards, the
 * same discipline as engine-css-contract.test.ts).
 *
 * The veil engine's DOM writes and the package stylesheet are TWO files
 * claiming ONE set of facts. Each claim below was, until this test, held only
 * by comments — now a rename/reorder in either file fails here instead of
 * silently un-syncing the cascade:
 *
 *   1. `[data-veil]` is an inert effect overlay in CSS (pointer-events: none)
 *      and the strips' containing block (position: relative);
 *   2. the strip class the runtime emits is the one material.css styles and
 *      hides in the degradation backstops;
 *   3. both honest-degradation backstops exist (reduced-transparency, no
 *      backdrop-filter) — mirroring the runtime's own gates, so "no
 *      transparency" holds on every path;
 *   4. the declarative token surface (`--lab-veil-*`) is exactly the
 *      documented set, and material.css never DECLARES those tokens (a
 *      `[data-veil]` declaration would shadow values inherited from an
 *      ancestor — JS-side defaults own them);
 *   5. the runtime scans `[data-veil]` with the same observer mechanics as
 *      `data-material`;
 *   6. the effect is the real cumulative construction — per-strip incremental
 *      backdrop-filter radii, never the "one blur + opacity mask" fake the
 *      prototype README forbids.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';
import { VEIL_STRIP_CLASS } from '../src/engine/veil';

const here = dirname(fileURLToPath(import.meta.url));
const css = readMaterialCss();
const veilSrc = readFileSync(join(here, '../src/engine/veil.ts'), 'utf8');
const runtimeSrc = readFileSync(join(here, '../src/engine/runtime.ts'), 'utf8');
const readme = readFileSync(join(here, '../README.md'), 'utf8');

/** Bodies of ALL at-rule blocks whose header matches (material degradations
 *  and veil backstops share headers — first-match extraction is not enough). */
function atRuleBodies(header: RegExp): string[] {
  const bodies: string[] = [];
  const re = new RegExp(
    header.source,
    header.flags.includes('g') ? header.flags : `${header.flags}g`,
  );
  for (const m of css.matchAll(re)) {
    let i = css.indexOf('{', m.index ?? 0);
    if (i < 0) continue;
    let depth = 0;
    const bodyStart = i + 1;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          bodies.push(css.slice(bodyStart, i));
          break;
        }
      }
    }
  }
  return bodies;
}

/** Body of the first plain rule for `selector`. */
function ruleBody(selector: string): string {
  const idx = css.indexOf(`${selector} {`);
  expect(idx, `material.css must carry a ${selector} block`).toBeGreaterThanOrEqual(0);
  const start = css.indexOf('{', idx) + 1;
  return css.slice(start, css.indexOf('}', start));
}

describe('[data-veil] base styling (CSS side of the runtime contract)', () => {
  it('is an inert effect overlay: never intercepts input meant for content underneath', () => {
    expect(ruleBody('[data-veil]')).toContain('pointer-events: none');
  });

  it('is the strips’ containing block (they are absolutely positioned children)', () => {
    expect(ruleBody('[data-veil]')).toContain('position: relative');
  });
});

describe('strip class (runtime emission ↔ stylesheet)', () => {
  it('the class the runtime emits is the one material.css styles', () => {
    expect(veilSrc).toContain(`VEIL_STRIP_CLASS = '${VEIL_STRIP_CLASS}'`);
    const body = ruleBody(`.${VEIL_STRIP_CLASS}`);
    expect(body).toContain('position: absolute');
    expect(body).toContain('pointer-events: none');
  });
});

describe('honest degradation backstops (CSS doubles the runtime gates)', () => {
  it('prefers-reduced-transparency hides the strips (runtime builds none; CSS is the backstop)', () => {
    const bodies = atRuleBodies(/@media \(prefers-reduced-transparency: reduce\)/);
    expect(bodies.length).toBeGreaterThanOrEqual(2); // material collapse + veil backstop
    expect(
      bodies.some((b) => b.includes(`.${VEIL_STRIP_CLASS}`) && b.includes('display: none')),
    ).toBe(true);
    // …and the runtime honours the same query itself (strips are never built).
    expect(veilSrc).toContain("matchMedia('(prefers-reduced-transparency: reduce)')");
  });

  it('no backdrop-filter support hides the strips (inert divs must not linger)', () => {
    const bodies = atRuleBodies(/@supports not \(\(backdrop-filter/);
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(
      bodies.some((b) => b.includes(`.${VEIL_STRIP_CLASS}`) && b.includes('display: none')),
    ).toBe(true);
    // …and the runtime probes the same support pair before building anything.
    expect(veilSrc).toContain("CSS.supports('backdrop-filter', 'blur(1px)')");
    expect(veilSrc).toContain("CSS.supports('-webkit-backdrop-filter', 'blur(1px)')");
  });
});

describe('declarative token surface (--lab-veil-*)', () => {
  const DOCUMENTED = [
    '--lab-veil-strength',
    '--lab-veil-stops',
    '--lab-veil-from',
    '--lab-veil-to',
    '--lab-veil-levels',
    '--lab-veil-feather',
  ];

  it('the tokens the runtime reads are exactly the documented set', () => {
    const reads = new Set(
      [...veilSrc.matchAll(/'(--lab-veil-[\w-]+)'/g)].map((m) => m[1] as string),
    );
    expect([...reads].sort()).toEqual([...DOCUMENTED].sort());
  });

  it('every token is documented in the package README', () => {
    for (const token of DOCUMENTED) {
      expect(readme, `README must document ${token}`).toContain(token);
    }
  });

  it('material.css never DECLARES a --lab-veil-* token (JS defaults own them — a [data-veil] declaration would shadow inherited values)', () => {
    expect(css).not.toMatch(/--lab-veil-[\w-]+\s*:/);
  });
});

describe('runtime integration (mountMaterialRuntime scans [data-veil])', () => {
  it('scans the attribute with the same observer mechanics as data-material', () => {
    expect(runtimeSrc).toContain("const VEIL = '[data-veil]'");
    expect(runtimeSrc).toContain("attributeFilter: ['data-material', 'class', 'data-veil']");
  });
});

describe('the construction is honest (prototype philosophy: no opacity-mask fake)', () => {
  it('strips carry REAL per-strip incremental backdrop-filter radii', () => {
    expect(veilSrc).toContain('√(L_k² − L_{k−1}²)');
    expect(veilSrc).toContain("setProperty('backdrop-filter', blur)");
    expect(veilSrc).toContain("setProperty('-webkit-backdrop-filter', blur)");
  });

  it('never fakes the ramp by fading strip opacity (mask-image only feathers seams)', () => {
    expect(veilSrc).not.toMatch(/style\.opacity/);
    expect(veilSrc).not.toMatch(/setProperty\('opacity'/);
  });
});
