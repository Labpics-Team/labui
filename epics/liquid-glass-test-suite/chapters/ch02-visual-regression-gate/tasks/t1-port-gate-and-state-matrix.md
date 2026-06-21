---
id: t1-port-gate-and-state-matrix
chapter: ch02-visual-regression-gate
epic: liquid-glass-test-suite
title: "Port lg-qadiff2 gate (pane+panel, state matrix, in-page diff, CDP reduced-transparency) into the repo"
status: ready
priority: 1
depends_on: []
blocks:
  - t2-bind-to-repo-harness
agent_profile:
  category: visual-engineering
  skills: [craft-qa, craft-frontend]
started: null
completed: null
refine_after: []
---

# Port the lg-qadiff2 gate into the repo

## What
Create a repo-resident copy of the gate logic from `C:/Users/Daniel/lg-qadiff2.mjs`, dropping all external Windows/@playwright absolute paths and the foreign `REF` dir. Keep INTACT:
- Capture of BOTH `#pane` and `#panel` every state (ELEMENTS table).
- The full STATES data table (OCP — array of descriptors): dark-rest, light-rest, drag, dispersion(0.9), big-corner(60/70), distinct-geo (pane size override → different geoKey), panel-strength/panel-blur/panel-geo (panel lens via panelParams CSS overrides — test-only, no engine change), refraction-0, reduced-transparency, depth-default(bg:2), body-tail(bg:2). Reconcile and FINALIZE the exact state list; that list defines the baseline count.
- The in-page `diffPng` (mean/max/pctChanged>4) and the threshold `meanDelta>1 || maxDelta>8 || pctChanged>1`.
- The `settle(expectLens)` poll (feImage decoded href) + warm-up sequence (shoot first / distinct-geo / first) — load-bearing for determinism.
- `prefers-reduced-transparency` via raw CDP `Emulation.setEmulatedMedia` in its own browser context.
- Per-state param/size reset so states don't leak.
- `baseline` and `diff` modes; baseline writes PNGs to a REPO-RELATIVE dir (decided in t2).

Serve `prototypes/liquid-glass/` (which contains index.html + playground.js exposing `window.__paneGlass`/`window.__panelGlass`) from a repo-relative http server.

## Must NOT Do
- Do NOT change the threshold, the state semantics, or the warm-up — they are proven.
- Do NOT touch the engine; panelParams/params are CSS custom-property overrides applied at runtime for the shot only, then reset. No engine edit.
- Do NOT freeze the baseline here on Windows — that is t3, on Linux. This task makes the gate RUN and produce a verdict; the committed baseline comes later.
- Do NOT hardcode `C:/Users/...` anywhere.

## Verification
- [ ] `diff` mode runs end-to-end against the repo engine and prints a JSON verdict with one row per state×element.
- [ ] All 14-ish states are present and both elements captured (count printed).
- [ ] reduced-transparency state runs in its CDP-emulated context without throwing.
- [ ] No external absolute path remains (grep the new file).

## References
- `C:/Users/Daniel/lg-qadiff2.mjs` — full source to port (STATES, diffPng, settle, warm-up, CDP, baseline/diff modes).
- `prototypes/liquid-glass/index.html` — #pane, #panel, #bgs swatches.
- `prototypes/liquid-glass/playground.js:41-42` — window.__paneGlass / __panelGlass.
