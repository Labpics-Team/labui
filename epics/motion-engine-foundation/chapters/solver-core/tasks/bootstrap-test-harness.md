---
id: bootstrap-test-harness
chapter: solver-core
epic: motion-engine-foundation
title: "Bootstrap vitest harness for @labpics/ui-motion (zero runtime deps preserved)"
status: ready
priority: 1
depends_on: []
blocks:
  - spring-tween-solver
agent_profile:
  category: deep
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Bootstrap the test harness

## What
Wire vitest into `packages/motion` so the solver tests can run, copying the proven pattern from `packages/core`.
- Add `vitest@2.1.8` (EXACT repo-wide version) to `packages/motion/package.json` `devDependencies`. Do NOT touch `dependencies` — it must stay empty/absent.
- Add `"test": "vitest run"` to `scripts`.
- Create `packages/motion/vitest.config.ts` copied from `packages/core/vitest.config.ts`: `include: ['test/**/*.test.ts']`, `environment: 'node'` (the pure solver needs NO browser/jsdom).
- Create `packages/motion/test/` with a single trivial RED-then-GREEN smoke test that imports the package entry and asserts `PACKAGE_NAME === '@labpics/ui-motion'`, proving the harness runs and the package resolves.
- Run `pnpm install` at root so the lockfile picks up the new devDependency.

## Must NOT Do
- Add ANY runtime dependency (invariant 1). Only `vitest` in devDependencies.
- Add jsdom / happy-dom — the solver is pure node; a DOM env is not needed at this layer.
- Edit `tsup.config.ts` (the `libraryPreset()` is already correct).

## Verification
- [ ] `pnpm --filter @labpics/ui-motion test` runs vitest and the smoke test passes.
- [ ] `packages/motion/package.json` has no `dependencies` key (or empty); `vitest@2.1.8` present in devDependencies.
- [ ] `pnpm --filter @labpics/ui-motion typecheck` passes.

## References
- `packages/core/vitest.config.ts` — config to copy.
- `packages/core/package.json` — `"test": "vitest run"` + vitest pin precedent.
- `packages/motion/package.json` — file to edit; confirm `dependencies` stays empty.
