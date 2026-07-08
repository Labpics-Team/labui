import { describe, expect, it } from 'vitest';
import { type Violation, scanAll, scanSource, targetFiles } from './no-literal-colour-fallback.js';

/**
 * CI recurrence guard for the colour-role-literal-fallback class (closed #23/#24,
 * reintroduced #31). The design-system surface must NEVER bake a literal colour as the
 * fallback of a COLOUR / FX role token. This suite both:
 *   1. asserts ZERO violations across the live tree (the guard that fails CI on
 *      regression), and
 *   2. proves the scanner actually DETECTS each authored form and correctly IGNORES the
 *      allowed cases (dimension fallback, token → token fallback) — so a green run means
 *      "clean", never "blind".
 */
describe('no colour-role literal-colour fallback (recurrence guard)', () => {
  it('finds the component sources it is meant to govern', () => {
    const files = targetFiles();
    // The four sites the #31 audit fixed live in these files; the guard must see them.
    expect(files).toContain('packages/core/src/components/select/lab-select.ts');
    expect(files).toContain('packages/core/src/components/menu/lab-menu.ts');
    expect(files).toContain('packages/react/src/select.css');
    expect(files).toContain('packages/react/src/menu.css');
    expect(files.length).toBeGreaterThan(4);
  });

  // ── Glob scope: the React twins live in .tsx, which `packages/**​/*.ts` does NOT
  // match. The widened glob MUST pull at least one real .tsx into scope; this pins the
  // fix so a future revert to a `.ts`-only glob (silently un-scanning every cssVar(...)
  // inline-style in the React layer) fails CI here.
  it('scans React .tsx twins (glob covers .tsx, not just .ts)', () => {
    const files = targetFiles();
    expect(files).toContain('packages/react/src/select.tsx');
    expect(files.some((f) => f.endsWith('.tsx'))).toBe(true);
  });

  it('the live design system has ZERO colour-role literal-colour fallbacks', () => {
    const violations = scanAll();
    const report = violations
      .map((v: Violation) => `  ${v.file}:${v.line} → ${v.token}  ::  ${v.snippet}`)
      .join('\n');
    expect(
      violations,
      `colour-role tokens with a baked literal-colour fallback (drop the literal, keep the token):\n${report}`,
    ).toEqual([]);
  });

  // ── Detection proof: the scanner must FAIL on a planted violation ────────────────
  // This is the "plant a violation → guard fails → remove it" proof, encoded as a
  // permanent positive test so the detection can never silently rot.

  it('DETECTS the CSS form var(--lab-<colour-role>, <literal>)', () => {
    const planted = '.x { box-shadow: 0 1px 2px var(--lab-fx-shadow-major, rgb(0 0 0 / 0.25)); }';
    const hits = scanSource('planted.css', planted);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.token).toBe('--lab-fx-shadow-major');
  });

  it("DETECTS the TS form litVar('--lab-<colour-role>', '<literal>')", () => {
    const planted = "box-shadow: ${litVar('--lab-fx-shadow-major', 'rgb(0 0 0 / 0.25)')};";
    const hits = scanSource('planted.ts', planted);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.token).toBe('--lab-fx-shadow-major');
  });

  it('DETECTS a hex / named-colour literal on a label role', () => {
    expect(scanSource('p.css', 'color: var(--lab-label-primary, #fff);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: var(--lab-label-primary, black);')).toHaveLength(1);
  });

  // ── Case-insensitivity: RGB(), BLACK, Black are the SAME bug as their lowercase
  // forms and must be flagged in both authored forms (CodeRabbit false-negative gap).
  it('DETECTS case-insensitively (RGB / BLACK / Black) in CSS and TS', () => {
    expect(
      scanSource('p.css', 'box-shadow: var(--lab-fx-shadow-major, RGB(0 0 0 / 0.25));'),
    ).toHaveLength(1);
    expect(scanSource('p.css', 'color: var(--lab-label-primary, BLACK);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: var(--lab-label-primary, Black);')).toHaveLength(1);
    expect(
      scanSource('p.ts', "box-shadow: ${litVar('--lab-fx-shadow-major', 'RGB(0 0 0 / 0.25)')};"),
    ).toHaveLength(1);
  });

  // ── Arbitrary CSS named colours (navy/tomato/rebeccapurple/…) — the long tail the
  // old 9-name whitelist missed — are flagged on a colour role in both forms.
  it('DETECTS arbitrary CSS named colours (navy / tomato / rebeccapurple)', () => {
    expect(scanSource('p.css', 'color: var(--lab-label-primary, navy);')).toHaveLength(1);
    expect(scanSource('p.css', 'background: var(--lab-fill-primary, tomato);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: var(--lab-label-accent, rebeccapurple);')).toHaveLength(1);
    expect(
      scanSource('p.ts', "color: ${litVar('--lab-label-primary', 'rebeccapurple')};"),
    ).toHaveLength(1);
  });

  // ── Modern colour-producing functions — `color-mix()` and `light-dark()` resolve to
  // a COLOUR and so are forbidden as a role fallback. These bypassed the old regex.
  it('DETECTS color-mix() / light-dark() literals on a colour role', () => {
    const mix = scanSource(
      'p.css',
      'color: var(--lab-label-primary, color-mix(in srgb, #fff, #000));',
    );
    expect(mix).toHaveLength(1);
    expect(mix[0]?.token).toBe('--lab-label-primary');

    const ld = scanSource('p.css', 'color: var(--lab-label-primary, light-dark(#fff, #000));');
    expect(ld).toHaveLength(1);
    expect(ld[0]?.token).toBe('--lab-label-primary');

    // ...and in the TS form too.
    expect(
      scanSource(
        'p.ts',
        "color: ${cssVar('--lab-label-primary', 'color-mix(in srgb, #fff, #000)')};",
      ),
    ).toHaveLength(1);
  });

  // ── CSS system-colour keywords (Canvas / CanvasText / ButtonFace / …) resolve to a
  // platform COLOUR. They are bare identifiers and bypassed the old regex entirely.
  // Matched whole-word + case-insensitively, in both authored forms.
  it('DETECTS CSS system-colour keywords (Canvas / CanvasText / ButtonFace)', () => {
    const canvas = scanSource('p.css', 'background: var(--lab-bg-base, Canvas);');
    expect(canvas).toHaveLength(1);
    expect(canvas[0]?.token).toBe('--lab-bg-base');

    expect(scanSource('p.css', 'color: var(--lab-label-primary, CanvasText);')).toHaveLength(1);
    expect(scanSource('p.css', 'background: var(--lab-fill-neutral, ButtonFace);')).toHaveLength(1);
    // case-insensitive: a lowercased system colour is the same bug.
    expect(scanSource('p.css', 'background: var(--lab-bg-base, canvas);')).toHaveLength(1);
    // TS form.
    expect(scanSource('p.ts', "background: ${litVar('--lab-bg-base', 'Canvas')};")).toHaveLength(1);
  });

  // ── hsl/hsla and a modern colour fn (oklch) were ALREADY in the regex but had no
  // planted positive — pin them so a future regex edit can never silently drop them.
  it('DETECTS hsl() / hsla() / oklch() literals on a colour role', () => {
    expect(scanSource('p.css', 'color: var(--lab-label-primary, hsl(0 0% 0%));')).toHaveLength(1);
    expect(
      scanSource('p.css', 'color: var(--lab-label-primary, hsla(0, 0%, 0%, 0.5));'),
    ).toHaveLength(1);
    const oklch = scanSource('p.css', 'color: var(--lab-label-primary, oklch(0.5 0.1 200));');
    expect(oklch).toHaveLength(1);
    expect(oklch[0]?.token).toBe('--lab-label-primary');
    expect(
      scanSource('p.ts', "color: ${litVar('--lab-label-primary', 'oklch(0.5 0.1 200)')};"),
    ).toHaveLength(1);
  });

  // ── Component colour-role families badge/control (Misc group in roles.json;
  // --lab-badge-label-* and --lab-control-bg resolve to rgb() in contract.css). Badge is
  // a SHIPPED component — a literal fallback on either family is the #23/#24/#31 bug class
  // and must be flagged in BOTH authored forms.
  it('DETECTS a literal fallback on a --lab-badge-* role (CSS and TS)', () => {
    const css = scanSource('p.css', 'color: var(--lab-badge-label-default, #fff);');
    expect(css).toHaveLength(1);
    expect(css[0]?.token).toBe('--lab-badge-label-default');

    const ts = scanSource('p.ts', "color: ${litVar('--lab-badge-label-default', '#fff')};");
    expect(ts).toHaveLength(1);
    expect(ts[0]?.token).toBe('--lab-badge-label-default');

    // the contrast role too, with a named colour.
    expect(scanSource('p.css', 'color: var(--lab-badge-label-contrast, black);')).toHaveLength(1);
  });

  it('DETECTS a literal fallback on a --lab-control-* role (CSS and TS)', () => {
    const css = scanSource('p.css', 'background: var(--lab-control-bg, rgb(255 255 255));');
    expect(css).toHaveLength(1);
    expect(css[0]?.token).toBe('--lab-control-bg');

    const ts = scanSource('p.ts', "background: ${litVar('--lab-control-bg', 'rgb(255 255 255)')};");
    expect(ts).toHaveLength(1);
    expect(ts[0]?.token).toBe('--lab-control-bg');
  });

  // ── Gradient & device-cmyk literals — colour/image-producing values. A gradient
  // fallback bakes literal colour stops, so it is forbidden as a role fallback exactly
  // like a flat colour. Each function form is flagged on a colour role in both authored
  // forms; matched ONLY in the fallback-value position (the leading `var(--lab-…, ` /
  // TS string opener), never on a bare `gradient` substring.
  it('DETECTS linear-gradient() / radial-gradient() / conic-gradient() on a colour role', () => {
    const lin = scanSource('p.css', 'background: var(--lab-bg-base, linear-gradient(#fff, #000));');
    expect(lin).toHaveLength(1);
    expect(lin[0]?.token).toBe('--lab-bg-base');

    expect(
      scanSource('p.css', 'background: var(--lab-bg-base, radial-gradient(#fff, #000));'),
    ).toHaveLength(1);
    expect(
      scanSource('p.css', 'background: var(--lab-bg-base, conic-gradient(#fff, #000));'),
    ).toHaveLength(1);

    // TS form.
    expect(
      scanSource('p.ts', "background: ${litVar('--lab-bg-base', 'linear-gradient(#fff, #000)')};"),
    ).toHaveLength(1);
  });

  it('DETECTS a device-cmyk() literal on a colour role (CSS and TS)', () => {
    const css = scanSource('p.css', 'color: var(--lab-label-primary, device-cmyk(0 0 0 1));');
    expect(css).toHaveLength(1);
    expect(css[0]?.token).toBe('--lab-label-primary');

    expect(
      scanSource('p.ts', "color: ${litVar('--lab-label-primary', 'device-cmyk(0 0 0 1)')};"),
    ).toHaveLength(1);
  });

  // ── `repeating-*-gradient(` must NOT match — neither as a bare declaration nor, the
  // subtle case, as a colour-role FALLBACK value. A `\b` left-anchor is insufficient (a
  // word boundary sits between `repeating-` and `linear`), so the literal carries a
  // `(?<!repeating-)` negative lookbehind. This test pins that lookbehind so a future
  // revert to a bare `\b` (which WOULD false-positive on the repeating forms) fails CI.
  it('ALLOWS repeating-*-gradient() — bare declaration AND in a colour-role fallback', () => {
    // bare declaration (out of any var() fallback) — out of scope entirely.
    expect(scanSource('p.css', '.x { background: linear-gradient(#fff, #000); }')).toEqual([]);
    expect(
      scanSource('p.css', '.x { background: repeating-linear-gradient(45deg, #fff 0 1px); }'),
    ).toEqual([]);
    // the subtle case: repeating forms in the FALLBACK position must stay unflagged.
    expect(
      scanSource('p.css', 'background: var(--lab-bg-base, repeating-linear-gradient(#fff, #000));'),
    ).toEqual([]);
    expect(
      scanSource('p.css', 'background: var(--lab-bg-base, repeating-radial-gradient(#fff, #000));'),
    ).toEqual([]);
    expect(
      scanSource('p.css', 'background: var(--lab-bg-base, repeating-conic-gradient(#fff, #000));'),
    ).toEqual([]);
    // a non-repeating gradient on a DIMENSION token's fallback stays unflagged — the
    // gradient literal only fires behind a COLOUR-role prefix, never `--lab-space-*`.
    expect(
      scanSource('p.css', 'background: var(--lab-space-xs, linear-gradient(#fff, #000));'),
    ).toEqual([]);
  });

  it('ALLOWS a dimension token with a literal dimension fallback', () => {
    expect(scanSource('p.css', 'padding: var(--lab-space-xs, 0.25rem);')).toEqual([]);
    expect(scanSource('p.ts', "padding: ${litVar('--lab-radius-md', '0.375rem')};")).toEqual([]);
    expect(scanSource('p.ts', "z-index: ${litVar('--lab-z-dropdown', '900')};")).toEqual([]);
  });

  it('ALLOWS a colour role with a token → token fallback (var(a, var(b)))', () => {
    expect(
      scanSource('p.css', 'color: var(--lab-label-primary, var(--lab-label-secondary));'),
    ).toEqual([]);
    expect(
      scanSource('p.ts', "color: ${litVar('--lab-label-primary', '--lab-label-secondary')};"),
    ).toEqual([]);
  });

  it('ALLOWS a colour role with NO fallback', () => {
    expect(scanSource('p.css', 'color: var(--lab-label-primary);')).toEqual([]);
    expect(scanSource('p.ts', "color: ${litVar('--lab-fx-shadow-major')};")).toEqual([]);
  });

  // ── Blend modes are NOT colours. A non-colour keyword fallback on a token from a
  // colour-bearing family (here `--lab-fx-*`) must stay unflagged — widening the
  // literal set to system colours must not regress this (word-boundary correctness).
  // (The historical case was `--lab-mat-theme-blend`; the mat family is gone, #41 —
  // the guarded CLASS of bug is family-agnostic, so the probe uses a live family.)
  it('ALLOWS a blend-mode keyword fallback (screen / multiply / overlay)', () => {
    expect(scanSource('p.css', 'mix-blend-mode: var(--lab-fx-blend, screen);')).toEqual([]);
    expect(scanSource('p.css', 'mix-blend-mode: var(--lab-fx-blend, multiply);')).toEqual([]);
    expect(scanSource('p.css', 'mix-blend-mode: var(--lab-fx-blend, overlay);')).toEqual([]);
    expect(scanSource('p.ts', "mix-blend-mode: ${litVar('--lab-fx-blend', 'screen')};")).toEqual(
      [],
    );
  });

  // ── Word-boundary guard: an identifier that merely CONTAINS a system-colour keyword as
  // a substring (Canvassed ⊃ Canvas, Fieldset ⊃ Field, Marker ⊃ Mark) must NOT be flagged.
  it('ALLOWS identifiers that only contain a system-colour substring', () => {
    expect(scanSource('p.css', 'content: var(--lab-label-primary, Canvassed);')).toEqual([]);
    expect(scanSource('p.css', 'content: var(--lab-label-primary, Fieldset);')).toEqual([]);
    expect(scanSource('p.css', 'content: var(--lab-label-primary, Marker);')).toEqual([]);
  });
});
