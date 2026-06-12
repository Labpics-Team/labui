# `@labpics/ui-shadow`

The LabUI shadow stack. A pure, deterministic generator turns the owner's
verbatim Figma effect-style ladder into the `--lab-shadow-*` / `--lab-elevation-*`
CSS contract that any surface in any stack can consume — it owns shadow
**geometry** only, never colour resolution or JND math (those are lab-colors'
domain).

## The ladder (опора)

Five elevation **sizes**, each **exactly four** drop-shadow plies. Transcribed
verbatim from the owner's effect styles (`labui-figma-styles.md`, 2026-06-13) —
nothing here is a formula. Values are CSS px: `r` = blur radius, `y` = vertical
offset. At the default vertical light the generated CSS reproduces this table
ply-for-ply.

| Size | slot s1 (α .12) | slot s2 (α .04) | slot s3 (α .02) | slot s4 (α .01) |
|------|-----------------|-----------------|-----------------|-----------------|
| `xs` | r1 y0  | r1 y1   | r2 y2   | r2 y4   |
| `s`  | r2 y1  | r2 y2   | r4 y4   | r8 y12  |
| `m`  | r2 y1  | r4 y4   | r8 y12  | r12 y24 |
| `l`  | r8 y4  | r12 y12 | r16 y24 | r24 y48 |
| `xl` | r36 y16| r48 y24 | r64 y36 | r96 y48 |

Two laws of the ladder:

- **Equal-layeredness.** Every size is four plies — no more, no fewer.
- **Fixed alphas.** The per-slot alpha is identical across every size
  (`s1 .12 / s2 .04 / s3 .02 / s4 .01`). Depth is communicated by **geometry
  alone** (growing blur + offset), never by making the ink denser.

A component consumes a **size**, in one of two forms:

```html
<!-- Class form — RECOMMENDED. box-shadow is set on the element, so an opt-in
     --lab-surface-shadow-tint resolves at the element; the class also wires
     the box-shadow transition so elevation changes ease. -->
<div class="card lab-shadow-m">…</div>
```
```css
/* Token form — for components that prefer a custom property. */
.button { box-shadow: var(--lab-shadow-s); }
```

## Semantic role aliases

The size is the **primitive**; a semantic **role** is a named alias onto a size
— the HIG pattern "size is the primitive, role is the alias", the same shape as
the token system. A role is just a pointer:

| Role | → Size | Why |
|------|--------|-----|
| `--lab-elevation-resting` | `xs` | a resting surface barely lifts off the page |
| `--lab-elevation-raised`  | `s`  | a raised card sits just above its neighbours |
| `--lab-elevation-overlay` | `l`  | a popover/overlay floats clearly above content |
| `--lab-elevation-modal`   | `xl` | a modal dominates, floating above everything |

(`m` is an intentional gap — a size with no role, available directly. The older
`resting/raised/overlay/modal` names survive only as these aliases.)

## One global light angle — vertical by default

There is exactly one light source. `--lab-light-angle` (an `<angle>`) drives the
whole system. The owner's data is a **pure vertical light**: every `offset.x = 0`.
So the default is `0deg` and a config option, **not** a demo handle:

- **At angle 0 (default):** the generator emits the literal ladder
  `0 {y}px {r}px {colour}` — the generated CSS *is* the опора table, bit-for-bit.
- **At a non-zero angle:** each ply's vertical throw is projected onto x/y from
  the one token — `x = y·sin(angle)`, `y = y·cos(angle)` — so rotating the
  single token rotates every ply of every size in lockstep. There is no
  per-size angle.

## Neutral anchor, opt-in weak tint — never a glow

Per the owner's verdict the default shadow is **neutral**: the theme's dark
anchor `#101012` (Figma N12 — **not** pure black, which dirties colour). A
surface may **opt into** a weak hue:

```css
.my-card {
  --lab-surface-shadow-tint: var(--lab-accent); /* the hue */
  --lab-shadow-tint-strength: 0.35;             /* opt-in, weak (default 0) */
}
```

The tint **nudges** the dark anchor; it never replaces it. Because every ply's
ink is `color-mix(anchor → tint by strength)` over the dark anchor base, the
composite is always darker than the surface — on a dark theme the shadow stays a
shadow, never a glow. This is the owner's lightness constraint, enforced
structurally (the anchor is the mix base) and covered by tests.

## Smooth elevation transitions

Surfaces that change elevation (hover/focus/state) **ease** their shadow rather
than snapping. The size and role classes wire `transition: var(--lab-shadow-transition)`;
the motion is tuned in one place via tokens:

```
--lab-shadow-transition-duration / -easing / (composite) --lab-shadow-transition
```

## The `--lab-shadow-alpha-*` contract — lab-colors seam

Per-slot alphas are **not** baked into the geometry. They are read at runtime
from a four-variable contract `--lab-shadow-alpha-{s1,s2,s3,s4}`. Today these
carry the owner's **fixed** Figma alphas (`.12 / .04 / .02 / .01`).

**Dark amplification — PROVISIONAL.** The fresh styles export (2026-06-13) gives
**one** alpha set; a theme changes only the colour anchor, not the alphas. So the
dark theme uses a `DARK_ALPHA_MULTIPLIER_DEFAULT = 1` (no amplification). The
older Variables snapshot carried a *separate* dark set (`@2/@4/@12/@20`, roughly
a 2× lift on the near plies); that direction is named and available as the single
multiplier to re-set when lab-colors reconciles the two sources via the JND
surface contracts. Both source numbers are documented in
`src/domain/alpha-contract.ts` — neither is a silent placeholder.

**Swap-in plan:** when `lab-colors-v1` (chapter `surface-jnd-contracts`) publishes
JND-calibrated alphas, they are written to the **same** `--lab-shadow-alpha-*`
names. The stack re-derives with **zero** geometry changes. See `INTEGRATION.md`
at the repo root.

## Build

```sh
pnpm --filter @labpics/ui-shadow generate   # regenerate src/generated/shadow.css
pnpm --filter @labpics/ui-shadow build       # generate + tsup + copy artifact
```

The generated `shadow.css` is committed so consumers and the docs site can
`@import "@labpics/ui-shadow/shadow.css"` without running the generator.
