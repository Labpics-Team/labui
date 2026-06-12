---
"@labpics/ui-shadow": minor
---

Add `@labpics/ui-shadow`: the LabUI layered shadow stack as a pure, deterministic
generator producing the `--lab-shadow-*` / `--lab-elevation-*` CSS contract.

- **Four semantic layers** — Minor / Ambient / Penumbra / Major — composed as a
  layered `box-shadow` (sum of Gaussians of growing width; not a shader).
- **Four elevation roles** — `resting` / `raised` / `overlay` / `modal` — the
  same four-ply stack scaled by one depth + one alpha damping. Delivered as both
  `--lab-elevation-*` custom properties (theme-anchor tint) and `.lab-elevation-*`
  utility classes (per-surface tint resolves at the element).
- **One global light angle** — `--lab-light-angle` (default `35deg` from
  vertical) drives every ply's x/y offset (`offset-x = throw·sin`,
  `offset-y = throw·cos`); there is no per-level angle.
- **Surface-tinted, never pure black** — shadow colour reads
  `--lab-surface-shadow-tint` from the `--lab-*` core contract, falling back to
  the theme dark anchor (`#101012`), never an inline `#000`.
- **Alpha contract seam** — per-layer alphas come from
  `--lab-shadow-alpha-{minor,ambient,penumbra,major}`, carrying PROVISIONAL Figma
  values (light @1/@2/@4/@12, dark @2/@4/@12/@20). lab-colors' JND-calibrated
  alphas swap in at the same names with zero geometry change (filed in
  `INTEGRATION.md`).
- Light/dark themes differ only in variable values, never in the `box-shadow`
  formula — switching theme is a variable swap.

The docs app gains a `shadow.html` demo (elevation cards × light/dark × live
light-angle) and a Playwright smoke (contract resolves, theme swap changes the
shadow, the angle token re-derives offsets, tint is never black).
