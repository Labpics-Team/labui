---
id: no-hardcoded-colour-guard
epic: colors-contract-pin
title: "CI guard fails the build on any literal colour anywhere in packages/* outside the allowlisted contract file"
user_story: "As the design-system maintainer, I want CI to reject any literal colour committed anywhere in the package sources, so that the only place a colour value can live is the contract file and a component can never silently bypass the --lab-* boundary with a baked-in hex."
enabler_for: ""
status: ready
priority: 2
depends_on: []
refine_after: []
parallel_group: foundation
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
---

# Strengthen the no-hardcoded-colour guard to cover ALL literal colours

## User Story
As the design-system maintainer, I want CI to reject any literal colour committed anywhere in the package sources, so that the only place a colour value can live is the contract file and a component can never silently bypass the `--lab-*` boundary with a baked-in hex.

## Purpose
Today `packages/colors-stub/test/no-literal-colour-fallback.ts` only catches a literal colour used as a `var()`/`litVar()` FALLBACK. A free-standing `color: #fff;` or `background: rgb(0,0,0);` is NOT caught. This chapter extends the guard to fail on ANY literal hex/rgb(a)/hsl(a)/hwb/lab/lch/oklab/oklch/color()/color-mix/light-dark/named/system colour ANYWHERE under `packages/**/*.{css,tsx,ts}`, with a tight, named ALLOWLIST for legitimate value-bearing files:
- `packages/colors-stub/contract.css` (the contract — colours ARE its content),
- `packages/shadow/src/generated/shadow.css` + `packages/core/src/materials.css` (provisional engine-gap values — declared, documented in CH-03; allowlisted by exact path with a comment pointing at the external blocker),
- the scanner's own files and its NAMED_COLOURS table.

Failure output MUST name the offending `file:line` and the literal. Closes the CLASS "a literal colour leaks into a component anywhere" — superset of the existing fallback-only class, which is kept intact.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/extend-scanner-freestanding-literals.md` | ready | deep | — |
| `tasks/guard-test-and-detection-proof.md` | ready | deep | extend-scanner-freestanding-literals |
| `tasks/wire-guard-into-ci-quality-job.md` | ready | deep | guard-test-and-detection-proof |

## Exit Criteria
- [ ] Given any package source, When the guard runs in CI, Then it scans all `.css/.tsx/.ts` under `packages/*` and FAILS on any literal hex/rgb/hsl/named/system colour outside the allowlisted contract/engine-gap files, naming the offending `file:line`.
- [ ] Given the allowlisted contract file (`contract.css`) and the documented engine-gap files, When the guard runs, Then their colour literals do NOT trigger a failure.
- [ ] Given a planted free-standing literal (`color: #fff;`) in a non-allowlisted file, When the guard's detection-proof test runs, Then it is detected (proving the guard is not blind).
- [ ] Given the existing fallback-only guard, When the suite runs, Then ALL its current assertions still pass (no regression of the #23/#24/#31 class).
- [ ] Given the gate, When `pnpm -r test` runs (and the CI quality job), Then it passes clean on the live tree.
