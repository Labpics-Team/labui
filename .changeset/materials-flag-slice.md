---
"@labpics/ui-materials": minor
"@labpics/ui-docs": patch
---

Add `@labpics/ui-materials`: the material MODE axis as a `data-material="solid|glass|blur"`
scope built strictly on top of the `--lab-*` contract.

- Five tiers (base/muted/soft/subtle/elevated) consumed from the contract's
  `--lab-bg-material-<tier>-01/02` two-layer pairs; solid = 01 over 02 opaque
  (the canon + universal fallback), glass/blur = translucent tint + backdrop
  blur (48/128 from the Figma BG-blur ladder). Zero new `--lab-*` tokens — all
  mechanics are private custom properties.
- **α-boundary guarantee** (pure TS domain): for each glass tier it bounds
  `L_eff = α·L_tint + (1−α)·L_bd` at both backdrop extremes and asserts the
  polarity-committed label clears the WCAG AA floor at both, or flags the pair
  **unguaranteed**. The test parses the generated contract (no copied numbers);
  a golden locks the current unguaranteed set (a finding on the provisional
  Figma-anchor alphas — see the package README).
- **Deterministic degradations** — `@supports` (no backdrop-filter),
  `prefers-reduced-transparency`, `prefers-contrast: more`, and
  `forced-colors: active` all collapse to the opaque solid canon; explicit
  `data-material="solid"` always wins.
- Docs demo `materials-flag.html`: a modal + card flip solid→glass on one
  `data-material` attribute, with a Playwright spec that measures the actual
  backdrop composite changing and the label staying legal in both modes, plus a
  glass-on-glass placement check.
