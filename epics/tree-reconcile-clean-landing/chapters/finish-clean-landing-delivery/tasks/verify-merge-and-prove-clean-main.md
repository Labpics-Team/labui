---
id: verify-merge-and-prove-clean-main
chapter: finish-clean-landing-delivery
epic: tree-reconcile-clean-landing
title: "Isolated review PASS → mark #51 ready → merge → prove clean main + guard BITES"
status: ready
priority: 1
depends_on:
  - triage-and-green-the-gates
  - close-redundant-pr-50
blocks: []
agent_profile:
  category: deep
  skills: [dive-git, dive-github, verification-receive]
started: null
completed: null
refine_after: []
---

# Isolated review PASS → mark #51 ready → merge → prove clean main + guard BITES

## What
1. **Isolated verification** (⛔ #4 — no self-verification): run 2 independent reviewers on the FINAL #51 state + CodeRabbit as arbiter. Verify the CodeRabbit verdict is a REAL review via `gh api repos/Labpics-Team/labui/pulls/51/reviews` — not a rate-limit pass-through (MEMORY: coderabbit-credits-exhausted). Receive findings via `verification-receive`; fix ALL (including any pre-existing surfaced by the guard) before merge. Any code edit after review re-opens the gate ([[daniil-merge-review-rule]]).
2. **RED-proof the guard BITES** (CREED #4): on the branch, transiently reintroduce a forbidden loose artifact (e.g. touch `.audit-icons-x.png`) and run `scripts/guard-no-loose-artifacts.sh` / `packages/guard/test/clean-landing.test.ts` → it MUST fail. Restore. A green-from-birth guard is a bug. Capture the RED then GREEN.
3. **Mark #51 ready-for-review** (it is currently DRAFT) and merge per repo policy (squash/PR-only — never push to main, never `--force`/`--no-verify`, ⛔ #3). Confirm base is `main`.
4. **Prove the invariant:** on main, `git pull` then `git status --porcelain` → assert EMPTY. Capture verbatim as the headline exit evidence. Re-confirm the named loose artifacts absent and `git ls-files packages/icons` = intended set.
5. **Graphiti episode** (group `daniel-agent-local`): invariant locked, PR #51 link + merge SHA, final clean-status proof, guard RED-proof reference, sca triage verdict, #50 closed. 1 topic = 1 episode.

## Must NOT Do
- Do NOT claim "done" on a self-asserted or rate-limited CodeRabbit pass (⛔ #4).
- Do NOT commit to main directly; no `--force` / `--no-verify` (⛔ #3).
- Do NOT include the two stashes in this PR — they are CH-02 (`reconcile-deferred-stashes`).
- Do NOT mark green by relaxing the guard or the EXTERNAL-FAILURE bar.

## Verification
- [ ] Isolated review PASS received; CodeRabbit verdict confirmed a real review via `gh api`; all findings resolved on the final state.
- [ ] Guard RED-proven (fails on a reintroduced loose artifact) then restored GREEN — captured.
- [ ] PR #51 merged to main (PR-only, CI green at merge).
- [ ] `git status --porcelain` on main EMPTY — captured verbatim; named artifacts absent; `git ls-files packages/icons` = intended set.
- [ ] Graphiti episode written.

## References
- `packages/guard/test/clean-landing.test.ts`, `scripts/guard-no-loose-artifacts.sh` (on #51) — the guard to RED-prove.
- MEMORY: `coderabbit-credits-exhausted-2026-06-14.md`; `daniil-merge-review-rule.md`; `labui-two-test-layers-e2e-gate.md`.
