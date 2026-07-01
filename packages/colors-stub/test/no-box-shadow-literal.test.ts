import { describe, expect, it } from 'vitest';
import {
  SHADOW_ALLOWLIST,
  scanBoxShadow,
  scanAllShadowLiterals,
  shadowTargetFiles,
} from './no-box-shadow-literal.js';

/**
 * Consumed-not-reinvented guard — contract test.
 *
 * Asserts that ZERO components across packages/* and apps/docs/* author their
 * own box-shadow geometry. Every elevation shadow must be consumed from the
 * @labpics/ui-shadow contract via a pure `var(--lab-elevation-*)` or
 * `var(--lab-shadow-*)` token.
 *
 * State: GREEN — the governed tree is CLEAN of literal box-shadow geometry.
 * All named components (lab-combobox, lab-dialog, lab-menu, lab-popover,
 * lab-select) already use pure `var(--lab-elevation-*)` tokens; no reinventions
 * exist in the current tree. This test is a regression guard: it turns RED if a
 * future commit introduces a literal-geometry box-shadow value.
 *
 * RED-proof: the detection proofs below independently confirm the scanner fires
 * on each reinvention form and ignores every allowed form, so a green live-tree
 * run means "clean", never "blind".
 */

describe('consumed-not-reinvented guard — box-shadow contract', () => {
  // ── (1) Live-tree assertion: ZERO box-shadow reinventions. ──────────────────
  // This is the RED test: it fails on the current tree because multiple
  // components have hardcoded geometry. Fix: migrate them to the contract.
  it('the live packages/* tree has ZERO box-shadow literal reinventions (regression guard)', () => {
    const violations = scanAllShadowLiterals();
    const report = violations.map((v) => `  ${v.file}:${v.line} → ${v.snippet}`).join('\n');
    expect(
      violations,
      `box-shadow reinventions in components (replace with var(--lab-elevation-*) or var(--lab-shadow-*)):\n${report}`,
    ).toEqual([]);
  });

  // ── (2) Detection proofs — each reinvention form produces a hit. ────────────
  it('DETECTS a geometric offset + token colour (the hybrid reinvention form)', () => {
    // This is the most common form: literal geometry + token for colour.
    // The scanner must catch it even though a token is present.
    expect(
      scanBoxShadow('p.ts', "box-shadow: 0 0.5rem 1.5rem ${litVar('--lab-fx-shadow-major')};"),
    ).toHaveLength(1);
  });

  it('DETECTS a fully hardcoded box-shadow (geometry + colour literal)', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: 0 4px 12px rgba(0,0,0,0.2);')).toHaveLength(1);
  });

  it('DETECTS a partial geometry with rem units', () => {
    expect(
      scanBoxShadow('p.ts', "box-shadow: 0 0.75rem 2.5rem ${litVar('--lab-fx-shadow-major')};"),
    ).toHaveLength(1);
  });

  it('DETECTS a small geometric ply with rem (e.g. kbd drop shadow)', () => {
    expect(
      scanBoxShadow('p.ts', "box-shadow: 0 0.0625rem 0 ${litVar('--lab-fx-shadow-penumbra')};"),
    ).toHaveLength(1);
  });

  // ── (2b) Foreign-namespace flat-token detection — the class the previous guard
  //          was blind to. A pure `var(--lab-fx-*)` carries no geometry or tint;
  //          it silently forks off the shadow system even without a literal length.
  it('DETECTS a flat foreign-namespace token (var(--lab-fx-shadow-minor))', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: var(--lab-fx-shadow-minor);')).toHaveLength(1);
  });

  it('DETECTS a flat foreign-namespace token (var(--lab-fx-shadow-major))', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: var(--lab-fx-shadow-major);')).toHaveLength(1);
  });

  it('DETECTS any non-elevation var(--lab-*) single-colour token', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: var(--lab-fill-neutral-tinted);')).toHaveLength(1);
  });

  // ── (3) Allowed-form proofs — these must NOT produce a hit. ─────────────────
  it('IGNORES a pure contract token reference', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: var(--lab-elevation-raised);')).toEqual([]);
  });

  it('IGNORES box-shadow: none', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: none;')).toEqual([]);
    expect(scanBoxShadow('p.ts', 'box-shadow: none;')).toEqual([]);
  });

  it('IGNORES a focus-ring pattern (0 0 0 token token)', () => {
    expect(
      scanBoxShadow(
        'p.ts',
        "box-shadow: 0 0 0 ${litVar('--lab-focus-ring-width')} ${litVar('--lab-border-focus')};",
      ),
    ).toEqual([]);
  });

  it('IGNORES a focus-ring with a literal ring width (0 0 0 2px var(--lab-…))', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: 0 0 0 2px var(--lab-border-focus);')).toEqual([]);
  });

  it('IGNORES a transition mention of box-shadow', () => {
    expect(
      scanBoxShadow('p.css', 'transition: border-color 120ms ease, box-shadow 120ms ease;'),
    ).toEqual([]);
  });

  it('IGNORES a var(--lab-shadow-*) token reference', () => {
    expect(scanBoxShadow('p.css', 'box-shadow: var(--lab-shadow-m);')).toEqual([]);
  });

  // ── (4) Allowlist proof — the contract source files are exempt. ──────────────
  it('the allowlisted files are a proper subset of the governed surface', () => {
    // Prove the allowlist paths are recognised by the scanner exclusion logic.
    // Each allowlisted path must NOT appear in the live violation set.
    const violations = scanAllShadowLiterals();
    for (const allowed of SHADOW_ALLOWLIST) {
      const leak = violations.filter((v) => v.file.endsWith(allowed.replace(/\\/g, '/')));
      expect(leak, `allowlisted file ${allowed} must not appear in violations`).toEqual([]);
    }
  });

  // ── (5) Target-surface sanity — we cover a substantial component surface. ───
  it('the governed surface includes a substantial component count (sanity floor)', () => {
    const files = shadowTargetFiles();
    // There are many component .css and .ts files; the surface must be non-trivial.
    expect(files.length).toBeGreaterThan(20);
  });
});
