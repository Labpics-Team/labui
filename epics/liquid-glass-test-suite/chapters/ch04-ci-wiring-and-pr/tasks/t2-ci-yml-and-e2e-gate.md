---
id: t2-ci-yml-and-e2e-gate
chapter: ch04-ci-wiring-and-pr
epic: liquid-glass-test-suite
title: "Run the visual gate in the e2e job Chromium-only; verify build + existing specs unaffected"
status: placeholder
priority: 1
depends_on:
  - t1-lint-clean-and-pnpm-test-wiring
blocks:
  - t3-open-pr
agent_profile:
  category: visual-engineering
  skills: [craft-devops]
started: null
completed: null
refine_after:
  - t1-lint-clean-and-pnpm-test-wiring
---

# CI e2e gate wiring

Will be refined after ch04-t1. Locks: the visual gate runs in the existing `e2e` job via `pnpm test:e2e` (Chromium project only, workers:1 in CI), the WebKit project does NOT run the lens gate (skip/guard since WebKit doesn't refract), `pnpm build` still passes (prototype not a workspace member), and the 30+ existing component specs stay green. Decide whether the gate plugs into `apps/docs/playwright.config.ts` as a Chromium-only project/spec or runs as a separate invocation in the e2e job — refined once t1 locks the script shape. Existing ci.yml already installs Chromium+WebKit and runs `pnpm test` (quality job) + `pnpm test:e2e` (e2e job); prefer NOT editing ci.yml beyond what's strictly required.
