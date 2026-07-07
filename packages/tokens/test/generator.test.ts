import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/default-config.js';
import { resolveConfig } from '../src/config/merge.js';
import { pxToRem } from '../src/domain/format.js';
import { generate, generateFromOverride } from '../src/generate/index.js';

describe('generator — single source, three outputs, no divergence', () => {
  it('is idempotent: same config produces byte-identical artifacts', () => {
    const a = generate(defaultConfig);
    const b = generate(defaultConfig);
    expect(a.css).toBe(b.css);
    expect(a.dtcg).toBe(b.dtcg);
    expect(a.ts).toBe(b.ts);
  });

  it('produces all three artifacts and they are non-empty', () => {
    const { css, dtcg, ts } = generate(defaultConfig);
    expect(css).toContain(':root {');
    expect(css).toContain('--lab-space-0: 0rem;');
    expect(ts).toContain('export const space');
    expect(() => JSON.parse(dtcg)).not.toThrow();
  });

  it('every CSS custom property uses the --lab- prefix', () => {
    const { css } = generate(defaultConfig);
    const decls = css.match(/^\s*--[\w-]+:/gm) ?? [];
    expect(decls.length).toBeGreaterThan(0);
    for (const d of decls) {
      expect(d.trim().startsWith('--lab-')).toBe(true);
    }
  });

  it('a config change (ratio) flows into ALL THREE outputs', () => {
    const base = generate(defaultConfig);
    const changed = generateFromOverride({ typography: { ratioMax: 1.5 } });
    expect(changed.css).not.toBe(base.css);
    expect(changed.dtcg).not.toBe(base.dtcg);
    // The 6xl ceiling must differ in both the CSS clamp and the DTCG value.
    expect(changed.css).not.toContain('clamp(3.5832rem, 5.912vw + 2.4008rem, 6.9826rem)');
    const baseDoc = JSON.parse(base.dtcg);
    const changedDoc = JSON.parse(changed.dtcg);
    expect(changedDoc['font-size']['6xl'].$value.value).not.toBe(
      baseDoc['font-size']['6xl'].$value.value,
    );
  });

  it('emits the font-weight scale into all three artifacts, overridable per client', () => {
    const { css, ts, dtcg } = generate(defaultConfig);
    // CSS: a real custom property, unitless number value (value-preserving 600).
    expect(css).toContain('--lab-font-weight-regular: 400;');
    expect(css).toContain('--lab-font-weight-semibold: 600;');
    // TS: a typed const referencing the live var (so :root overrides reach consumers).
    expect(ts).toContain('export const fontWeight');
    expect(ts).toContain("semibold: 'var(--lab-font-weight-semibold)'");
    // DTCG: a number group.
    const doc = JSON.parse(dtcg);
    expect(doc['font-weight'].semibold.$value).toBe(600);
    expect(doc['font-weight'].semibold.$type).toBe('number');
    // Overridable like every other scale — a client re-weights without editing source.
    const changed = generateFromOverride({ typography: { weights: { semibold: 650 } } });
    expect(changed.css).toContain('--lab-font-weight-semibold: 650;');
    // A PARTIAL weights override must merge key-by-key (like steps/aliases/stepLabels),
    // NOT replace the whole record — the other roles must survive, or a client that
    // retunes one weight silently loses the rest.
    expect(changed.css).toContain('--lab-font-weight-regular: 400;');
    expect(changed.css).toContain('--lab-font-weight-medium: 500;');
    expect(changed.css).toContain('--lab-font-weight-bold: 700;');
  });

  it('emits the stroke + focus-ring scales, overridable and key-merged', () => {
    const { css, ts, dtcg } = generate(defaultConfig);
    // Stroke widths (Figma-grounded: hairline 1px universal border, thick 2px).
    expect(css).toContain('--lab-stroke-hairline: 0.0625rem;');
    expect(css).toContain('--lab-stroke-thick: 0.125rem;');
    // The fabricated 1.5px `control` stroke was removed (Figma checkbox/radio = 1px).
    expect(css).not.toContain('--lab-stroke-control');
    // Focus ring is its own axis (width + offset).
    expect(css).toContain('--lab-focus-ring-width: 0.125rem;');
    expect(css).toContain('--lab-focus-ring-offset: 0.125rem;');
    // TS consts reference the live vars.
    expect(ts).toContain("hairline: 'var(--lab-stroke-hairline)'");
    expect(ts).toContain("width: 'var(--lab-focus-ring-width)'");
    // DTCG dimension groups carry the canonical px.
    const doc = JSON.parse(dtcg);
    expect(doc.stroke.hairline.$value).toEqual({ value: 1, unit: 'px' });
    expect(doc['focus-ring'].width.$value).toEqual({ value: 2, unit: 'px' });
    // Partial override must key-merge (retune one stroke, keep the rest).
    const changed = generateFromOverride({ borders: { widths: { thick: 0.1875 } } });
    expect(changed.css).toContain('--lab-stroke-thick: 0.1875rem;');
    expect(changed.css).toContain('--lab-stroke-hairline: 0.0625rem;');
  });

  it('DTCG is well-formed: every leaf has $type and $value', () => {
    const doc = JSON.parse(generate(defaultConfig).dtcg);
    const leaves: Array<Record<string, unknown>> = [];
    const walk = (node: Record<string, unknown>) => {
      for (const v of Object.values(node)) {
        if (v && typeof v === 'object') {
          if ('$value' in (v as object)) leaves.push(v as Record<string, unknown>);
          else walk(v as Record<string, unknown>);
        }
      }
    };
    walk(doc);
    expect(leaves.length).toBeGreaterThan(40);
    for (const leaf of leaves) {
      expect(leaf.$type).toBeDefined();
      expect(leaf.$value).toBeDefined();
    }
  });

  it('TS token names match the CSS custom-property names exactly', () => {
    const { css, ts } = generate(defaultConfig);
    // Pull a sampling of var names from TS and assert they exist in CSS.
    const tsVars = [...ts.matchAll(/var\((--lab-[\w-]+)\)/g)].map((m) => m[1]);
    expect(tsVars.length).toBeGreaterThan(0);
    for (const v of new Set(tsVars)) {
      expect(css).toContain(`${v}:`);
    }
  });
});

describe('guards — invalid input fails loudly before corrupting artifacts', () => {
  it('a token name that would break a CSS custom property throws, naming the offender', () => {
    expect(() => generateFromOverride({ spacing: { steps: { 'foo bar': 5 } } })).toThrow(/foo bar/);
    expect(() => generateFromOverride({ zIndex: { levels: ['body/s'] } })).toThrow(/body\/s/);
  });

  it('pxToRem rejects a zero/non-finite base instead of emitting Infinity/NaN', () => {
    expect(() => pxToRem(16, 0)).toThrow(RangeError);
    expect(() => pxToRem(16, Number.NaN)).toThrow(RangeError);
    expect(pxToRem(32)).toBe(2);
  });

  it('non-integer z-index config is rejected (the scale is an integer ladder)', () => {
    expect(() => generateFromOverride({ zIndex: { gap: 0.5 } })).toThrow(/integer/);
    expect(() => generateFromOverride({ zIndex: { startAt: 1.5 } })).toThrow(/integer/);
  });

  it('TS aliases reference their OWN custom property — the semantic layer survives', () => {
    const { ts } = generate(defaultConfig);
    // Overriding --lab-space-sm on :root must reach TS consumers of space.sm,
    // so the alias must NOT collapse to its primitive target var.
    expect(ts).toContain("sm: 'var(--lab-space-sm)'");
    expect(ts).toContain("card: 'var(--lab-radius-card)'");
    expect(ts).not.toContain("sm: 'var(--lab-space-2)'");
  });
});

describe('config merge — user override over defaults', () => {
  it('overrides only the set fields, keeping the rest of the section', () => {
    const merged = resolveConfig({ typography: { ratioMax: 1.4 } });
    expect(merged.typography.ratioMax).toBe(1.4);
    expect(merged.typography.ratioMin).toBe(defaultConfig.typography.ratioMin);
    expect(merged.typography.basePx).toBe(16);
  });

  it('merges step records key-by-key (add a step without redeclaring the scale)', () => {
    const merged = resolveConfig({ spacing: { steps: { '40': 40 } } });
    expect(merged.spacing.steps['40']).toBe(40);
    expect(merged.spacing.steps['4']).toBe(4); // default preserved
  });

  it('replaces order-sensitive arrays wholesale (z-index levels)', () => {
    const merged = resolveConfig({ zIndex: { levels: ['a', 'b', 'c'] } });
    expect(merged.zIndex.levels).toEqual(['a', 'b', 'c']);
    expect(merged.zIndex.gap).toBe(defaultConfig.zIndex.gap); // scalar default kept
  });

  it('an empty override yields the default config unchanged', () => {
    expect(resolveConfig()).toEqual(defaultConfig);
  });
});

describe('typography — семейство шрифта и OpenType-фичи (Geist)', () => {
  it('эмитит --lab-font-family (sans, Geist первым) и --lab-font-family-mono во все три артефакта', () => {
    const { css, ts, dtcg } = generate(defaultConfig);
    // CSS: фолбэк-стек, Geist первым; mono — с Geist Mono (в кавычках: пробел).
    expect(css).toMatch(/--lab-font-family:\s*Geist,/);
    expect(css).toMatch(/--lab-font-family-mono:\s*'Geist Mono',/);
    expect(css).toContain('sans-serif;'); // аварийный дженерик в хвосте sans
    expect(css).toContain('monospace;'); // аварийный дженерик в хвосте mono
    // TS: типизированные var-ссылки (живой CSS-var — источник истины).
    expect(ts).toContain('export const font');
    expect(ts).toContain("family: 'var(--lab-font-family)'");
    expect(ts).toContain("'family-mono': 'var(--lab-font-family-mono)'");
    // DTCG: тип fontFamily, значение — массив стека (Geist первым).
    const doc = JSON.parse(dtcg);
    expect(doc.font.family.$type).toBe('fontFamily');
    expect(doc.font.family.$value[0]).toBe('Geist');
    expect(doc.font['family-mono'].$value[0]).toBe('Geist Mono');
  });

  it('эмитит осмысленные OpenType-фичи (tnum/frac) — только реально существующие в Geist', () => {
    const { css, dtcg } = generate(defaultConfig);
    expect(css).toContain('--lab-font-feature-tabular: "tnum" 1;');
    expect(css).toContain('--lab-font-feature-fractions: "frac" 1;');
    // Выдуманных фич НЕТ (zero/calt/onum в Geist отсутствуют — были бы no-op).
    expect(css).not.toContain('"zero"');
    expect(css).not.toContain('"calt"');
    expect(css).not.toContain('"onum"');
    const doc = JSON.parse(dtcg);
    expect(doc.font['feature-tabular'].$value).toBe('"tnum" 1');
    expect(doc.font['feature-tabular'].$type).toBe('fontFeatureSettings');
  });

  it('семейство переопределяемо клиентом (ребренд — один оверрайд), фичи key-merge', () => {
    const changed = generateFromOverride({
      typography: {
        fontFamily: { sans: ['Brand', 'sans-serif'], mono: ['Brand Mono', 'monospace'] },
      },
    });
    expect(changed.css).toMatch(/--lab-font-family:\s*Brand, sans-serif;/);
    expect(changed.css).toMatch(/--lab-font-family-mono:\s*'Brand Mono', monospace;/);
    // fontFeatures — Record, key-merge: ретюн одной фичи не сносит остальные.
    const feat = generateFromOverride({
      typography: { fontFeatures: { tabular: '"tnum" 1, "cv01" 1' } },
    });
    expect(feat.css).toContain('--lab-font-feature-tabular: "tnum" 1, "cv01" 1;');
    expect(feat.css).toContain('--lab-font-feature-fractions: "frac" 1;');
  });
});
