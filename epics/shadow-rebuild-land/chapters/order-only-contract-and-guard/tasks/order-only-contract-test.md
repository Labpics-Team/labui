---
id: order-only-contract-test
chapter: order-only-contract-and-guard
epic: shadow-rebuild-land
title: "Add an order-only contract test on the provisional shadow ramp (relative order, never absolute magnitude)"
status: ready
priority: 2
depends_on:
  - discard-broken-edit-land-coherent-tree
blocks:
  - record-external-base-blocker
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch]
started: null
completed: null
refine_after: []
---

# Add an order-only contract test on the provisional shadow ramp

## What
Add a unit test (`packages/shadow/test/`) that locks ONLY the RELATIVE ORDER the stack depends on, because the magnitudes are PROVISIONAL (Figma stub alphas; lab-colors JND calibration pending). Assert:
- **Alpha order**: `SLOT_ALPHA.s1 > SLOT_ALPHA.s2 > SLOT_ALPHA.s3 > SLOT_ALPHA.s4` (strictly decreasing — slot 1 is the near sharp contact ply, slot 4 the far diffuse ply). Use `SLOT_ALPHAS` and assert strict monotonic decrease.
- **Size-ladder order**: the five elevation/size rungs (xs<s<m<l<xl, mapped to resting<raised<…<modal) produce strictly INCREASING geometric throw (derive each rung's effective blur/offset magnitude from the domain and assert strict monotonic increase). This is a property over the whole ramp, not a hand-picked pair.
- A **negative/RED proof**: include (or have verification-runner demonstrate) that swapping any adjacent pair flips the assertion to FAIL — proving the test bites.

The test asserts the INVARIANT (an ordering relation), closing the CLASS "ramp order silently inverts", not a single magnitude patch (craft-qa: close the class).

## Must NOT Do
- Do NOT assert any absolute magnitude (no `expect(SLOT_ALPHA.s1).toBe(0.12)`, no absolute px/rem blur values). Absolute base is an EXTERNAL dependency (next task records it as a blocker). Asserting absolutes would fabricate a contract the external engine has not finalized (CLAUDE.md ⛔ подлог).
- Do NOT weaken or duplicate the existing `stack.test.ts` assertions — extend the suite.
- Do NOT read magnitudes from the generated CSS as a backdoor to absolute assertions — assert the order of the domain values / derived geometry.

## Verification
- [ ] New test PASSES on the coherent tree (`pnpm --filter @labpics/ui-shadow test`).
- [ ] RED-proof: reordering any adjacent alpha pair OR any size rung makes the test FAIL (verification-runner confirms, isolated).
- [ ] `grep` of the new test shows NO absolute-magnitude assertion (only relational `>`/`<`/monotonic checks).
- [ ] `biome check` clean on the new test file.

## References
- `packages/shadow/src/domain/layer.ts` — `SLOT_ALPHA` / `SLOT_ALPHAS` (the alpha ramp).
- `packages/shadow/src/domain/elevation.ts` + `box-shadow.ts` — the size/geometry ladder source.
- `packages/shadow/test/stack.test.ts` — existing suite to extend.
- craft-qa — Class C property/invariant test; close the class, not the patch.
