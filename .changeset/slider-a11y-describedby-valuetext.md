---
"@labpics/ui-core": patch
"@labpics/ui-react": patch
---

Slider — announce the helper/error from the thumb and render the live value text.

Two HIGH defects from the #36 audit roadmap are fixed across both renderers:

- **a11y (HIGH-1):** the field `aria-describedby` / `aria-errormessage` were placed
  on the non-focusable group `<label>`, where a screen reader never reaches them — the
  label does not receive focus. They now sit on each focusable `role="slider"` THUMB
  (the element a reader lands on), mirroring how `<lab-number-input>` spreads field ARIA
  onto its `<input>`. The thumb's name (`aria-labelledby` → the label) is unchanged.

- **parity (HIGH-2):** the Lit `<lab-slider>` rendered an EMPTY value-text box under
  `show-value` because `getValueTextProps()` carries only id + data-attrs (no text).
  The Lit renderer now writes the live value, joined with `' – '`, exactly like the
  React twin — so the readout is identical across renderers.

Behavior is otherwise unchanged: same machine, value model, keyboard/drag, and
`--lab-*` token contract — only the ARIA target and the Lit value-text content are
corrected.
