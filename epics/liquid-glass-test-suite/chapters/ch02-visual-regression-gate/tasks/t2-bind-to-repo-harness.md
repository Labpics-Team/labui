---
id: t2-bind-to-repo-harness
chapter: ch02-visual-regression-gate
epic: liquid-glass-test-suite
title: "Bind the gate to the repo Playwright/e2e harness per the ch01 wiring decision"
status: placeholder
priority: 1
depends_on:
  - t1-port-gate-and-state-matrix
blocks:
  - t3-freeze-baseline-linux
agent_profile:
  category: visual-engineering
  skills: [craft-qa]
started: null
completed: null
refine_after:
  - t1-wiring-and-pure-extraction
---

# Bind the gate to the repo harness

Will be refined after ch01-t1 (wiring decision) completes. The shape — whether the gate is a `liquid-glass.spec.ts` under `apps/docs/tests` that shells the ported node gate and asserts `verdict.pass`, or the gate runs as a standalone script invoked by a `test:e2e`-adjacent npm script, and which baseline dir path it uses — depends on the locked wiring. Do NOT pre-specify on assumptions.
