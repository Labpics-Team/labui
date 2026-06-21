---
id: ch02-visual-regression-gate
epic: liquid-glass-test-suite
title: "Deterministic pane+panel visual-regression gate, baseline re-frozen from this engine"
user_story: "technical enabler"
enabler_for: "Underlying user benefit: a designer/consumer of LabUI's Liquid Glass material keeps getting the EXACT tuned look — any future edit that degrades the lens, dispersion, frost, tint, rim, or body becomes a CI failure instead of a silent regression a human has to spot."
status: draft
priority: 1
depends_on:
  - ch01-unit-pure-and-cache
refine_after:
  - t1-wiring-and-pure-extraction
parallel_group: ""
agent_profile:
  category: visual-engineering
  skills: [craft-qa, craft-frontend]
---

# Deterministic pane+panel visual-regression gate

## User Story
Technical enabler. This is the CHARACTERIZATION / golden-master layer: it captures the current correct render as truth and fails on any pixel drift. It legitimately PASSES on the correct engine (do NOT force it red at birth — the RED proof is ch03's mutation harness).

## Purpose
Port the proven `lg-qadiff2.mjs` deterministic pixel gate into the repo's Playwright/Node harness: serve `prototypes/liquid-glass/` from a repo-relative server, drive BOTH `#pane` AND `#panel` (the 2nd instance is the only real exercise of the cross-instance cache) across the full state matrix, pixel-diff each against a baseline COMMITTED to the repo and RE-FROZEN from this engine, at threshold meanDelta<1 OR maxDelta<8 OR pctChanged<1. The state matrix (data table, OCP) covers: rest in dark + light over the high-contrast grid, a drag, dispersion=0.9, big-corner (corner 60 / depth 70), distinct-geometry (pane resized so pane and panel hold different geoKeys → 2 live cache entries), refraction=0 (plain-frost opt-out), prefers-reduced-transparency (CDP-emulated, lens dropped), plus the panel-lens and body/depth sentinel states from the reference. The baseline MUST be frozen in the CI-equivalent (Linux Chromium) environment, not the Windows dev box.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/t1-port-gate-and-state-matrix.md` | ready | visual-engineering | (ch01) |
| `tasks/t2-bind-to-repo-harness.md` | placeholder | visual-engineering | t1-port-gate-and-state-matrix |
| `tasks/t3-freeze-baseline-linux.md` | placeholder | visual-engineering | t2-bind-to-repo-harness |
| `tasks/t4-determinism-and-sanity-xcheck.md` | placeholder | visual-engineering | t3-freeze-baseline-linux |

## Exit Criteria
- [ ] **Given** the repo engine and the committed baseline, **When** the gate runs in `diff` mode headless Chromium (workers:1), **Then** verdict is PASS — every state×element under meanDelta<1 OR maxDelta<8 OR pctChanged<1.
- [ ] **Given** BOTH #pane and #panel, **When** any state runs, **Then** both elements are captured and diffed (panel is never skipped), and the distinct-geo state holds 2 live cache entries (cross-checked via `__cacheStats()` during the run).
- [ ] **Given** prefers-reduced-transparency, **When** the state runs, **Then** it is emulated via raw CDP `Emulation.setEmulatedMedia` (not the Playwright test API, which can't), the lens is dropped, and the opaque-fallback render matches its frozen baseline.
- [ ] **Given** the baseline PNGs, **When** committed, **Then** they were frozen in a Linux Chromium environment matching CI (not Windows), the committed count equals exactly the state-matrix × elements count (reconciled, not the stale "16"/"26"), and a sanity cross-check vs the external `lg-qa-baseline2` shows the render shape matches expectation (large divergence investigated before trusting).
- [ ] **Given** 3 consecutive `diff` runs, **When** compared, **Then** the verdict is stably PASS (no flake) — warm-up sequence preserved.
