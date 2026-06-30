---
id: reground-and-classify-tree
chapter: prove-and-lock-clean-landing
epic: clean-landing-reconcile
title: "Re-ground on the tree and classify every path to owning-scope-or-delete"
status: ready
priority: 1
depends_on: []
blocks:
  - install-loose-artifact-guard
agent_profile:
  category: deep
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Re-ground on the tree and classify every path to owning-scope-or-delete

## What
Do NOT trust the planning-time snapshot — re-run the ground checks at execution time, because a stash could have been popped or new work landed since 2026-06-23.

1. Run and capture: `git status --porcelain --untracked-files=all`, `git stash list`, `git ls-files packages/icons`, `ls STATE.json`.
2. **If status is EMPTY** (expected per planning): record PASS with the captured output as evidence. For each named artifact class below, assert absence explicitly and note that `git check-ignore -v <path>` returns nothing (proves deleted, not merely ignored):
   - audit PNGs: `.audit-icons-*.png`, `_typography-*.png`, `icons-variant-v1-screenshot.png`
   - audit dirs: `.audit-ux/`, `.pw-audit/`, `.peertmp/`, `_provenance/`
   - demo scaffolds: `apps/docs/src/icons*-demo.*`, `apps/docs/src/icons*.html`
   - orphan icons files: `packages/icons/src/{data/,react.tsx,registry.ts,render.ts,types.ts}`, `packages/icons/{NOTICE,scripts/}`
   - the 7 named modified files: `packages/icons/{package.json,src/index.ts,tsconfig.json,tsup.config.ts}`, `apps/docs/{package.json,vite.config.ts}`, `pnpm-lock.yaml` — confirm each is unmodified (not in `git status`).
3. **If status is DIRTY** (the contingency branch): classify EACH path — either it belongs to an owning scope (then it is committed by that scope's PR, not here — FLAG it to the owner and STOP for that path) or it is a loose artifact (then delete it). Re-run step 2 after cleaning. Never absorb out-of-scope work silently (CREED #5).
4. Output: a short classification table (path → verdict → evidence) appended to this task's Verification section and mirrored to Graphiti.

## Must NOT Do
- Do NOT `git stash drop` / `git stash pop` — stash disposition is CH-02 and needs owner confirmation.
- Do NOT touch product code, UI, or other-team zones.
- Do NOT create or read STATE.json.
- Do NOT delete `epics/colors-contract-pin/` — it is tracked + committed, not an artifact.

## Verification
- [ ] `git status --porcelain --untracked-files=all` output captured and is EMPTY (or every dirty path classified + FLAGGED/deleted with evidence).
- [ ] Each named artifact class asserted absent; `git check-ignore` shown returning nothing for a representative sample.
- [ ] `git ls-files packages/icons` shown equal to the 4-file intended set.

## References
- `../../../EPIC.md` — Ground Truth section (planning-time snapshot to compare against).
- Exit-criteria of the parent CHAPTER.md.
