---
id: consumer-and-gate
epic: motion-engine-foundation
title: "Core motion-controller seam + docs fixture + e2e under emulated reduced-motion + zero-dep & bundle-size proof"
user_story: "As a designer viewing a LabUI component in a browser, I want its motion to actually run smoothly when I allow it and stop completely when I set my OS to reduce motion, so that the system's animation promise is real in a real browser, not just in unit tests."
enabler_for: ""
status: draft
priority: 3
depends_on: [declarative-animate]
refine_after: [animate-api-driver, public-api-pin]
parallel_group: ""
agent_profile:
  category: deep
  skills: [craft-arch, craft-qa, craft-frontend]
---

# Consumer seam + e2e gate + zero-dep/bundle proof

## User Story
As a designer viewing a LabUI component in a browser, I want its motion to run when I allow it and stop completely when I set `prefers-reduced-motion: reduce`, so that the animation promise holds in a real browser. (Status draft: the consumer-seam shape + bundle-size assertion depend on CH-02's final public API — refine after `public-api-pin`.)

## Purpose
Close the loop in a real browser: a Lit `ReactiveController` in `@labpics/ui-core` (`src/lit/motion-controller.ts`, sibling of `zag-controller.ts`) that drives the engine; a docs fixture (`apps/docs/src/motion.html` + `motion-demo.ts`) that animates a real element; a Playwright spec (`apps/docs/tests/motion.spec.ts`) asserting motion under default media AND no motion under emulated `prefers-reduced-motion: reduce`. Plus the two hard proofs of the scope: `dependencies` empty (read built dist + package.json) and bundle size measured + recorded. Finally run the full gate.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/motion-controller-seam.md` | placeholder | deep | declarative-animate |
| `tasks/docs-fixture-and-e2e.md`   | placeholder | deep | motion-controller-seam |
| `tasks/zero-dep-bundle-gate.md`   | placeholder | deep | docs-fixture-and-e2e |

## Exit Criteria
(Given/When/Then — refine wording after CH-02; the scope's exit-criteria are pinned here.)
- [ ] Given `@labpics/ui-core`, When `motion-controller.ts` is added beside `zag-controller.ts`, Then a `LabElement` can drive an animation through `@labpics/ui-motion` WITHOUT adding a hard runtime dep that breaks the engine's zero-dep promise — proven by typecheck + a unit/integration test.
- [ ] Given `apps/docs` built + previewed, When `tests/motion.spec.ts` runs on chromium AND webkit with `reducedMotion: 'reduce'` emulated, Then the element shows NO animated motion (instant); and without the emulation, Then it DOES move — a real differential e2e assertion (Playwright CAN emulate prefers-reduced-motion).
- [ ] Given the built `@labpics/ui-motion`, When `dist` + `package.json` are read, Then `dependencies` is empty and `dist` imports nothing external (zero runtime deps).
- [ ] Given the built `dist/index.js`, When measured, Then the (gzipped) byte size is RECORDED in the chapter evidence + a docs note / INTEGRATION.md; surprising size is flagged.
- [ ] Given the full gate, When `pnpm -r typecheck && pnpm -r build && pnpm -r test && pnpm test:e2e` run, Then ALL pass; consumers grepped repo-wide before push (labui-two-test-layers gate).
