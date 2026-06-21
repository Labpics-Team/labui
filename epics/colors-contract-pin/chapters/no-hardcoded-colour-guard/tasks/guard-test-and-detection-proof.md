---
id: guard-test-and-detection-proof
chapter: no-hardcoded-colour-guard
epic: colors-contract-pin
title: "Vitest guard test: zero hardcoded colours live + plant-detect-revert detection proofs"
status: done
priority: 1
depends_on:
  - extend-scanner-freestanding-literals
blocks:
  - wire-guard-into-ci-quality-job
agent_profile:
  category: deep
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Guard test + detection proofs

## What
Add `packages/colors-stub/test/no-hardcoded-colour.test.ts` mirroring the structure of the existing `no-literal-colour-fallback.test.ts` (which is the proven template for "zero live violations + permanent detection proofs"):

1. **Live-tree assertion:** `scanHardcoded()` returns `[]`; failure prints `file:line → snippet` for each violation.
2. **Detection proofs (permanent positive tests)** over synthetic strings via the pure `scanSource`-style function — so a green run means "clean", never "blind":
   - `color: #fff;` → 1 hit
   - `background: rgb(0 0 0);` / `rgba(...)` → hit
   - `border-color: hsl(...)` / `oklch(...)` / `color-mix(...)` / `light-dark(...)` → hit
   - named colour `color: rebeccapurple;` and system colour `background: Canvas;` (whole-word) → hit
   - case-insensitive `#FFF`, `RGB(...)`, `BLACK` → hit
3. **Allowlist proofs:** a synthetic line marked as coming from `contract.css` / `materials.css` / `generated/shadow.css` → 0 hits (the allowlist works).
4. **Negative proofs (no false positives):** a bare `--lab-label-primary` token name → 0; a dimension `0.5rem` / `2px` → 0; a blend-mode keyword `screen` → 0 (reuse the word-boundary correctness already proven for the fallback scanner).
5. **Regression link:** assert the existing fallback scanner test file still exists and its `scanAll()` still returns `[]` (a single cross-check `it` is enough; do not duplicate its whole suite).

## Must NOT Do
- Do NOT mutate the live tree to prove detection — use synthetic strings fed to the pure function (the fallback test already demonstrates this pattern; follow it).
- Do NOT lower any assertion to make a real leak pass; a live violation is fixed by role substitution upstream of this test.

## Verification
- [ ] `pnpm --filter @labpics/colors test` runs both the fallback suite and the new suite; both PASS.
- [ ] Each detection-proof `it` fails if its matcher is deleted (spot-check one by temporary deletion, then revert) — RED-proof per testing-standard.
- [ ] `pnpm -r test` green.

## References
- `packages/colors-stub/test/no-literal-colour-fallback.test.ts` — the template (live-zero + plant-detect + allow-cases).
- `packages/colors-stub/test/no-hardcoded-colour.ts` (or extended scanner) from the prior task.
