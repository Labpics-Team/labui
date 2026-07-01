---
id: record-external-base-blocker
chapter: order-only-contract-and-guard
epic: shadow-rebuild-land
title: "Record the provisional absolute-base dependency as an OPEN external blocker (lab-colors JND)"
status: ready
priority: 3
depends_on:
  - order-only-contract-test
blocks: []
agent_profile:
  category: quick
  skills: [write-docs]
started: null
completed: null
refine_after: []
---

# Record the provisional absolute-base dependency as an OPEN external blocker

## What
The order-only test deliberately asserts NO absolute magnitude. That silence must be DOCUMENTED, not a gap. Add/extend an entry in `docs/external-deps/lab-colors.md` (the engine-gaps doc the colors-stub `LOCAL_OR_GAP_PREFIXES` already references) recording:
- The `--lab-shadow-alpha-s1..s4` absolute alpha VALUES are PROVISIONAL Figma stub values; the FINAL absolute base comes from lab-colors' JND (surface-jnd) calibration, written to the SAME contract names.
- Therefore labui pins only the RELATIVE ORDER (order-only contract test); absolute magnitudes are an OPEN external blocker owned by lab-colors.
- Cross-link the order-only test file so a future reader connects "test asserts no absolute" ↔ "because the absolute is external/pending".

Confirm the colors-stub `engine-gaps doc consistency` test (referenced in `consumed-contract.ts`) still passes — the `--lab-shadow-*` local-or-gap prefix must stay in sync with this doc.

## Must NOT Do
- Do NOT invent a JND value or a delivery date for the external calibration.
- Do NOT mark the blocker resolved — it stays OPEN until lab-colors publishes.

## Verification
- [ ] `docs/external-deps/lab-colors.md` contains the shadow absolute-base blocker entry, cross-linked to the order-only test.
- [ ] The colors-stub engine-gaps consistency test passes (`pnpm --filter @labpics/colors-stub test`).
- [ ] `biome check` / markdown lint clean.

## References
- `packages/colors-stub/test/consumed-contract.ts` — `LOCAL_OR_GAP_PREFIXES` + the engine-gaps doc cross-check.
- `packages/shadow/src/domain/alpha-contract.ts` (or branch equivalent) — the "FINAL values come from lab-colors JND calibration" comment, the SSOT of this gap.
