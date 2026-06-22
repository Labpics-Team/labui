---
id: motion-controller-seam
chapter: consumer-and-gate
epic: motion-engine-foundation
title: "Lit ReactiveController in core that drives @labpics/ui-motion (refine after CH-02)"
status: placeholder
priority: 1
depends_on:
  - declarative-animate
blocks:
  - docs-fixture-and-e2e
agent_profile:
  category: deep
  skills: [craft-arch, craft-frontend]
started: null
completed: null
refine_after:
  - public-api-pin
---

# Core motion-controller seam (PLACEHOLDER)

Will be refined after `public-api-pin` (CH-02) completes — the controller's method surface and how it wires the engine handle depend on the FINAL public `animate` API, which is not yet decided. Do NOT guess it now (P1).

Known anchors (safe to state pre-refinement): the file is `packages/core/src/lit/motion-controller.ts`, a sibling of the existing `zag-controller.ts`, implementing Lit `ReactiveController`; it must NOT add a hard runtime dependency that breaks ui-motion's zero-dep promise (decide peer vs. import-only at refinement, grounded in how `core` already declares deps).
