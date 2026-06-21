---
id: extend-scanner-freestanding-literals
chapter: no-hardcoded-colour-guard
epic: colors-contract-pin
title: "Add free-standing-literal detection + path allowlist to the colour scanner"
status: done
priority: 1
depends_on: []
blocks:
  - guard-test-and-detection-proof
agent_profile:
  category: deep
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Add free-standing-literal detection + path allowlist to the scanner

## What
Extend `packages/colors-stub/test/no-literal-colour-fallback.ts` (or add a sibling `no-hardcoded-colour.ts` that reuses its `COLOUR_LITERAL` / `NAMED_COLOURS` / `SYSTEM_COLOURS` constants — prefer reuse to avoid a second colour-literal definition drifting). Add a scanner that finds ANY literal colour token, not only fallbacks:

1. A `FREESTANDING_RE` matching the existing `COLOUR_LITERAL` anywhere in a line (hex, rgb(a)/hsl(a)/hwb/lab/lch/oklab/oklch/color()/color-mix/light-dark functional forms, named + system colours, whole-word for bare identifiers).
2. **Suppress false positives** that the fallback scanner never had to handle:
   - The same line already counted by the fallback scanner is fine to double-report or de-dup — choose one and document it.
   - A `var(--lab-*)` token name contains no colour literal; ensure the scanner does not match inside a custom-property NAME.
   - Comments and the `NAMED_COLOURS`/`SYSTEM_COLOURS` table lines inside the scanner itself must be excluded (the scanner files are already excluded in `targetFiles()` — keep that).
3. A NAMED, commented `ALLOWLIST` of exact relative paths where colour literals are legitimate:
   - `packages/colors-stub/contract.css`
   - `packages/shadow/src/generated/shadow.css`
   - `packages/core/src/materials.css`
   Each entry carries a comment: contract = the contract; the two generated/material files = provisional engine-gap values documented in `docs/external-deps/lab-colors.md` (CH-03). Note: generated files already excluded via `/src/generated/` in the base `targetFiles()` — verify materials.css (NON-generated) is explicitly allowlisted, since it lives in plain `src/`.
4. Extend the governed glob to `packages/**/*.{ts,tsx,css}` (scope is `packages/*` per the brief; `apps/docs` fixtures may stay on the existing fallback rule — do NOT silently drop apps coverage, just keep the hardcoded-literal guard scoped to packages as specified). Keep existing excludes (`dist/`, `node_modules/`, `src/generated/`, scanner files).
5. Export `scanHardcoded(): Violation[]` (same `Violation` shape: file/line/snippet).

## Must NOT Do
- Do NOT weaken or remove the existing fallback scanner or its tests (the #23/#24/#31 class must stay closed).
- Do NOT add `contract.css` colour values to git history elsewhere / do NOT move them; only allowlist their existing file.
- Do NOT fake or alter any colour value to pass the scan; if a real free-standing literal exists in a component, that is a finding — fix it by replacing with the correct `--lab-*` role (and report), never by widening the allowlist to hide it.
- Do NOT touch the lab-colors repo.

## Verification
- [ ] `scanHardcoded()` over the live tree returns ZERO violations (after any genuine leak found is fixed by role substitution).
- [ ] Feeding a synthetic string `'.x{color:#fff}'` through the pure scan function returns 1 violation with the right file:line.
- [ ] Feeding a line from `contract.css` while marking its path allowlisted returns 0.
- [ ] `pnpm --filter @labpics/colors typecheck` passes.

## References
- `packages/colors-stub/test/no-literal-colour-fallback.ts` — reuse `COLOUR_LITERAL`, `NAMED_COLOURS`, `SYSTEM_COLOURS`, `targetFiles()`, `repoRoot`, `Violation`.
- `packages/colors-stub/contract.css`, `packages/shadow/src/generated/shadow.css`, `packages/core/src/materials.css` — the allowlist members.
