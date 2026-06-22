---
id: cut-landing-branch-and-replay
chapter: replay-onto-main
epic: shadow-rebuild-land
title: "Cut land/shadow-rebuild from current main and replay the 3 shadow commits"
status: done
priority: 1
depends_on: []
blocks:
  - prove-diff-is-shadow-only
  - regenerate-shadow-css-artifact
agent_profile:
  category: deep
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Cut land/shadow-rebuild from current main and replay the 3 shadow commits

## What
1. `git fetch origin` and branch `land/shadow-rebuild` from current `origin/main`.
2. Replay the shadow work via `git cherry-pick f80c2cb a2d9072 2839f4d` (or an interactive rebase of `fix/shadow-owner-verdict` onto `origin/main` keeping only those 3). Cherry-pick is preferred — it cannot accidentally drag the stale deletions.
3. Resolve conflicts so that the ONLY files touched relative to main are the shadow set. Likely conflict points: `packages/shadow/package.json` (version), `.changeset/materials-shadow-stack.md`, and any shadow file that main also touched after PR #7.
4. Commit the resolved replay.

## Must NOT Do
- Do NOT `git merge fix/shadow-owner-verdict` into main — that reverts 22 PRs (40,335 deletions).
- Do NOT touch any file outside the shadow set to "resolve" a conflict.
- Do NOT hand-edit `packages/shadow/src/generated/shadow.css` (that is the next task's generated output).
- Do NOT weaken or delete any guard test to make the rename land.

## Verification
- [ ] `git log --oneline origin/main..land/shadow-rebuild` shows the replayed shadow commit(s) and nothing reverting merged PRs.
- [ ] `git diff --stat origin/main..land/shadow-rebuild` is confined to the shadow file set.

## References
- `packages/shadow/src/domain/alpha-contract.ts` — layer→slot rename + DARK_ALPHA_MULTIPLIER lives here.
- `packages/shadow/src/config.ts` — light-angle + shadow-colour-fallback SSOT.
- Merge-base is `6a92b08` (PR #7); the branch predates PRs #26–#47.
