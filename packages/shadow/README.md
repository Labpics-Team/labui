# `@labpics/ui-shadow`

The LabUI layered shadow stack. A pure, deterministic generator turns one config
into the `--lab-shadow-*` / `--lab-elevation-*` CSS contract that any surface in
any stack can consume — it owns shadow **geometry** only, never colour resolution
or JND math (those are lab-colors' domain).

## The stack

Four semantic layers (the owner's Figma FX/Shadow naming), composed into four
elevation roles. A layered soft shadow is the sum of Gaussians of growing width —
the physically-correct approximation of a soft shadow (Tobias Ahlin /
Josh Comeau), not a shader.

| Layer | Role | distance× | blur× |
|-------|------|----------:|------:|
| `minor` | near, sharp contact ply | 0.5 | 1 |
| `ambient` | soft surrounding ply | 1 | 2 |
| `penumbra` | mid diffuse ply | 2 | 4 |
| `major` | far, wide diffuse ply | 4 | 8 |

| Elevation role | depth (rem) | alpha damping |
|----------------|------------:|--------------:|
| `--lab-elevation-resting` | 0.125 | 1.00 |
| `--lab-elevation-raised` | 0.25 | 0.85 |
| `--lab-elevation-overlay` | 0.5 | 0.70 |
| `--lab-elevation-modal` | 1 | 0.55 |

Each role is the **same** four-ply stack scaled by one depth and one alpha
damping — light and dark themes differ only in variable values, never in the
`box-shadow` formula. A component consumes a **role**, never the raw plies, in
one of two forms:

```css
/* Class form — RECOMMENDED. box-shadow is set on the element, so a per-surface
   --lab-surface-shadow-tint resolves at the element (tinted-shadow path). */
.card { /* add class */ }
```
```html
<div class="card lab-elevation-raised">…</div>
```

```css
/* Token form — for components that prefer a custom property. Carries the THEME
   anchor tint (a nested var() inside a custom property is substituted in the
   declaring :root scope, so a per-surface tint does NOT apply here). */
.button { box-shadow: var(--lab-elevation-raised); }
```

Use the **class form** when a surface tints its own shadow; the **token form**
for neutral surfaces that want the theme anchor.

## One global light angle

There is exactly one light source. `--lab-light-angle` (an `<angle>`, default
`35deg` from vertical) drives every ply of every level. Each ply's geometric
throw is projected onto the page:

```
offset-x = throw · sin(--lab-light-angle)
offset-y = throw · cos(--lab-light-angle)
throw    = elevation.depth · layer.distance   (rem)
```

Rotate the one token and every shadow in the system rotates in lockstep. There
is no per-level angle.

## Surface tint, never pure black

Pure black "dirties"/washes out colour (Josh Comeau, confirmed by research). The
shadow colour is the **surface tint**, read from the `--lab-*` core contract via
`--lab-shadow-color`. Its fallback is the theme's dark neutral anchor
(`#101012` — the owner's stated `Dark` shadow colour), **never** an inline
`#000`. Provide `--lab-surface-shadow-tint` on a surface to tint its shadow with
its own hue.

## The `--lab-shadow-alpha-*` contract — lab-colors seam

Per-layer alphas are **not** baked into the geometry. They are read at runtime
from a four-variable contract:

```
--lab-shadow-alpha-minor / -ambient / -penumbra / -major
```

Today these carry the **PROVISIONAL** Figma FX/Shadow values, in real alpha
units (Figma % ÷ 100):

| | minor | ambient | penumbra | major |
|-|------:|--------:|---------:|------:|
| light | 0.01 (@1) | 0.02 (@2) | 0.04 (@4) | 0.12 (@12) |
| dark | 0.02 (@2) | 0.04 (@4) | 0.12 (@12) | 0.20 (@20) |

These are honest Figma values in the correct units, not throwaway placeholders.

**Swap-in plan:** when `lab-colors-v1` (chapter `surface-jnd-contracts`) publishes
JND-calibrated alphas, they are written to the **same** `--lab-shadow-alpha-*`
names. The stack re-derives with **zero** geometry changes — no re-author of the
elevation formulas. See `INTEGRATION.md` at the repo root for the open core-API
request this seam depends on.

## Build

```sh
pnpm --filter @labpics/ui-shadow generate   # regenerate src/generated/shadow.css
pnpm --filter @labpics/ui-shadow build       # generate + tsup + copy artifact
```

The generated `shadow.css` is committed so consumers and the docs site can
`@import "@labpics/ui-shadow/shadow.css"` without running the generator.
