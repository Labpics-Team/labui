---
id: dispose-deferred-stashes
epic: clean-landing-reconcile
title: "Give the two stashes an explicit, owner-confirmed disposition"
user_story: "technical enabler"
enabler_for: "Clean-landing invariant durability — a clean status that hides 83 files of un-tracked deferred work in stashes is honest about the tree but dishonest about the project; this chapter closes that gap."
status: ready
priority: 2
depends_on:
  - prove-and-lock-clean-landing
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [dive-git]
---

# Give the two stashes an explicit, owner-confirmed disposition

## User Story
Technical enabler for: clean-landing durability. No end user; avoiding a fabricated story (P7).

## Purpose
`git status` clean is necessary but not sufficient for an honest substrate: two stashes hold real, deferred work that will otherwise rot or be lost to a future `git gc` / `reflog` expiry with nobody having decided its fate.
- `stash@{0}` = `pre-restart-20260622-0136` — the **figma-parity-harness** epic (`packages/parity/*`, `apps/docs/tests/parity/*`, `epics/figma-parity-harness/*`, 54 files). MEMORY (`pulse-design-state`, labui parity notes) suggests parity/VRT is live work — likely *promote*, not drop.
- `stash@{1}` = `colors-contract-pin-GREEN-wip-recovery` — work whose committed counterpart already landed (PRs #41/#44/#45/#47, the on-disk `epics/colors-contract-pin/`). This stash is likely **superseded** → candidate to drop, but only after diffing it against `main` to confirm nothing unique is lost.
This chapter inventories each stash, diffs it against `main` to find what (if anything) is unique/unlanded, and produces a disposition recommendation. **Dropping is irreversible** → STOP and escalate to the owner as a plain business question before any `git stash drop` (CLAUDE.md ⛔ #6, CREED #6). Keeping or promoting-to-an-epic is reversible and may proceed.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/inventory-and-diff-stashes.md` | ready | deep | — |
| `tasks/recommend-and-escalate-disposition.md` | ready | deep | inventory-and-diff-stashes |

## Exit Criteria
- [ ] **Given** both stashes, **When** each is diffed against `main` (`git diff main stash@{N}` + unique-file list), **Then** a written inventory states, per stash, what is already-landed vs unique/unlanded, with evidence.
- [ ] **Given** the inventory, **When** a disposition is proposed (keep-with-rationale / promote-to-epic / drop), **Then** the recommendation is recorded AND — for any `drop` — the owner has explicitly confirmed in plain language before execution; no stash is dropped on agent say-so.
- [ ] **Given** the chosen disposition, **When** executed, **Then** `git stash list` reflects the decision and Graphiti records each stash's final fate + evidence; no deferred work is in undecided limbo.
