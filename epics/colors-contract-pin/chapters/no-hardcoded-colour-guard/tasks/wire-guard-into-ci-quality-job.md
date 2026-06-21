---
id: wire-guard-into-ci-quality-job
chapter: no-hardcoded-colour-guard
epic: colors-contract-pin
title: "Ensure the guard runs in CI (vitest via pnpm test, or an explicit quality-job step)"
status: done
priority: 2
depends_on:
  - guard-test-and-detection-proof
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa, devops-deploy]
started: null
completed: null
refine_after: []
---

# Ensure the guard runs in CI

## What
Confirm and make explicit that the new guard executes in the CI `quality` job.

Default path (lowest blast radius): the guard test lives in `packages/colors-stub`, whose `test` script is reached by root `pnpm test` → `pnpm -r --if-present test`, which the `quality` job already runs. VERIFY this by reading `.github/workflows/ci.yml` (the `Unit tests` step = `pnpm test`) and confirming colors-stub's `vitest run` picks up the new spec.

OPTIONAL louder failure (decide and justify): if a dedicated, explicitly-named step is wanted so the guard failure is unmistakable in the CI log, add a small node script `scripts/check-no-hardcoded-colour.mjs` that imports `scanHardcoded()` and `process.exit(1)` on violations, and add ONE step to the `quality` job AFTER `Lint (Biome)`:
```yaml
      - name: No hardcoded colours
        run: node scripts/check-no-hardcoded-colour.mjs
```
Keep SHA-pinned actions, `permissions: contents: read`, `persist-credentials: false`, concurrency-cancel — do NOT alter those. Prefer the test-only path unless the owner wants the explicit step; record the decision in the task verification.

## Must NOT Do
- Do NOT add write permissions, secrets, or new external actions to ci.yml.
- Do NOT duplicate the scan logic in the script — import it from the single scanner module.
- Do NOT push to main; this lands via PR with CI green (RULE-3).

## Verification
Decision: DEFAULT test-only path (lowest blast radius) — no dedicated script/step added,
so CI permissions/actions are untouched. The guard runs as an ordinary vitest spec.
- [x] Read ci.yml and confirm the guard is reached. `quality` job step `Unit tests: pnpm test` (ci.yml:53-54) → root `test: pnpm -r --if-present test` (package.json) → `@labpics/colors` `test: vitest run`, which collects `test/no-hardcoded-colour.test.ts` (42 cases). Confirmed locally: `pnpm test` runs colors-stub `vitest run` = 76 pass.
- [x] No script added (default path chosen), so the script-exit check is N/A.
- [x] `pnpm lint` / `pnpm run format:check` pass — 333 files, 0 (no new script; existing spec/scanner stay biome-clean).

## References
- `.github/workflows/ci.yml` — `quality` job, `Unit tests: pnpm test` step.
- `package.json` — root `test: pnpm -r --if-present test`.
- craft-devops — least-privilege CI; do not broaden permissions.
