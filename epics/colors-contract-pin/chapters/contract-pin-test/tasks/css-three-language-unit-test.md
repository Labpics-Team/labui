---
id: css-three-language-unit-test
chapter: contract-pin-test
epic: colors-contract-pin
title: "Unit test proving css.ts rejects a forbidden primitive and accepts a semantic role"
status: ready
priority: 2
depends_on: []
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# css.ts three-language unit test

## What
Add `packages/core/test/css-three-language.test.ts` (vitest) that turns the documented three-language rule into ENFORCED behaviour. `core/src/css.ts` currently exports the prefix CONSTANTS as documentation anchors but nothing asserts the language boundary. Author a small pure predicate IN `css.ts` (export it — e.g. `classifyLabVar(name): 'semantic' | 'dimension' | 'forbidden-primitive' | 'unknown'`) built from the existing `SEMANTIC_ROLE_PREFIXES` / `DIMENSION_PREFIXES` / `FORBIDDEN_PRIMITIVE_PREFIXES`, then test:

1. A semantic-role reference is ACCEPTED: `classifyLabVar('--lab-label-primary') === 'semantic'`, `'--lab-fill-brand-primary' → 'semantic'`, `'--lab-mat-blur' → 'semantic'`.
2. A dimension reference is ACCEPTED as `'dimension'`: `'--lab-space-sm'`, `'--lab-radius-full'`, `'--lab-focus-ring-width'`.
3. A forbidden-primitive reference is REJECTED: `classifyLabVar('--lab-neutral-100') === 'forbidden-primitive'`, `'--lab-accent-500' → 'forbidden-primitive'`.
4. `cssVar`/`litVar` behaviour is pinned: a colour role with NO fallback emits `var(--lab-label-primary)`; a dimension token with a literal fallback emits `var(--lab-space-sm, 0.5rem)`; a `--lab-*` fallback is wrapped in its own `var()`.

The predicate must be the SINGLE source the prefix lists feed — so adding a prefix to a constant automatically extends classification (DIP: one chokepoint, no second copy of the rule).

## Must NOT Do
- Do NOT change the public signatures of `cssVar` / `litVar` (consumers depend on them).
- Do NOT add a runtime throw inside `cssVar`/`litVar` that would break existing call sites — the rejection is a classification/lint concern, expressed via the predicate + test, not a behavioural break.
- Do NOT hardcode the prefix lists in the test — import the exported constants so the test tracks the source of truth.

## Verification
- [ ] `pnpm --filter @labpics/ui-core test` (or the core package's test script) runs the spec and it PASSES.
- [ ] Adding a bogus prefix to a local copy of `FORBIDDEN_PRIMITIVE_PREFIXES` reclassifies a matching name — proves the predicate reads the constant, not a copy. Revert after.
- [ ] `pnpm -r typecheck` passes (new export typed).

## References
- `packages/core/src/css.ts` — the constants and `cssVar`/`litVar` to build the predicate on.
- `docs/core-CONTRACT.md` §0 law 2 ("Components speak only the semantic language… Never a primitive. Never a hex.") — the rule being enforced.
