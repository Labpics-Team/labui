---
id: finish-clean-landing-delivery
epic: tree-reconcile-clean-landing
title: "Finish & merge PR #51 real-green; prove clean main; correct STATE.json; close redundant #50"
user_story: "technical enabler"
enabler_for: "Every later visual/feature scope in labui, which all assume the clean-landing invariant holds from the start. A clean, guard-protected main is the foundation they build on."
status: ready
priority: 1
depends_on: []
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [dive-git, dive-github, verification-receive]
---

# Finish & merge PR #51 real-green; prove clean main; correct STATE.json

## User Story
Technical enabler for: every later labui scope. There is no end user; this guarantees the substrate (clean main + enforced no-loose-artifact invariant + a single honest state of record) so later work is not built on drift. A fabricated "as a developer I want a clean tree" story would be theater (P7) — this is honestly an enabler.

## Purpose
The reconciliation is already implemented on branch `ship/tree-reconcile-state-clean-landing` behind draft PR #51. This chapter drives it to a real-green merge: re-confirm the ground truth, correct the STATE.json assumption in the state of record, get `quality` + `e2e` real-green (triaging the live `sca` flake per the EXTERNAL-FAILURE policy), close redundant PR #50, run isolated verification, merge, and prove `git status --porcelain` on main is EMPTY.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/reground-and-correct-state-json.md` | ready | quick | — |
| `tasks/triage-and-green-the-gates.md` | ready | deep | reground-and-correct-state-json |
| `tasks/close-redundant-pr-50.md` | ready | quick | — |
| `tasks/verify-merge-and-prove-clean-main.md` | ready | deep | triage-and-green-the-gates, close-redundant-pr-50 |

## Exit Criteria
These ARE the acceptance criteria (P7) — phrased Given/When/Then.
- [ ] **Given** main today, **When** `git status --porcelain` runs, **Then** output is verified EMPTY and the named loose artifacts are confirmed absent (re-grounded at execution time, not assumed).
- [ ] **Given** the STATE.json assumption, **When** the executor checks `ls STATE.json`, **Then** it returns nothing AND the EPIC + a Graphiti episode record the assumption FALSE; no STATE.json is created or referenced.
- [ ] **Given** PR #51, **When** `gh pr checks 51` is read, **Then** `lint · typecheck · build` (quality) and `playwright smoke` (e2e) are BOTH GREEN — any red check triaged external with a cited main-repro, never relaxed; and `sca` is either green or its red is proven a Trivy-DB/registry flake with log evidence (no masked HIGH/CRITICAL finding).
- [ ] **Given** PR #50 is a strict subset of #51, **When** #51 is ready, **Then** #50 is closed as superseded with a comment linking #51 (no parallel double-landing).
- [ ] **Given** an isolated review (CodeRabbit arbiter + 2 reviewers) verified via `gh api .../reviews` (not a bare green check), **When** all findings are resolved, **Then** PR #51 is merged and `git status --porcelain` on main is captured EMPTY as final evidence.
