---
id: zero-dep-bundle-gate
chapter: consumer-and-gate
epic: motion-engine-foundation
title: "Prove zero runtime deps + measure & record bundle size + run full gate (refine after fixture)"
status: placeholder
priority: 3
depends_on:
  - docs-fixture-and-e2e
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa]
started: null
completed: null
refine_after:
  - docs-fixture-and-e2e
---

# Zero-dep proof + bundle size + full gate (PLACEHOLDER)

Will be refined after `docs-fixture-and-e2e` — the exact build artifacts to measure depend on the final dist shape.

Known anchors: (1) read built `dist/index.js` + `package.json` to prove `dependencies` is empty and dist imports nothing external; (2) measure gzipped byte size of `dist/index.js` via a tiny node script and RECORD it in this task's evidence + a `docs/` note or `INTEGRATION.md`; (3) run the FULL gate `pnpm -r typecheck && pnpm -r build && pnpm -r test && pnpm test:e2e` and grep consumers repo-wide before any push (labui-two-test-layers-e2e gate). This is the chapter's exit gate for the whole epic.
