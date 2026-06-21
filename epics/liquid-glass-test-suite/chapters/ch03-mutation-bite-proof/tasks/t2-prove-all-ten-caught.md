---
id: t2-prove-all-ten-caught
chapter: ch03-mutation-bite-proof
epic: liquid-glass-test-suite
title: "Run the harness against the frozen repo baseline; prove allCaught and capture movers"
status: placeholder
priority: 1
depends_on:
  - t1-port-mutation-harness
blocks: []
agent_profile:
  category: visual-engineering
  skills: [craft-qa]
started: null
completed: null
refine_after:
  - t1-port-mutation-harness
---

# Prove all ten dimensions are caught

Will be refined after ch03-t1. Locks: run the ported harness against the FROZEN repo baseline (ch02-t3), assert `allCaught: true`, and record the movers per dimension as evidence the correct dimension triggered each fail. If any dimension is NOT caught against the Linux-frozen baseline, root-cause (likely a state that doesn't exercise that dimension on Linux raster, or a too-small magnitude) before declaring the gate sound — do not loosen the threshold to force a pass.
