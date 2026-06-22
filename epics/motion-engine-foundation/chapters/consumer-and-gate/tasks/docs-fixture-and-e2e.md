---
id: docs-fixture-and-e2e
chapter: consumer-and-gate
epic: motion-engine-foundation
title: "motion.html docs fixture + Playwright e2e under emulated prefers-reduced-motion (refine after seam)"
status: placeholder
priority: 2
depends_on:
  - motion-controller-seam
blocks:
  - zero-dep-bundle-gate
agent_profile:
  category: deep
  skills: [craft-qa, craft-frontend]
started: null
completed: null
refine_after:
  - motion-controller-seam
---

# Docs fixture + e2e (PLACEHOLDER)

Will be refined after `motion-controller-seam` completes — the fixture markup and the spec's selectors/assertions depend on the controller's real API.

Known anchors: add `apps/docs/src/motion.html` + `apps/docs/src/motion-demo.ts` (register as a Vite multi-page entry like the other demos) and `apps/docs/tests/motion.spec.ts`. The spec MUST use Playwright's real `reducedMotion: 'reduce'` emulation (chromium + webkit) and assert NO animated motion under reduce, and motion present without it (differential). Fixture must use `--lab-*` contract colours only (no hardcoded colours — the guard scans apps/*).
