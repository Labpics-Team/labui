---
id: prove-and-lock-clean-landing
epic: clean-landing-reconcile
title: "Prove the clean tree and lock the invariant under CI"
user_story: "technical enabler"
enabler_for: "Every later labui scope (icons-build, parity, etc.) — each assumes a clean, honest baseline; this chapter proves that baseline holds and guards it from silent regression."
status: ready
priority: 1
depends_on: []
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [dive-git, dive-github, craft-qa, craft-devops]
---

# Prove the clean tree and lock the invariant under CI

## User Story
Technical enabler for: every later labui scope. There is no end user; this chapter makes the substrate honest and keeps it honest, so a fabricated "As a developer I want a clean tree" story is deliberately avoided (P7).

## Purpose
Two parts. First, **prove** the substrate is already honest: re-ground on the tree at execution time, confirm `git status --porcelain` is empty and STATE.json is absent, and explicitly verify each named artifact class (audit PNGs/dirs, demo scaffolds, orphan icons files, the 7 named modified files) is absent — not merely hidden. If grounding finds the tree dirty (e.g. a stash was popped between planning and execution), this chapter expands to its full classify-each-path-to-an-owning-scope-or-delete form before proceeding. Second, **lock** the invariant: install the smallest CI/.gitignore guard that fails when a known loose-artifact class is re-introduced, so the class of "substrate drift" cannot silently return. Deliver behind a feature-branch PR whose `quality` + `e2e` checks are real GREEN, then merge and re-prove an empty status on main.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/reground-and-classify-tree.md` | ready | deep | — |
| `tasks/correct-state-json-assumption.md` | ready | quick | — |
| `tasks/install-loose-artifact-guard.md` | ready | deep | reground-and-classify-tree |
| `tasks/green-pr-and-prove-clean-main.md` | ready | deep | install-loose-artifact-guard, correct-state-json-assumption |

## Exit Criteria
These ARE the acceptance criteria — phrased Given/When/Then.
- [ ] **Given** the repo at execution time, **When** `git status --porcelain --untracked-files=all` is run on the working branch, **Then** it is EMPTY — specifically no `?? .audit-icons-*.png`, `?? .audit-ux/`, `.pw-audit/`, `.peertmp/`, `_provenance/`, `_typography-*.png`, no `?? apps/docs/src/icons*-demo.*` or `icons*.html`, no `?? icons-variant-v1-screenshot.png`, and none of the 7 named modified files dangling.
- [ ] **Given** the repo, **When** `ls STATE.json` is run, **Then** it returns nothing, and this epic + Graphiti (not an on-disk file) hold the state of record; no task reads or writes STATE.json.
- [ ] **Given** `git ls-files packages/icons`, **When** listed, **Then** it equals exactly the intended set (today: `package.json`, `src/index.ts`, `tsconfig.json`, `tsup.config.ts`) with no orphan untracked files under `packages/icons/src/{data/,react.tsx,registry.ts,render.ts,types.ts}` or `packages/icons/{NOTICE,scripts/}`.
- [ ] **Given** a deliberately-introduced loose artifact (e.g. `touch .audit-icons-x.png`), **When** the guard runs in CI, **Then** the `quality` check FAILS (RED-proven), and removing the artifact restores GREEN — proving the guard bites (CREED #4).
- [ ] **Given** the feature-branch PR, **When** `gh pr checks <pr>` is read, **Then** BOTH `quality` and `e2e` are real GREEN (or triaged external per the EXTERNAL-FAILURE TRIAGE policy with cited evidence); **and after merge** `git status --porcelain` on `main` is EMPTY.
