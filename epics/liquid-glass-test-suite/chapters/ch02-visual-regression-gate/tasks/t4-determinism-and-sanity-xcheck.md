---
id: t4-determinism-and-sanity-xcheck
chapter: ch02-visual-regression-gate
epic: liquid-glass-test-suite
title: "Prove determinism (3x stable PASS) and sanity cross-check vs external baseline"
status: placeholder
priority: 2
depends_on:
  - t3-freeze-baseline-linux
blocks: []
agent_profile:
  category: visual-engineering
  skills: [craft-qa]
started: null
completed: null
refine_after:
  - t3-freeze-baseline-linux
---

# Determinism + sanity cross-check

Will be refined after ch02-t3. Locks: 3 consecutive `diff` runs all PASS (no flake) in the CI-equivalent env; and a one-time sanity diff of the repo-frozen baseline vs the external `C:/Users/Daniel/lg-qa-baseline2` to confirm the render SHAPE matches expectation (small delta expected from OS/checkout differences; a LARGE divergence means something is wrong and must be investigated before the baseline is trusted as truth).
