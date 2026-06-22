---
id: replay-onto-main
epic: shadow-rebuild-land
title: "Replay the shadow rebuild onto current main, shadow-only"
user_story: "technical enabler"
enabler_for: "verify-contract-green — the shadow rebuild must sit on current main before any contract/test verification is meaningful."
status: completed
priority: 1
depends_on: []
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [dive-git, craft-frontend, craft-arch]
---

# Replay the shadow rebuild onto current main, shadow-only

## User Story
Technical enabler for: chapter `verify-contract-green`. There is no end user of a rebase; this chapter produces a branch whose diff against main is shadow-only so verification can run against reality.

## Purpose
Take the 3 shadow commits (`f80c2cb`, `a2d9072`, `2839f4d`) off the stale base `6a92b08` and replay them onto current `origin/main` (rebase or cherry-pick onto a fresh `land/shadow-rebuild` branch). Resolve every conflict so the resulting diff vs main is confined to shadow files. The 40k-deletion back-merge path is forbidden.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/cut-landing-branch-and-replay.md` | ready | deep | — |
| `tasks/prove-diff-is-shadow-only.md` | ready | deep | cut-landing-branch-and-replay |
| `tasks/regenerate-shadow-css-artifact.md` | ready | deep | cut-landing-branch-and-replay |

## Exit Criteria — ALL MET (verified 2026-06-22 by grounding)
These ARE the acceptance criteria.
- [x] Given the 3 shadow commits, When replayed onto current `origin/main` as branch `land/shadow-rebuild`, Then `git diff origin/main..land/shadow-rebuild --stat` lists ONLY shadow paths — VERIFIED: merge-base = `edb01bb` = origin/main HEAD; 17-file shadow-only diff (`+1110/-636`), commits `538769c`/`9eaa985`/`6f3f604` on top.
- [x] Given that diff, When inspected, Then ZERO deletions under `packages/core`, `packages/react`, `packages/colors-stub`, `packages/tokens`, `apps/docs/src/components` — VERIFIED in the stat above.
- [x] Given the replayed package, When the generator runs, Then `packages/shadow/src/generated/shadow.css` is coherent — VERIFIED: emits `--lab-shadow-alpha-s1..s4`, `--lab-shadow-{xs,s,m,l,xl}`, `--lab-elevation-*`, tint via `color-mix`.

> NOTE (ground truth): the replay landed on the `land/shadow-rebuild` BRANCH. Main's WORKING TREE separately carries a BROKEN half-applied edit (only `layer.ts` renamed → 14 typecheck errors). Discarding that broken edit and landing the coherent branch as the working tree is the FIRST task of the next chapter, not part of this (already-complete) replay.
