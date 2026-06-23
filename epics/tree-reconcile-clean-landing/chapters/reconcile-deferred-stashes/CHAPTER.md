---
id: reconcile-deferred-stashes
epic: tree-reconcile-clean-landing
title: "Disposition the two deferred stashes (keep / promote / drop) — owner-gated on any DROP"
user_story: "technical enabler"
enabler_for: "A truly clean state of record — no off-tree work-in-progress silently rotting in stashes that the clean main hides. Unblocks confident future work on packages/core, tokens, colors-stub."
status: ready
priority: 2
depends_on: []
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [dive-git]
---

# Disposition the two deferred stashes — owner-gated on any DROP

## User Story
Technical enabler for: an honest, fully-reconciled state. The clean `git status` hides two stashes that still hold real edits (colors-contract-pin recovery WIP, a pre-restart snapshot). Leaving them indefinitely is silent drift in a different form. No end user — honest enabler, not a fabricated story (P7).

## Purpose
Two stashes exist: `stash@{0}` (pre-restart-20260622-0136 — apps/docs/package.json, packages/tokens/src/index.ts, pnpm-lock.yaml) and `stash@{1}` (colors-contract-pin-GREEN-wip-recovery — INTEGRATION.md, colors-stub, core/css.ts, core/package.json, pnpm-lock.yaml). Each must be classified: already-landed (drop-safe), still-wanted (promote to its owning scope's PR), or obsolete (drop — owner-gated). A `git stash drop` is irreversible once gc-expired, so any DROP STOPS for owner confirmation (⛔ #6).

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/inventory-and-classify-stashes.md` | ready | deep | — |
| `tasks/escalate-and-execute-disposition.md` | ready | deep | inventory-and-classify-stashes |

## Exit Criteria
- [ ] **Given** both stashes, **When** each is diffed against current main, **Then** each is classified keep / promote / drop with cited evidence (e.g. "already in commit X" → drop-safe; "not on main" → promote/keep), recorded in `stash-dispositions.json`.
- [ ] **Given** any stash classified DROP, **When** disposition runs, **Then** the executor STOPS and asks the owner a plain business question ("keep this saved work / build it next / throw it away?") and only drops after explicit confirmation — never autonomously.
- [ ] **Given** any stash classified PROMOTE, **When** acted on, **Then** its content lands via its owning scope's PR (not main directly), not this epic's PR.
- [ ] **Given** all dispositions executed, **When** `git stash list` runs, **Then** it reflects the recorded decisions and a Graphiti episode captures the outcome.
