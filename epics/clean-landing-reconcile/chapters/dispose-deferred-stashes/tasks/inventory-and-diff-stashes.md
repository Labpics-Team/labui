---
id: inventory-and-diff-stashes
chapter: dispose-deferred-stashes
epic: clean-landing-reconcile
title: "Inventory each stash and diff it against main to find unique/unlanded work"
status: ready
priority: 1
depends_on: []
blocks:
  - recommend-and-escalate-disposition
agent_profile:
  category: deep
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Inventory each stash and diff it against main to find unique/unlanded work

## What
For BOTH `stash@{0}` (pre-restart-20260622-0136) and `stash@{1}` (colors-contract-pin-GREEN-wip-recovery):

1. `git stash show --include-untracked --stat stash@{N}` — full file list (already captured at planning: 54 and 29 files respectively; re-confirm).
2. `git diff main...stash@{N}` (and for untracked-in-stash content, inspect via `git stash show -p`) to determine, file-by-file: **already landed on main** (identical/superseded) vs **unique/unlanded** (content that exists nowhere on main).
3. Cross-check the on-disk tracked state: `git ls-files epics/colors-contract-pin packages/parity epics/figma-parity-harness` and compare. (`epics/colors-contract-pin/` IS tracked on main → stash@{1} is likely superseded; `packages/parity` + `epics/figma-parity-harness` are NOT tracked on main → stash@{0} holds genuinely unlanded work.)
4. Produce a per-stash inventory table: file → landed/unique → evidence. Append to this task and mirror to Graphiti.

## Must NOT Do
- Do NOT `git stash pop`/`apply`/`drop` — read-only inspection only in this task. (Apply/drop is the next task, gated on owner confirmation for drops.)
- Do NOT modify the working tree (it must stay clean — CH-01's invariant holds during CH-02).

## Verification
- [ ] Per-stash `--stat` re-captured and matches (or supersedes with explanation) the planning snapshot.
- [ ] Per-stash landed-vs-unique inventory produced with `git diff` / `git ls-files` evidence.
- [ ] Working tree still EMPTY (`git status --porcelain`) after inspection.

## References
- `../../../EPIC.md` — Ground Truth lists both stashes' file sets.
- MEMORY: `pulse-design-state` / labui parity+VRT notes — context on whether figma-parity is active.
