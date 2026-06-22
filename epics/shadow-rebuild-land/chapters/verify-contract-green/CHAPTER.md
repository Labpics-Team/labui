---
id: verify-contract-green
epic: shadow-rebuild-land
title: "Verify consumed contract preserved + full test/guard suite green, then PR"
user_story: "As a labui consumer (a downstream app styling surfaces with --lab-shadow-* tokens), I want the rebuilt shadow stack to keep the same consumed --lab-* contract names and pass every guard, so that my surfaces get the new 5-size ladder without my stylesheets breaking."
enabler_for: ""
status: ready
priority: 3
depends_on:
  - order-only-contract-and-guard
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [craft-qa, craft-frontend, craft-arch]
---

# Verify consumed contract preserved + full test/guard suite green, then PR

## User Story
As a labui consumer styling surfaces with `--lab-shadow-*` tokens, I want the rebuilt shadow stack to preserve the consumed `--lab-*` contract names and pass every guard, so that the new 5-size ladder ships without breaking downstream stylesheets.

## Purpose
With the coherent tree landed and the two new locks (order-only contract test + consumed-not-reinvented guard) in place, prove the WHOLE gate is green and ship. Verify: consumed-contract + no-hardcoded-colour guards accept the `s1..s4` rename (classified `local-or-gap`, no `unclassified` name); typecheck/build/unit/biome all pass; the shadow e2e (`shadow.spec.ts`, Chromium+WebKit) passes including the design-non-regression locks (dark-ladder ordering `:204`, 60ch measure `:254`, visible-heading IA `:293`); then open the PR. Now refinable because the rename has already met the post-#7 guards on the coherent tree.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/verify-consumed-contract-and-guards.md` | ready | deep | (order-only-contract-and-guard) |
| `tasks/run-full-suite-and-e2e.md` | ready | deep | verify-consumed-contract-and-guards |
| `tasks/open-pr-and-changeset.md` | ready | quick | run-full-suite-and-e2e |

## Exit Criteria
These ARE the user story's acceptance criteria.
- [ ] Given the `s1..s4` `--lab-shadow-alpha-*` contract, When `pnpm --filter @labpics/colors-stub test` runs, Then consumed-contract + no-hardcoded-colour guards PASS — every `--lab-shadow-*`/`--lab-elevation-*`/`--lab-surface-shadow-tint` name classifies `local-or-gap`, ZERO `unclassified`, no literal-colour fallback introduced.
- [ ] Given the rebuilt package, When `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r test`, and `biome check .` run, Then all PASS (including the new order-only test + consumed-not-reinvented guard).
- [ ] Given the docs shadow page, When `pnpm test:e2e` runs `apps/docs/tests/shadow.spec.ts` on Chromium AND WebKit, Then it PASSES (5-size ladder XS..XL, single light angle, surface-tinted vertical) AND the design-non-regression locks `:204`/`:254`/`:293` stay green — no REVISE-LEDGER finding (A0–A4, W1–W11) reopens.
- [ ] Given a green local suite, When a PR is opened against `main`, Then CI is green and the PR carries an accurate changeset; merge waits for owner (merge-review rule) — no self-merge.
