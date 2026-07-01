---
id: discard-broken-edit-land-coherent-tree
chapter: order-only-contract-and-guard
epic: shadow-rebuild-land
title: "Discard the broken half-applied staged layer.ts edit; land the coherent land/shadow-rebuild tree; typecheck green"
status: ready
priority: 1
depends_on: []
blocks:
  - order-only-contract-test
  - consumed-not-reinvented-guard
agent_profile:
  category: deep
  skills: [dive-git, craft-arch]
started: null
completed: null
refine_after: []
---

# Discard the broken half-applied staged layer.ts edit; land the coherent tree

## What
On a fresh branch cut from current `origin/main` (e.g. `land/shadow-rebuild-final`), make the working tree match the COHERENT shadow rebuild from `land/shadow-rebuild`:
1. Discard the broken staged edit on main: the only-`layer.ts`-renamed state that leaves `SHADOW_LAYERS`/`LAYER_SHAPES`/`ShadowLayerName`/`ShadowLayerShape` imported but undefined in `alpha-contract.ts`, `elevation.ts`, `box-shadow.ts`, `generate-css.ts`, `index.ts`, `test/stack.test.ts`.
2. Bring in the full coherent set from `land/shadow-rebuild` (cherry-pick its 3 shadow commits onto the fresh branch, or `git checkout land/shadow-rebuild -- packages/shadow apps/docs/src/shadow* apps/docs/tests/shadow.spec.ts .changeset/materials-shadow-stack.md`) so every shadow file consistently uses `SHADOW_SLOTS`/`s1..s4`.
3. Confirm the diff vs `origin/main` is shadow-only (17 files, zero component/token/colors-stub deletions).
4. Run `pnpm --filter @labpics/ui-shadow typecheck` and `pnpm -r typecheck` — both must exit 0.

Output: a fresh branch off current main whose working tree typechecks, with a shadow-only diff.

## Must NOT Do
- Do NOT build the order-only test or the guard on top of the broken tree — fix the baseline FIRST (a red baseline hides regressions).
- Do NOT back-merge `fix/shadow-owner-verdict` (40,335-deletion catastrophe).
- Do NOT hand-edit `packages/shadow/src/generated/shadow.css` — it is generated; if it must change, change `config.ts`/domain and regenerate.
- Do NOT touch the colors-stub `--lab-fx-shadow-*` family — out of scope.

## Verification
- [ ] `pnpm --filter @labpics/ui-shadow typecheck` exits 0 (was 14 errors).
- [ ] `grep -rn 'SHADOW_LAYERS\|LAYER_SHAPES\|ShadowLayerName\|ShadowLayerShape' packages/shadow/src` returns ZERO matches (the layer→slot rename is complete and consistent).
- [ ] `git diff --stat origin/main..HEAD` lists only `packages/shadow/**`, `apps/docs/src/shadow*`, `apps/docs/tests/shadow.spec.ts`, `.changeset/materials-shadow-stack.md`.
- [ ] `pnpm -r typecheck` exits 0.

## References
- `packages/shadow/src/domain/layer.ts` — the renamed definition (coherent on the branch, half-applied on main).
- `land/shadow-rebuild` (merge-base `edb01bb` = origin/main) — the coherent source of truth.
- EPIC.md "The HAZARD" section — the broken-state diagnosis.
