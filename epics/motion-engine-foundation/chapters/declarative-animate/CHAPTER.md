---
id: declarative-animate
epic: motion-engine-foundation
title: "Declarative animate API + prefers-reduced-motion collapse + typed errors"
user_story: "As a designer using LabUI, I want components to animate with a single declarative call that automatically goes still when I've asked my OS to reduce motion, so that motion is consistent and never makes the UI inaccessible or nauseating."
enabler_for: ""
status: ready
priority: 2
depends_on: [solver-core]
refine_after: []
parallel_group: ""
agent_profile:
  category: deep
  skills: [craft-arch, craft-qa, craft-frontend]
---

# Declarative animate API + reduced-motion contract

## User Story
As a designer using LabUI, I want components to animate with a single declarative call that automatically goes still when I've set `prefers-reduced-motion: reduce`, so that motion is consistent across the system and never makes the UI inaccessible. (INVEST: independent of CH-03 consumer wiring; testable via the exit criteria below.)

## Purpose
Build the public declarative surface on top of CH-01's solver: `animate(target, keyframes, options)`, the injectable reduced-motion policy (`reduced-motion.ts`), the platform driver seam (rAF/clock behind an interface), and typed errors. The reduced-motion policy is the ONLY module that knows the preference exists; `animate` asks it and short-circuits to an instant/near-instant transition when it says reduce — without entering the solver loop. The clock/rAF is injectable so unit tests step time deterministically with no real browser.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/reduced-motion-policy.md` | ready | deep | — |
| `tasks/animate-api-driver.md`    | ready | deep | reduced-motion-policy |
| `tasks/public-api-pin.md`        | ready | deep | animate-api-driver |

## Exit Criteria
(Given/When/Then — these ARE the acceptance criteria.)
- [ ] Given the reduced-motion policy with an injected matcher returning `true`, When `animate(...)` is called, Then it resolves to the final keyframe value in ≤1 tick (instant/near-instant) and the solver's multi-frame loop is NEVER entered — proven by a unit test that spies the driver.
- [ ] Given the reduced-motion policy returning `false` and an injected step-clock, When `animate(...)` runs, Then it advances through the solver producing a monotonic finite progression from `from` toward `to`, ending exactly at `to` — proven by a unit test stepping the clock deterministically (no real rAF).
- [ ] Given any `animate` output value, When written, Then it is always a finite number (CSS-safe) in both preference states — asserted in the unit tests (invariant 2).
- [ ] Given invalid options (non-finite duration, unknown easing), When passed to `animate`, Then it throws a typed `errors.ts` error, not a silent NaN.
- [ ] Given the package's public entry, When the API-pin test runs, Then the exact set of exported names (`animate`, `spring`, `tween`, reduced-motion helper, error types, `PACKAGE_NAME`) is asserted — a silent rename/removal fails CI.
- [ ] Given the whole package, When `pnpm --filter @labpics/ui-motion typecheck && build && test` run, Then all pass and `dependencies` is still empty.
