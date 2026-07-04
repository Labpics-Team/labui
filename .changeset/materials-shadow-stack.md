---
"@labpics/ui-shadow": minor
---

Add `@labpics/ui-shadow`: the LabUI shadow stack as a pure, deterministic
generator producing the `--lab-shadow-*` / `--lab-elevation-*` CSS contract,
built on the owner's verbatim Figma effect-style ladder.

- **Five elevation sizes** — `xs` / `s` / `m` / `l` / `xl` — each **exactly
  four** drop-shadow plies, transcribed verbatim from the owner's effect styles.
  At the default vertical light the generated CSS reproduces the source table
  ply-for-ply (a unit test pins the byte-for-byte match).
- **Fixed per-slot alphas** — `s1 .12 / s2 .04 / s3 .02 / s4 .01`, identical
  across every size. Depth is communicated by geometry alone (growing blur +
  offset), never by denser ink.
- **Semantic role aliases** — `resting→xs`, `raised→s`, `overlay→l`,
  `modal→xl`. The size is the primitive; the role is a named alias onto a size.
  Delivered as both `--lab-shadow-*` / `--lab-elevation-*` custom properties and
  `.lab-shadow-*` / `.lab-elevation-*` utility classes.
- **One global light angle, vertical by default** — `--lab-light-angle` (default
  `0deg`, the owner's `offset.x = 0` data). At 0 the ladder is literal; a
  non-zero angle projects each ply onto x/y from the one token
  (`x = y·sin`, `y = y·cos`), rotating the whole system in lockstep.
- **Neutral anchor, opt-in weak tint** — the default shadow is neutral
  `#101012` (Figma N12, never pure black). A surface may opt into a weak hue via
  `--lab-surface-shadow-tint` + `--lab-shadow-tint-strength` (default 0); the
  tint nudges the dark anchor, so the composite is always darker than the
  surface — a shadow, never a glow on dark themes.
- **Smooth elevation transitions** — motion tokens
  (`--lab-shadow-transition-{duration,easing}`) wire `transition: box-shadow` on
  every size/role class, so elevation changes ease rather than snap.
- **Alpha contract seam** — per-slot alphas come from
  `--lab-shadow-alpha-{s1,s2,s3,s4}`. The fresh styles export gives one alpha set;
  the dark theme uses a PROVISIONAL multiplier (default 1, no amplification), with
  the older Variables-snapshot dark set named for reconciliation. lab-colors'
  JND-calibrated alphas swap in at the same names with zero geometry change
  (filed in `docs/external-deps/lab-colors.md`).

The docs app gains a `shadow.html` demo (size ladder + role aliases + opt-in
tinted surfaces × light/dark; the light-angle knob is advanced-only) and a
Playwright smoke (contract resolves, four-ply equal-layeredness, vertical
default, eased transitions, shadow darker than the surface on dark).
