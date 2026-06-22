---
id: reduced-motion-policy
chapter: declarative-animate
epic: motion-engine-foundation
title: "prefers-reduced-motion policy behind an injectable matcher seam (TDD, both states)"
status: ready
priority: 1
depends_on: []
blocks:
  - animate-api-driver
agent_profile:
  category: deep
  skills: [craft-arch, craft-qa]
started: null
completed: null
refine_after: []
---

# Reduced-motion policy

## What
Create the single module that owns the accessibility preference (Layer 2). TDD: failing tests first.
- `packages/motion/src/reduced-motion.ts` — export a function like `prefersReducedMotion(matcher?)` that reads `(prefers-reduced-motion: reduce)`. The platform read goes through an INJECTABLE seam: default uses `globalThis.matchMedia` IF present (guarded for SSR/node — returns `false` when `matchMedia` is undefined), but tests pass a fake matcher returning `true`/`false`. Also export the collapse policy (what "reduce" means for an animation: duration→0 / resolve-to-final).
- This is the ONLY module allowed to reference `matchMedia` (invariant 5 keeps it out of the solver). It must NOT import spring/tween.
- SSR-safe: in node (no `matchMedia`), default returns `false` (motion allowed) without throwing — the docs app SSRs core, so a throw here would break the build.

## Tests (RED first)
- Injected matcher `true` → policy says reduce (`unit`).
- Injected matcher `false` → policy says animate (`unit`).
- No `matchMedia` on globalThis (node) → returns `false`, no throw (`unit` — fault/SSR safety).

## Must NOT Do
- Import spring.ts/tween.ts/animate.ts here (wrong dependency direction).
- Read `matchMedia` anywhere else in the package — this module is the sole owner.
- Throw in a node/SSR context where `matchMedia` is undefined.

## Verification
- [ ] Both preference states + the node/no-matchMedia path proven by unit tests (RED-proof recorded).
- [ ] grep: `matchMedia` appears ONLY in reduced-motion.ts within `packages/motion/src`.
- [ ] `pnpm --filter @labpics/ui-motion test` + typecheck pass.

## References
- EPIC.md Architecture — Layer 2 + invariant 4.
- `apps/docs/vite.config.ts` ssrProofPlugin — why SSR-safety (no throw) matters.
