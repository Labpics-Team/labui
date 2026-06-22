---
id: public-api-pin
chapter: declarative-animate
epic: motion-engine-foundation
title: "Wire src/index.ts public exports + pin the public API surface (snapshot test)"
status: ready
priority: 3
depends_on:
  - animate-api-driver
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# Public API surface + pin

## What
Make the package's public surface real and lock it (mirrors the colors-contract-pin discipline).
- Rewrite `packages/motion/src/index.ts` (today the placeholder) to re-export the public API: `animate`, `spring`, `tween`, the reduced-motion helper, the error type(s), and keep `PACKAGE_NAME`. Keep the public surface MINIMAL — internal driver/clock stays unexported.
- Add a pin test (`packages/motion/test/public-api.test.ts`) that imports the built/entry module and asserts the EXACT set of exported names (sorted). A silent add/remove/rename fails CI (invariant 6).
- Confirm `tsup` emits correct `.d.ts`/`.d.cts` for the new exports (build + read dist types).

## Tests (RED first)
- API-pin: exported-names set equals the expected set; adding/removing a name fails (`contract`/regression). RED-proof by temporarily removing an export.

## Must NOT Do
- Export the internal driver/clock or the raw param-validation internals (keep surface minimal).
- Add a runtime dependency.
- Break the dual ESM/CJS/d.ts output (don't edit tsup config; just verify).

## Verification
- [ ] `pnpm --filter @labpics/ui-motion build` emits dist with the new exports + d.ts; pin test green.
- [ ] RED-proof recorded for the pin test.
- [ ] `pnpm --filter @labpics/ui-motion typecheck && test` pass; `dependencies` empty.

## References
- `packages/colors-stub/test/contract.test.ts` — pin-test discipline precedent.
- `packages/motion/src/index.ts` — file to rewrite.
- EPIC.md invariant 6.
