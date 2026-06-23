---
id: inventory-and-classify-stashes
chapter: reconcile-deferred-stashes
epic: tree-reconcile-clean-landing
title: "Diff both stashes vs main; classify each keep / promote / drop with evidence"
status: ready
priority: 1
depends_on: []
blocks:
  - escalate-and-execute-disposition
agent_profile:
  category: deep
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Diff both stashes vs main; classify each keep / promote / drop with evidence

## What
1. `git stash list` → confirm the two: `stash@{0}` pre-restart-20260622-0136, `stash@{1}` colors-contract-pin-GREEN-wip-recovery.
2. For each stash: `git stash show -p stash@{N}` and diff its content against current main. Determine whether each hunk is ALREADY landed (e.g. `packages/core/src/css.ts` / `colors-stub` changes may be in merged PRs #41/#45/#47, or in the colors-contract-pin epic) or still absent.
3. Classify each stash:
   - **drop-safe** — all content already on main (superseded WIP);
   - **promote** — contains wanted edits not yet on main → belongs to an owning scope's PR (likely `colors-contract-pin` for stash@{1}; tokens/docs for stash@{0});
   - **keep** — ambiguous, defer with a reason.
4. Record the classification + per-stash evidence in `epics/tree-reconcile-clean-landing/stash-dispositions.json` (mirror the schema already used on the existing reconcile branch if present).

## Must NOT Do
- Do NOT `git stash drop` or `git stash pop` anything in this task — classification only (pop/apply mutate; drop is irreversible).
- Do NOT promote content into this epic's PR — promotion goes to the owning scope.

## Verification
- [ ] Both stashes diffed vs main; each hunk traced to landed/absent with cited commit or "absent".
- [ ] `stash-dispositions.json` written with a verdict + evidence per stash.

## References
- EPIC Notes — stash list + irreversibility constraint.
- `epics/colors-contract-pin/EPIC.md` — likely owning scope for stash@{1} content.
- Recent merged PRs #41/#45/#47 — candidate landing points for colors-stub/css.ts hunks.
