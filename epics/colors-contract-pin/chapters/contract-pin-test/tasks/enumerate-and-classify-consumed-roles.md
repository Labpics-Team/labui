---
id: enumerate-and-classify-consumed-roles
chapter: contract-pin-test
epic: colors-contract-pin
title: "Build the consumer enumerator + three-bucket classifier (shared module for the pin test)"
status: ready
priority: 1
depends_on: []
blocks:
  - contract-pin-snapshot-test
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# Build the consumer enumerator + three-bucket classifier

## What
Author a framework-free TS module (model it on the existing `packages/colors-stub/test/no-literal-colour-fallback.ts` scanner — same repo-root resolution, same glob/exclude style) that:

1. **Enumerates** every consumed `--lab-*` reference across `packages/**/*.{ts,tsx,css}` and `apps/**/*.{ts,tsx,css}`, excluding `dist/`, `node_modules/`, `src/generated/` (generated CSS DECLARES tokens, it does not consume the contract), and the scanner/test files themselves. Capture three authored forms:
   - CSS: `var(--lab-<name>...)`
   - TS:  `litVar('--lab-<name>'...)` and `cssVar('--lab-<name>'...)`
   Normalize to the bare role name; drop prefix-only captures (a trailing-hyphen fragment like `--lab-fill-` that comes from the css.ts prefix constants — exclude the css.ts file and `roles.json` from the consumer scan so these do not pollute the set).
2. **Classifies** each consumed name into exactly one bucket:
   - `colour-contract` — present in `colors-stub/roles.json` (any group).
   - `dimension` — starts with a prefix in css.ts `DIMENSION_PREFIXES`.
   - `local-or-gap` — matches the documented locally-provided/gap allowlist (see References): `--lab-shadow-`, `--lab-surface-shadow-tint`, `--lab-shadow-color`, `--lab-light-angle`, `--lab-mat-`, `--lab-ambient-`, `--lab-glass-`, `--lab-elevation-`. This allowlist MUST be a named, commented constant so CH-03's external-deps doc and this list stay in sync.
   - `unclassified` — anything else.
3. Exports `consumedRoles(): string[]`, `classify(name): 'colour-contract'|'dimension'|'local-or-gap'|'unclassified'`, and a `byBucket()` helper, with `repoRoot` resolution identical to the sibling scanner.

Place the module at `packages/colors-stub/test/consumed-contract.ts` (sibling to the existing scanner, so `pnpm -r test` in colors-stub picks up its test).

## Must NOT Do
- Do NOT touch the lab-colors repo, `roles.json`, or `contract.css` (this task only READS them).
- Do NOT hardcode the consumed-role list as a literal array — it must be DERIVED by scanning, or the test rots the moment a component adds a role.
- Do NOT scan `src/generated/**` or `dist/**` as consumers (they declare, not consume).
- Do NOT fold dimension or local-or-gap tokens into the colour-contract assertion (they are not owned by colors-stub).

## Verification
- [ ] `consumedRoles()` returns ≥150 names and includes known consumed roles (`--lab-label-primary`, `--lab-fill-brand-primary`, `--lab-border-base`).
- [ ] `classify('--lab-label-primary') === 'colour-contract'`; `classify('--lab-space-sm') === 'dimension'`; `classify('--lab-surface-shadow-tint') === 'local-or-gap'`; `classify('--lab-bogus-xyz') === 'unclassified'`.
- [ ] Running the module standalone (`node`/`tsx`) over the live tree yields ZERO `unclassified` names today (proves the allowlist is complete at creation).
- [ ] `pnpm --filter @labpics/colors typecheck` passes.

## References
- `packages/colors-stub/test/no-literal-colour-fallback.ts` — the scanner pattern to mirror (repoRoot, globSync, exclude rules).
- `packages/core/src/css.ts` — `DIMENSION_PREFIXES`, `SEMANTIC_ROLE_PREFIXES`, `FORBIDDEN_PRIMITIVE_PREFIXES` (the bucket boundaries).
- `packages/colors-stub/roles.json` — canonical colour-contract role set (151 roles).
- `packages/shadow/src/generated/shadow.css`, `packages/core/src/materials.css` — where local-or-gap tokens are declared (defines the allowlist).
- EPIC.md "three consumption buckets" — the architectural rationale.
