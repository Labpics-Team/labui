---
id: ch03-mutation-bite-proof
epic: liquid-glass-test-suite
title: "Class-D mutation harness — prove the visual gate genuinely bites on all 10 dimensions"
user_story: "technical enabler"
enabler_for: "Underlying user benefit: the guarantee that the Liquid Glass look is protected is itself TRUE — a gate that can't catch a deliberate break is theater. This is the epic's RED bite-proof (TDD-RED nuance: the golden-master gate passes on the correct engine; the genuine red is here)."
status: draft
priority: 1
depends_on:
  - ch02-visual-regression-gate
refine_after:
  - t1-port-gate-and-state-matrix
parallel_group: ""
agent_profile:
  category: visual-engineering
  skills: [craft-qa]
---

# Class-D mutation harness — the RED bite-proof

## User Story
Technical enabler, and the epic's genuine TDD-RED. For EACH of the 10 effect dimensions (lens/MAX_PULL, dispersion, blur, tint, rim-sheen, depth, saturate, brightness, contrast, reduced-tint-opacity), deliberately WEAKEN it in a throwaway copy of the engine and assert the ch02 visual gate FAILS (pass:false). allCaught == true is the proof the gate is not theater.

## Purpose
Port `lg-mutate-test.mjs`: for each mutation descriptor (data table — find→replace that weakens ONE dimension), copy the repo engine to a temp dir, patch the copy, run the ch02 gate (`diff` mode) against the patched copy vs the FROZEN repo baseline, and assert it reports `pass:false`. Record which states/elements moved (movers) as evidence the right dimension triggered it. Exit non-zero unless every dimension is caught.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/t1-port-mutation-harness.md` | ready | visual-engineering | (ch02) |
| `tasks/t2-prove-all-ten-caught.md` | placeholder | visual-engineering | t1-port-mutation-harness |

## Exit Criteria
- [ ] **Given** the frozen repo baseline (ch02) and the repo engine, **When** the mutation harness runs, **Then** for each of the 10 dimensions the patched copy makes the ch02 gate report `pass:false` (caught), and the harness prints `allCaught: true` and exits 0.
- [ ] **Given** each caught dimension, **When** inspected, **Then** the movers (failing state/element) are the expected ones (e.g. lens-strength moves panel-strength/depth-default; dispersion moves dispersion; reduced-tint-opacity moves reduced-transparency) — proving the dimension, not noise, triggered the fail.
- [ ] **Given** the harness, **When** run, **Then** it copies the engine to a temp dir per mutation and never mutates the committed engine (the real engine git-diff stays clean).
