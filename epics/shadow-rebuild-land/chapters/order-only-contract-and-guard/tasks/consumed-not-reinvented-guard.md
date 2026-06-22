---
id: consumed-not-reinvented-guard
chapter: order-only-contract-and-guard
epic: shadow-rebuild-land
title: "Add a consumed-not-reinvented guard: elevation shadows come from the shadow package, not ad-hoc box-shadow literals"
status: ready
priority: 2
depends_on:
  - discard-broken-edit-land-coherent-tree
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# Add a consumed-not-reinvented guard

## What
Add a guard test (sibling to the colors-stub scanners, or in `packages/shadow/test/` — choose the layer that owns the consumer surface; prefer the existing colors-stub scanner pattern since it already enumerates `packages/**`/`apps/**` CSS) that PROVES every elevation shadow in component CSS comes from the `@labpics/ui-shadow` surface, NOT an ad-hoc literal. Specifically:
- Scan `packages/**/*.css` + `apps/**/*.css` (excluding `dist`, `node_modules`, `src/generated/`, and the shadow package's own generated stylesheet which DECLARES the stack).
- FAIL on any `box-shadow:` declaration whose value contains a colour/offset LITERAL (e.g. `box-shadow: 0 1px 2px rgba(0,0,0,.1)`) rather than a contract reference (`var(--lab-elevation-*)`, the `.lab-shadow-*` class application, or `none`/`inherit`).
- Allow: `box-shadow: var(--lab-elevation-…)`, `box-shadow: none`, and the generated `shadow.css` (the SOURCE of the stack — allowlisted with a recorded reason, mirroring `no-hardcoded-colour.ts` ALLOWLIST).
- Reuse the existing scanner machinery (`consumed-contract.ts` / `no-hardcoded-colour.ts` glob + exclude + repoRoot resolution) so the two guards never disagree on the consumer surface (DRY / single source of the boundary rule).

This closes the CLASS "elevation re-invented as ad-hoc box-shadow literals, silently forking off the design system", not a single offending file.

## Must NOT Do
- Do NOT just grep for the word `box-shadow` and pass — distinguish CONTRACT references (allowed) from LITERALS (flagged), like `no-hardcoded-colour.ts` distinguishes value-position colours from identifiers.
- Do NOT allowlist a real component leak to go green — a leak is fixed by routing the component through `--lab-elevation-*`.
- Do NOT weaken the existing colors-stub guards; this is an ADDITIONAL guard on the same surface.

## Verification
- [ ] Guard PASSES on the coherent tree (no component currently authors an ad-hoc elevation literal — confirm by running it).
- [ ] RED-proof: injecting `box-shadow: 0 1px 2px rgba(0,0,0,.1)` into a component CSS file (e.g. a react package CSS) makes the guard FAIL with a `file:line` pointing at the literal; removing it → PASS (verification-runner, isolated).
- [ ] The guard reuses the shared scanner glob/exclude (no second copy of the consumer-surface rule).
- [ ] `biome check` + `pnpm -r typecheck` clean with the new guard.

## References
- `packages/colors-stub/test/no-hardcoded-colour.ts` — the scanner pattern to mirror (allowlist, comment-strip, value-position discrimination, `targetFiles()`).
- `packages/colors-stub/test/consumed-contract.ts` — `consumerFiles()` glob/exclude to reuse.
- `packages/shadow/src/generated/shadow.css` — the legitimate DECLARATION surface (allowlist).
- craft-arch — dependency direction: consumers depend on the contract, never re-author the primitive.
