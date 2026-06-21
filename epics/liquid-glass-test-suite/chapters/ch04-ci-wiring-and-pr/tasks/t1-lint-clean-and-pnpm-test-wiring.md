---
id: t1-lint-clean-and-pnpm-test-wiring
chapter: ch04-ci-wiring-and-pr
epic: liquid-glass-test-suite
title: "Biome lint+format clean on prototype + tests; wire unit/cache/mutation into pnpm test"
status: placeholder
priority: 1
depends_on: []
blocks:
  - t2-ci-yml-and-e2e-gate
agent_profile:
  category: visual-engineering
  skills: [craft-devops, craft-qa]
started: null
completed: null
refine_after:
  - t1-wiring-and-pure-extraction
---

# Lint clean + pnpm test wiring

Will be refined after ch01-t1 (locks the test script location/name) and ch03-t1 (the mutation script exists). Locks: `pnpm lint` + `pnpm run format:check` pass on `prototypes/liquid-glass` + all new test files (Biome 1.9.4, no new suppressions beyond the pre-existing `prefers-reduced-transparency` biome-ignore); the `@labpics/ui-docs` (or chosen) `test` script runs unit + cache + scratch + mutation so `pnpm test` (= `pnpm -r --if-present test`) executes them. Note: gate/cache scripts use `console.log` for verdicts — Biome's `noConsoleLog` is `warn` (not error); confirm the new files don't trip lint as errors, route verbose logs to stderr/`console.error` or scope-ignore if needed.
