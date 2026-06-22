---
id: verify-consumed-contract-and-guards
chapter: verify-contract-green
epic: shadow-rebuild-land
title: "Verify consumed --lab-* contract preserved + alpha rename accepted by guards"
status: ready
priority: 1
depends_on:
  - consumed-not-reinvented-guard
blocks:
  - run-full-suite-and-e2e
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# Verify consumed --lab-* contract preserved + alpha rename accepted by guards

## What
Run `pnpm --filter @labpics/colors-stub test` against the landed coherent tree and confirm:
- The consumed-contract guard classifies every shadow name (`--lab-shadow-alpha-s1..s4`, `--lab-shadow-{xs,s,m,l,xl}`, `--lab-shadow-color`, `--lab-surface-shadow-tint`, `--lab-light-angle`, `--lab-elevation-*`) as `local-or-gap` — the `byBucket().unclassified` set is EMPTY and `missingColourRoles()` returns `[]`. The `s1..s4` rename introduces no dropped/unclassified role because `--lab-shadow-` is an allowlisted prefix.
- The no-hardcoded-colour guard PASSES: the only shadow colour is `color-mix(in srgb, transparent, var(--lab-surface-shadow-tint, var(--lab-shadow-color)) …)` (the documented exempt combinator) and the literal anchor lives only in the allowlisted `generated/shadow.css` + `config.ts`.
- The no-literal-colour-fallback guard still PASSES.
If any guard fires, fix the SOURCE (rename or deliberate allowlist with recorded reason) — never delete an assertion.

## Must NOT Do
- Do NOT weaken/allowlist past a guard to go green (CLAUDE.md ⛔ подлог). An allowlist widening requires a recorded reason in the doc.
- Do NOT conflate `--lab-shadow-alpha-*` (this package) with the colors-stub `--lab-fx-shadow-*` family (separate, out of scope).

## Verification
- [ ] `pnpm --filter @labpics/colors-stub test` PASSES; `byBucket().unclassified == []`.
- [ ] Guard run output shows shadow names in `local-or-gap`, none `unclassified`.
- [ ] If any allowlist was touched, the diff shows a recorded reason (not a silent assertion delete).

## References
- `packages/colors-stub/test/consumed-contract.ts` — `classify`, `byBucket`, `missingColourRoles`, `LOCAL_OR_GAP_PREFIXES`.
- `packages/colors-stub/test/no-hardcoded-colour.ts` — ALLOWLIST + `color-mix` exemption.
- `packages/shadow/src/domain/box-shadow.ts` (branch equiv) — the `color-mix` tint path.
