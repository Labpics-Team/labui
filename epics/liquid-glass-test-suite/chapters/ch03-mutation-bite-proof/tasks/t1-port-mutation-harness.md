---
id: t1-port-mutation-harness
chapter: ch03-mutation-bite-proof
epic: liquid-glass-test-suite
title: "Port lg-mutate-test: copy engine, weaken one dimension, re-run ch02 gate, assert FAIL"
status: ready
priority: 1
depends_on: []
blocks:
  - t2-prove-all-ten-caught
agent_profile:
  category: visual-engineering
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Port the mutation harness

## What
Port `C:/Users/Daniel/lg-mutate-test.mjs` into the repo. Drop external absolute paths; point HARDENED at the repo `prototypes/liquid-glass/` and GATE at the ch02-ported gate. Keep the 10 MUTATIONS data table EXACTLY (the find→replace anchors must match the repo engine's text — re-verify each anchor exists in the repo files, since the committed engine is the consolidated final version):
1. lens-strength: `MAX_PULL 0.15 → 0.138` (-8%)
2. dispersion: `k = dispersion * 0.08 → * 0.04`
3. blur: CSS `--lg-radius: 4px → 2px`
4. tint: CSS `--lg-tint-opacity: 0.03 → 0.06`
5. rim-sheen: CSS `::before` top sheen `rgba(...,0.22) → 0.11`
6. depth: CSS `--lg-depth: 40 → 34`
7. saturate: CSS `--lg-saturate: 1.3 → 1.0`
8. brightness: CSS `--lg-brightness: 1.05 → 0.95`
9. contrast: CSS `--lg-contrast: 1.2 → 1.05`
10. reduced-tint-opacity: CSS @media `--lg-tint-opacity: 1 → 0.85`

Per mutation: mkdtemp → cp engine → assert anchor present (throw if not) → patch → run ch02 gate `diff` against the FROZEN repo baseline → caught = (verdict.pass === false). Collect movers. Exit 0 iff all caught.

## Must NOT Do
- Do NOT mutate the committed engine — patch only the temp copy; clean up temp dirs.
- Do NOT change the mutation magnitudes — they are tuned to be small-but-detectable; weakening them risks a false "theater pass".
- Do NOT skip the anchor-presence assertion — a silently-missed anchor would fake a pass.
- Do NOT hardcode external paths.

## Verification
- [ ] Harness runs and prints per-dimension `caught` + movers + `allCaught`.
- [ ] Each anchor is confirmed present in the repo engine files (re-grepped, since committed engine is the final consolidated version — anchors must still match).
- [ ] After a run, `git status` on `prototypes/liquid-glass/` is clean (no temp leakage into the real engine).

## References
- `C:/Users/Daniel/lg-mutate-test.mjs` — full source (10 MUTATIONS, runGate, allCaught).
- `prototypes/liquid-glass/liquid-glass.js:44` (MAX_PULL), `:363` (k dispersion).
- `prototypes/liquid-glass/liquid-glass.css:23-29` (knobs), `:71` (sheen 0.22), `:107` (@media tint 1).
