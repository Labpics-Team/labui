---
id: open-pr-and-changeset
chapter: verify-contract-green
epic: shadow-rebuild-land
title: "Open PR against main with accurate changeset; CI green; hold for owner merge"
status: ready
priority: 3
depends_on:
  - run-full-suite-and-e2e
blocks: []
agent_profile:
  category: quick
  skills: [dive-github, dive-git]
started: null
completed: null
refine_after: []
---

# Open PR against main with accurate changeset; CI green; hold for owner merge

## What
Open a PR against `main` from the landing branch. Ensure `.changeset/materials-shadow-stack.md` accurately describes the landed scope:
- `@labpics/ui-shadow`: layer→slot rename (`SHADOW_LAYERS`→`SHADOW_SLOTS`, `s1..s4` fixed alphas), 5-size ladder XS..XL, surface-tinted vertical stack, motion tokens — semver per changeset convention (a renamed public export = at least minor; confirm against the package's current 0.x policy).
- New invariants: order-only contract test + consumed-not-reinvented guard.
PR body: summarize the CLASS closed (half-applied landing + re-invention), link REVISE-LEDGER closed findings, note the external blocker (absolute base = lab-colors JND, OPEN). Push; confirm CI green. Hold for owner merge.

## Must NOT Do
- Do NOT self-merge (CLAUDE.md ⛔; merge-review rule — owner merges).
- Do NOT push with red CI or skip CI (`--no-verify`/`--force` forbidden).
- Do NOT delete the landing branch until merged.

## Verification
- [ ] PR opened against `main`; changeset present and accurate (semver bump justified).
- [ ] CI green on the PR (verify via `gh` — beware CodeRabbit rate-limit pass-through; check actual review state).
- [ ] PR explicitly states merge waits for owner; not merged by the agent.

## References
- `.changeset/materials-shadow-stack.md` — the changeset to finalize.
- REVISE-LEDGER.md — closed findings to cite.
- `docs/external-deps/lab-colors.md` — the OPEN external blocker to link.
