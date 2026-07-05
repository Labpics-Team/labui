import { describe, expect, it } from 'vitest';
import {
  DIMENSION_PREFIXES,
  FORBIDDEN_PRIMITIVE_PREFIXES,
  SEMANTIC_ROLE_PREFIXES,
  // `classifyLabVar` is the predicate that makes the three-language rule
  // executable, built from the three prefix constants below as the SINGLE
  // source (DIP). (It was added RED-first: this import resolving is what turned
  // the originally-failing suite green.)
  classifyLabVar,
  cssVar,
  litVar,
} from '../src/css.js';

/**
 * The three-language rule, enforced as BEHAVIOUR — not just a comment.
 *
 * css.ts documents the convention (primitives → semantic roles → components):
 * a component reads ONLY semantic roles + dimensions, NEVER a primitive, NEVER a
 * hex. `classifyLabVar` is the pure predicate that makes that rule executable;
 * it MUST be built from the exported `SEMANTIC_ROLE_PREFIXES` /
 * `DIMENSION_PREFIXES` / `FORBIDDEN_PRIMITIVE_PREFIXES` constants — one
 * chokepoint, no second copy (DIP). This suite reads those same constants, so a
 * prefix added to a constant automatically extends both the rule and the test.
 */
describe('classifyLabVar — three-language boundary', () => {
  it('ACCEPTS a semantic-role reference as "semantic"', () => {
    expect(classifyLabVar('--lab-label-primary')).toBe('semantic');
    expect(classifyLabVar('--lab-fill-brand-primary')).toBe('semantic');
    // (`--lab-mat-*` был третьей пробой; семейство ушло вместе с core-шимами, #41.)
    expect(classifyLabVar('--lab-fx-shadow-major')).toBe('semantic');
  });

  it('ACCEPTS a dimension reference as "dimension"', () => {
    expect(classifyLabVar('--lab-space-sm')).toBe('dimension');
    expect(classifyLabVar('--lab-radius-full')).toBe('dimension');
    expect(classifyLabVar('--lab-focus-ring-width')).toBe('dimension');
  });

  it('REJECTS a forbidden primitive as "forbidden-primitive"', () => {
    expect(classifyLabVar('--lab-neutral-100')).toBe('forbidden-primitive');
    expect(classifyLabVar('--lab-accent-500')).toBe('forbidden-primitive');
  });

  it('returns "unknown" for a name matching no known prefix', () => {
    expect(classifyLabVar('--lab-bogus-xyz')).toBe('unknown');
  });

  it('returns "unknown" for a name outside the --lab- namespace', () => {
    // A prefix collision with a non-lab var (e.g. `--label-…` sharing letters)
    // must NOT classify as a lab token — the `--lab-` namespace guard owns this.
    expect(classifyLabVar('--label-primary')).toBe('unknown');
    expect(classifyLabVar('--color-accent-500')).toBe('unknown');
  });

  // ── Predicate reads the EXPORTED constants (DIP chokepoint). Every prefix in
  // each constant must classify into its bucket — so extending a constant
  // extends classification without a second edit. Sample-named cases above pin
  // specific names; this pins the WHOLE constant ⇄ classifier binding.
  it('classifies every prefix from each exported constant into its own bucket', () => {
    for (const p of SEMANTIC_ROLE_PREFIXES) {
      expect(classifyLabVar(`${p}sample`), `${p} should be semantic`).toBe('semantic');
    }
    for (const p of DIMENSION_PREFIXES) {
      expect(classifyLabVar(`${p}sample`), `${p} should be dimension`).toBe('dimension');
    }
    for (const p of FORBIDDEN_PRIMITIVE_PREFIXES) {
      expect(classifyLabVar(`${p}sample`), `${p} should be forbidden-primitive`).toBe(
        'forbidden-primitive',
      );
    }
  });
});

/**
 * `cssVar` / `litVar` output is pinned (characterization) — these signatures are
 * consumed across every renderer; the three-language test must not let their
 * emit drift. `litVar` wraps the same string in a Lit CSSResult.
 */
describe('cssVar / litVar emit', () => {
  it('a colour role with NO fallback emits var(--name)', () => {
    expect(cssVar('--lab-label-primary')).toBe('var(--lab-label-primary)');
  });

  it('a dimension token with a literal fallback emits var(--name, <literal>)', () => {
    expect(cssVar('--lab-space-sm', '0.5rem')).toBe('var(--lab-space-sm, 0.5rem)');
  });

  it('a --lab-* fallback is wrapped in its own var()', () => {
    expect(cssVar('--lab-label-primary', '--lab-label-secondary')).toBe(
      'var(--lab-label-primary, var(--lab-label-secondary))',
    );
  });

  it('litVar emits the same reference string as cssVar (as a CSSResult)', () => {
    expect(litVar('--lab-space-sm', '0.5rem').toString()).toBe('var(--lab-space-sm, 0.5rem)');
  });
});
