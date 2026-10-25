import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Shadow-only diff — regression test.
 *
 * Verifies that the generated `shadow.css` artifact's content stays within
 * the shadow-package namespace: it declares ONLY `--lab-shadow-*`,
 * `--lab-elevation-*`, and `--lab-light-angle` tokens, and does NOT declare
 * or delete any component colour-contract token (no `--lab-label-*`,
 * `--lab-fill-*`, `--lab-border-*`, etc.) or any colors role.
 *
 * This catches the class of accidental cross-contamination where a shadow
 * rebuild inadvertently alters the colour contract namespace.
 *
 * How="mutation": the test is GREEN at birth — the on-disk artifact only
 * emits shadow-namespace tokens. Bite-proof: adding a `--lab-label-primary`
 * line to the artifact would violate the namespace invariant and fail the
 * test. Proved inline with an injected colour-contract token.
 *
 * The generator call is intentionally avoided here: this test pins the ON-DISK
 * artifact (what ships), not the live generator. The generated-shadow test handles
 * the coherence between generator and artifact.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GENERATED_CSS = resolve(here, '..', 'src', 'generated', 'shadow.css');

/** Token families that belong OUTSIDE the shadow namespace. */
const COLOUR_CONTRACT_PREFIXES = [
  '--lab-label-',
  '--lab-fill-',
  '--lab-border-',
  '--lab-bg-',
  '--lab-surface-',
  '--lab-overlay-',
  '--lab-accent-',
  '--lab-neutral-',
  '--lab-badge-',
  '--lab-control-',
] as const;

/** Token families that belong INSIDE the shadow namespace. */
const SHADOW_NAMESPACE_PREFIXES = [
  '--lab-shadow-',
  '--lab-elevation-',
  '--lab-light-angle',
] as const;

/**
 * Extract every CSS custom property DECLARATION from a CSS string.
 * Matches lines of the form `  --name:` or `  --name :`.
 */
function extractDeclarations(css: string): string[] {
  return [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1] ?? '').filter(Boolean);
}

describe('shadow-only diff — namespace invariant', () => {
  // ── (1) The artifact declares ONLY shadow-namespace tokens ──────────────────
  it('the generated shadow.css declares ONLY shadow-namespace tokens (no colour-contract names)', () => {
    const css = readFileSync(GENERATED_CSS, 'utf8');
    const declarations = extractDeclarations(css);

    expect(declarations.length, 'shadow.css must have at least one declaration').toBeGreaterThan(0);

    const violations = declarations.filter((name) =>
      COLOUR_CONTRACT_PREFIXES.some((p) => name.startsWith(p)),
    );

    expect(
      violations,
      `shadow.css must NOT declare colour-contract tokens. Found:\n${violations.map((n) => `  ${n}`).join('\n')}`,
    ).toEqual([]);
  });

  // ── (2) Every declared token is in the shadow namespace ─────────────────────
  it('every declaration in the artifact starts with a shadow-namespace prefix', () => {
    const css = readFileSync(GENERATED_CSS, 'utf8');
    const declarations = extractDeclarations(css);

    const nonShadow = declarations.filter(
      (name) => !SHADOW_NAMESPACE_PREFIXES.some((p) => name.startsWith(p)),
    );
    expect(
      nonShadow,
      `All declarations in shadow.css must start with a shadow-namespace prefix.\nNon-shadow tokens found:\n${nonShadow.map((n) => `  ${n}`).join('\n')}`,
    ).toEqual([]);
  });

  // ── (3) Spot-check: specific shadow tokens are present ──────────────────────
  it('the artifact declares the light-angle token and at least one elevation role', () => {
    const css = readFileSync(GENERATED_CSS, 'utf8');
    expect(css).toContain('--lab-light-angle:');
    // At minimum one elevation role must be declared.
    const hasElevation = SHADOW_NAMESPACE_PREFIXES.some(
      (p) => p === '--lab-elevation-' && css.includes('--lab-elevation-'),
    );
    expect(hasElevation, 'must declare at least one --lab-elevation-* token').toBe(true);
  });

  // ── (4) Mutation-proof: injecting a colour-contract token is detected ─────────
  it('RED-proof: injecting --lab-label-primary into a CSS block is detected as out-of-namespace', () => {
    const injected = '--lab-label-primary: red;';
    const declarations = extractDeclarations(injected);
    const violations = declarations.filter((name) =>
      COLOUR_CONTRACT_PREFIXES.some((p) => name.startsWith(p)),
    );
    expect(violations).toContain('--lab-label-primary');
  });

  // ── (5) Mutation-proof: a correct shadow token passes the check ───────────────
  it('RED-proof: --lab-shadow-alpha-s1 correctly passes the namespace check', () => {
    const correct = '--lab-shadow-alpha-s1: 0.12;';
    const declarations = extractDeclarations(correct);
    const violations = declarations.filter((name) =>
      COLOUR_CONTRACT_PREFIXES.some((p) => name.startsWith(p)),
    );
    expect(violations).toEqual([]);
    const inNamespace = declarations.every((name) =>
      SHADOW_NAMESPACE_PREFIXES.some((p) => name.startsWith(p)),
    );
    expect(inNamespace).toBe(true);
  });
});
