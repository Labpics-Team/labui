---
id: prove-diff-is-shadow-only
chapter: replay-onto-main
epic: shadow-rebuild-land
title: "Prove the replayed diff vs main is shadow-only with zero unrelated deletions"
status: done
priority: 1
depends_on:
  - cut-landing-branch-and-replay
blocks:
  - regenerate-shadow-css-artifact
agent_profile:
  category: quick
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Prove the replayed diff vs main is shadow-only with zero unrelated deletions

## What
Run `git diff --stat origin/main..land/shadow-rebuild` and assert the path set is a subset of the allowed shadow files. Then run `git diff --numstat origin/main..land/shadow-rebuild` and assert there are NO entries deleting files under `packages/core`, `packages/react`, `packages/colors-stub`, `packages/tokens`, `apps/docs/src/components`, or any `*-demo`/`*.doc.ts`/`*.spec.ts` other than `shadow.spec.ts`. This is the gate that catches a botched replay.

## Must NOT Do
- Do NOT accept "it builds" as a substitute for the path-set proof — a back-merge also builds while silently deleting components.
- Do NOT proceed if a single non-shadow file appears in the diff; return to the replay task.

## Verification
- [ ] Allowed-path assertion passes (paths ⊆ shadow set).
- [ ] Deletion-scan finds zero deletions outside the shadow set.
- [ ] Evidence (the diff --stat output) is recorded in the task on completion.

## References
- Allowed set: `packages/shadow/**`, `apps/docs/src/shadow-demo.ts`, `apps/docs/src/shadow-demo.css`, `apps/docs/src/shadow.html`, `apps/docs/tests/shadow.spec.ts`, `.changeset/materials-shadow-stack.md`.
