---
"@labpics/ui-materials": minor
"@labpics/ui-docs": patch
---

Land ADR-0004 contrast guarantees: corridor worst-case, byte-exact composite, and
the text-on-complex-background ladder.

- **Corridor guarantee (ADR-0004 Решение 2).** Generalise the α-boundary to one
  math parametrised by the reachable **backdrop corridor**. `evaluateTier` now
  accepts `{ backdrop }` (a `BackdropCorridor`, default `[black, white]` —
  byte-identical to the prior behaviour); `bandOverCorridor` /
  `worstContrastOverBand` are the shared primitives the tier evaluator and the
  ladder both use (no duplicated numbers). `cornerCorridor` / `unionCorridor`
  build a corridor from a sampled region and from two adjacent regions. The
  corridor is two backdrop **colours** (per-channel extremes), not L-scalars, so
  the monotonicity proof stays honest; corner backdrops bound the reachable set
  from outside → the guarantee is conservative, never over-promised.
- **Byte-exact composite (task #52).** `compositeOverByte` quantises the
  straight-alpha composite to the 8-bit channel the display commits
  (`Uint8ClampedArray` round-half-even). Proven byte-for-byte (zero tolerance)
  against lab-colors' SSOT `composite_over_encoded` on the 12 Figma-neutral pairs;
  the material contract domain is proven tie-free (so round-half-even ≡
  lab-colors' round-half-away here); the composited contract pixels are frozen in
  a **versioned** golden (bump `GOLDEN_VERSION` + CHANGELOG on re-bless). The docs
  differential drops its `LUM_TOLERANCE` and compares against the real canvas pixel
  **byte-exact** — verified equal across Chromium and WebKit (gap 0).
- **Legibility ladder (task #58).** `legibility-ladder.ts` resolves a label on any
  background to a proven corridor guarantee or a mandatory scrim floor: solid →
  direct; material → `[black, white]` corridor; readable image → region corridor →
  forced `computeScrimFloor` if unreachable; cross-origin/tainted → scrim mandatory
  by contract (structurally never `guaranteed`); boundary-crossing → `unionCorridor`.
  Pure domain (no DOM import); the `getImageData` try/catch → tainted read is a thin
  consumer adapter.
