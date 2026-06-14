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
});
