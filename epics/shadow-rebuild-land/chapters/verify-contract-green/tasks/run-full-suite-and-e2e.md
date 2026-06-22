---
id: run-full-suite-and-e2e
chapter: verify-contract-green
epic: shadow-rebuild-land
title: "Run full unit/typecheck/biome suite + shadow e2e, fix to green"
status: ready
priority: 2
depends_on:
  - verify-consumed-contract-and-guards
blocks:
  - open-pr-and-changeset
agent_profile:
  category: deep
  skills: [craft-qa, craft-frontend]
started: null
completed: null
refine_after: []
---

# Run full unit/typecheck/biome suite + shadow e2e, fix to green

## What
Run the FULL gate against the landed coherent tree and drive every failure to green by a CLASS-level fix (craft-qa), never a patch:
- `pnpm -r typecheck` → exit 0.
- `pnpm -r build` → exit 0 (shadow CSS regenerates; demo builds).
- `pnpm -r test` → exit 0 (includes shadow `stack.test.ts` on the s1..s4 ladder, the new order-only test, the new consumed-not-reinvented guard, and the colors-stub guards).
- `biome check .` → clean.
- `pnpm test:e2e` (`apps/docs/tests/shadow.spec.ts`) on **Chromium AND WebKit** → all PASS, INCLUDING the design-non-regression locks: `:204` five-elevation-surface luminance ordering, `:254` 60ch body measure, `:293` visible-heading IA, plus reduced-motion. No REVISE-LEDGER finding (A0–A4, W1–W11) may reopen.
Record evidence per command (exit code + key assertion). Hand any non-trivial failure that implies a design change back up (do not silently alter the closed-finding behaviour).

## Must NOT Do
- Do NOT mark green without an isolated PASS (CLAUDE.md ⛔ test-театр) — verification-runner re-runs independently.
- Do NOT skip WebKit (the locks are proven on both engines).
- Do NOT regress a CLOSED ledger finding to make another test pass — if they conflict, STOP and escalate.

## Verification
- [ ] `pnpm -r typecheck` / `pnpm -r build` / `pnpm -r test` / `biome check .` all exit 0 (captured output).
- [ ] `pnpm test:e2e` PASSES on Chromium + WebKit; `:204`/`:254`/`:293` green.
- [ ] verification-runner reproduces the green suite in isolation (not self-reported).

## References
- `apps/docs/tests/shadow.spec.ts` — the e2e locks (branch version has the 5-size ladder + regression tests).
- `packages/shadow/test/stack.test.ts` — unit suite.
- REVISE-LEDGER.md — the closed findings that must stay closed.
