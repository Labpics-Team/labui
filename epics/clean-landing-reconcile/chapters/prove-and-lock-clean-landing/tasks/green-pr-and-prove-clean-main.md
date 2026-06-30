---
id: green-pr-and-prove-clean-main
chapter: prove-and-lock-clean-landing
epic: clean-landing-reconcile
title: "Open a feature-branch PR, get quality+e2e real GREEN, merge, prove clean main"
status: ready
priority: 1
depends_on:
  - install-loose-artifact-guard
  - correct-state-json-assumption
blocks: []
agent_profile:
  category: deep
  skills: [dive-git, dive-github, verification-receive]
started: null
completed: null
refine_after: []
---

# Open a feature-branch PR, get quality+e2e real GREEN, merge, prove clean main

## What
Deliver the guard + this epic's tracked markdown behind a PR — never commit to `main` directly (CLAUDE.md ⛔ #3).

1. Create a feature branch (e.g. `chore/clean-landing-guard`). Stage ONLY: the `.gitignore` hardening, the CI guard step (+ optional `scripts/guard-no-loose-artifacts.sh`), and `epics/clean-landing-reconcile/**`. Minimal diff (CREED #6).
2. Push, open the PR via `gh`. Wait for checks.
3. Read `gh pr checks <pr>`. Require BOTH `quality` and `e2e` GREEN. Apply the **EXTERNAL-FAILURE TRIAGE policy**: a red check is acceptable ONLY if every failure is proven external/pre-existing — reproduce it on `main` (checkout main, run the same step) and cite the log excerpt + the main repro. Otherwise fix the branch until genuinely green. Do NOT widen tolerance after the fact (CREED #9).
4. Run isolated verification per CLAUDE.md (2 reviewers / CodeRabbit arbiter), receive via `verification-receive`, fix all (incl. pre-existing surfaced by the guard) before merge.
5. Merge the PR. Then on `main`: `git pull`, run `git status --porcelain` → assert EMPTY. Capture as the final exit-criterion evidence.
6. Write a Graphiti episode: invariant locked, PR link, final clean-status proof, guard RED-proof reference.

## Must NOT Do
- Do NOT commit to `main` directly or use `--no-verify` / `--force` (⛔ #3).
- Do NOT claim "done" on a self-asserted or rate-limited "CodeRabbit pass" — require an isolated PASS with evidence (⛔ #4, MEMORY: coderabbit-credits-exhausted).
- Do NOT include the two stashes in this PR — they are CH-02.
- Do NOT mark green by relaxing the guard or the EXTERNAL-FAILURE TRIAGE bar.

## Verification
- [ ] PR opened from a feature branch (not main); diff limited to guard + .gitignore + this epic's markdown.
- [ ] `gh pr checks <pr>`: `quality` GREEN, `e2e` GREEN (or each red failure triaged external with cited main-repro evidence).
- [ ] Isolated review PASS received and all findings resolved (CREED #10 — no theater).
- [ ] After merge, `git status --porcelain` on `main` is EMPTY — captured verbatim.
- [ ] Graphiti episode written.

## References
- `.github/workflows/ci.yml` — the `quality` + `e2e` jobs the PR must turn green.
- `../../../EPIC.md` — EXTERNAL-FAILURE TRIAGE policy (Notes).
- MEMORY: `coderabbit-credits-exhausted-2026-06-14.md` — green CR check can be a rate-limit pass-through; verify via `gh api .../reviews`.
