---
id: t3-open-pr
chapter: ch04-ci-wiring-and-pr
epic: liquid-glass-test-suite
title: "Commit engine+tests+baseline, push feat/liquid-glass, open PR — never merge"
status: placeholder
priority: 1
depends_on:
  - t2-ci-yml-and-e2e-gate
blocks: []
agent_profile:
  category: visual-engineering
  skills: [dive-github, dive-git]
started: null
completed: null
refine_after:
  - t2-ci-yml-and-e2e-gate
---

# Open the PR (never merge)

Will be refined after ch04-t2. Locks: commit the uncommitted consolidated engine (liquid-glass.js/css + playground.js) + all test files + the Linux-frozen baseline on branch feat/liquid-glass, push, open a PR via `gh` with a body covering the three test altitudes (unit/cache, visual golden-master, mutation bite-proof), the byte-identical invariant, and the OUT-of-scope notes (no fps, no WebKit lens). CI must be green BEFORE finishing. NEVER merge — the PR is handed to the owner. PR body ends with the Claude Code attribution line.
