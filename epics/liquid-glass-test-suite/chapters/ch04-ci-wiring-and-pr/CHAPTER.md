---
id: ch04-ci-wiring-and-pr
epic: liquid-glass-test-suite
title: "Lint clean, wire all suites into CI, open the PR (never merge)"
user_story: "technical enabler"
enabler_for: "Underlying user benefit: every future PR that touches the Liquid Glass engine is automatically held to the byte-identical picture + bounded-memory contract — the protection runs without anyone remembering to run it."
status: draft
priority: 2
depends_on:
  - ch01-unit-pure-and-cache
  - ch02-visual-regression-gate
  - ch03-mutation-bite-proof
refine_after:
  - t1-wiring-and-pure-extraction
parallel_group: ""
agent_profile:
  category: visual-engineering
  skills: [craft-devops, craft-qa, dive-github]
---

# CI wiring + PR

## User Story
Technical enabler. Make the three suites run in CI exactly as the existing pipeline runs (`pnpm lint`/`format:check`/`typecheck`/`build`/`test` in the quality job, `pnpm test:e2e` in the e2e job, Node 22, Playwright 1.49.1, Chromium for the lens gate), ensure Biome 1.9.4 is clean on `prototypes/liquid-glass`, then open a PR on feat/liquid-glass — never merge.

## Purpose
Bind: unit + cache + scratch + mutation into `pnpm test` (via the `@labpics/ui-docs` test script `pnpm -r --if-present test` picks up); the visual gate into the e2e path (`pnpm test:e2e`), Chromium-only with workers:1, ensuring the WebKit project does not run the lens gate (or skips cleanly). Confirm `pnpm build` still passes with the prototype not a workspace member. Fix any lint/format the suite or a reviewer surfaces — without altering engine output. Commit the uncommitted consolidated engine + all test assets + the Linux-frozen baseline, push, open the PR with a body describing the three test altitudes and the byte-identical invariant.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/t1-lint-clean-and-pnpm-test-wiring.md` | placeholder | visual-engineering | (ch01,ch03) |
| `tasks/t2-ci-yml-and-e2e-gate.md` | placeholder | visual-engineering | t1-lint-clean-and-pnpm-test-wiring |
| `tasks/t3-open-pr.md` | placeholder | visual-engineering | t2-ci-yml-and-e2e-gate |

## Exit Criteria
- [ ] **Given** `prototypes/liquid-glass` + the new test files, **When** `pnpm lint` and `pnpm run format:check` run, **Then** both pass with zero new suppressions beyond the one pre-existing biome-ignore.
- [ ] **Given** the repo, **When** `pnpm test` runs locally and in CI, **Then** unit + cache + scratch + mutation all run and pass on Node 22.
- [ ] **Given** the repo, **When** `pnpm test:e2e` runs in the CI e2e job, **Then** the visual gate runs Chromium-only (workers:1), passes against the committed Linux baseline, and the existing component specs + WebKit project are unaffected (lens gate does not run/false-fail under WebKit).
- [ ] **Given** `pnpm build`, **When** CI runs it, **Then** it passes (prototype not a workspace member, or proven safe if it is).
- [ ] **Given** all green, **When** the agent finishes, **Then** a PR is OPEN on feat/liquid-glass with a descriptive body, CI green, and it is NOT merged.
