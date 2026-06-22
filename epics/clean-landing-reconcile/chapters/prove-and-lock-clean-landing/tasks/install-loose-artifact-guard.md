---
id: install-loose-artifact-guard
chapter: prove-and-lock-clean-landing
epic: clean-landing-reconcile
title: "Install a CI guard + .gitignore hardening that bites on loose-artifact classes"
status: ready
priority: 1
depends_on:
  - reground-and-classify-tree
blocks:
  - green-pr-and-prove-clean-main
agent_profile:
  category: deep
  skills: [craft-qa, craft-devops, dive-github]
started: null
completed: null
refine_after: []
---

# Install a CI guard + .gitignore hardening that bites on loose-artifact classes

## What
Cleaning the tree once is a patch; the CLASS is "loose audit/demo artifacts get committed or left untracked and rot the baseline." Close the class with two small, layered defences (root-cause: nothing currently prevents re-introduction — `.gitignore` has no `.audit-*`, `_provenance`, `_typography`, `.pw-audit`, `.peertmp`, `icons*-demo`, `icons-variant-*` entries; CI never checks for a dirty/forbidden tree).

1. **`.gitignore` hardening** (prevents the untracked-clutter half): add the loose-artifact glob classes so they never appear as `??` again — `.audit-icons-*.png`, `_typography-*.png`, `icons-variant-*-screenshot.png`, `.audit-ux/`, `.pw-audit/`, `.peertmp/`, `_provenance/`. Group them under a clearly-commented "Audit / review scratch — never committed, regenerated on demand" block alongside the existing `screenshots/` block.
2. **CI guard step** (prevents the committed half — what `.gitignore` can't catch if someone `git add -f`s): add a step to the `quality` job in `.github/workflows/ci.yml` (after "Unit tests", line ~55) that FAILS if any forbidden-class path is *tracked*. Implement as a single shell step running `git ls-files` piped against the forbidden globs (audit PNGs, audit dirs, `apps/docs/src/icons*-demo.*`, `icons*.html` scaffolds), exiting non-zero with a clear message naming the offending path. Keep it laconic — no new script package, no abstraction (CREED #8). Prefer a small inline step or one committed `scripts/guard-no-loose-artifacts.sh` if the inline form is unreadable.
3. **RED-prove the guard bites** (CREED #4): on the branch, `git add -f` a fake `.audit-icons-x.png`, run the guard locally / push, confirm the `quality` check goes RED and the message names the file; then remove it and confirm GREEN. Record the RED-then-GREEN evidence. A guard that is green-from-birth against the forbidden class is a bug.

## Must NOT Do
- Do NOT broaden the guard to lint product code or touch other CI jobs beyond the one added step.
- Do NOT add the guard to `e2e` — it belongs in `quality`.
- Do NOT introduce a new dependency or a heavyweight framework for a 10-line check.
- Do NOT gitignore `epics/` or any tracked path.

## Verification
- [ ] `.gitignore` contains the forbidden-class globs under a commented block; `git status` still EMPTY after the edit (the block changes only the .gitignore file).
- [ ] CI `quality` job has exactly one new guard step; `pnpm lint`/`format:check`/`typecheck`/`build`/`test` still pass.
- [ ] RED-proof captured: forbidden artifact force-added → `quality` RED naming the file → artifact removed → `quality` GREEN.
- [ ] Guard does not false-positive on the current clean tree (run it on HEAD, exits 0).

## References
- `.github/workflows/ci.yml` — `quality` job starts line 20; add step after "Unit tests" (line ~55). `e2e` job starts line 57.
- `.gitignore` — existing `screenshots/` block ("Ad-hoc demo screenshots") is the natural neighbour for the new block.
- `package.json` scripts — `lint`, `format:check`, `typecheck`, `build`, `test`, `test:e2e` (the real check surface).
