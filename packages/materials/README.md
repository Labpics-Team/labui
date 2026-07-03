# @labpics/ui-materials

The **material mode axis** for LabUI surfaces. A single scope attribute —
`data-material="solid | glass | blur"` — sits beside `data-theme` and re-skins
every `.lab-material` surface below it with **zero markup change**.

This package owns **mechanics**, never colour. Tint and base come from the
`--lab-*` contract (`@labpics/colors`); this package assembles them into a
backdrop stack, guards legibility, and degrades deterministically.

## Axes model

A material surface address is `tier × theme × mode`:

- **tier** (`.lab-material--{base,muted,soft,subtle,elevated}`) — the Figma
  Materials fill. Each tier is a two-layer pair from the contract:
  `--lab-bg-material-<tier>-01` (translucent tint; its alpha is the glass
  density) over `--lab-bg-material-<tier>-02` (opaque base).
- **theme** (`data-theme`) — the contract rebinds the tier tokens per theme, so
  a tier auto-adapts light↔dark. This package does no theme branching.
- **mode** (`data-material`):
  - `solid` (default + universal fallback) — 01 painted over 02, **opaque**.
    The canon: contrast always holds, backdrop cost is zero.
  - `glass` — 01 alone (translucent) over the live backdrop + `blur(48px)`.
  - `blur` — frostier tier, `blur(128px)`.

Labels/borders do **not** carry material — they react to the effective surface.

## The α-boundary guarantee

Glass paints a translucent tint over an **unknown** backdrop, so legibility can
only be promised if the committed label stays legal across the whole range the
backdrop can take. We bound that range by the two backdrop extremes:

```
L_eff = α · L_tint + (1 − α) · L_bd,   L_bd ∈ [0, 1]
→ band = [ α·L_tint , α·L_tint + (1−α) ]
```

A tier is **guaranteed** only if its polarity-committed label clears the WCAG
AA floor (4.5:1) at **both** boundaries. The math lives in
`material-guarantee.ts`; `test/alpha-boundary.test.ts` runs it over the values
parsed straight from the generated contract (no second copy of the numbers).

### Unguaranteed pairs (current PROVISIONAL Figma-anchor alphas)

The `--lab-bg-material-*` emissions are still `мост: Figma-якорь` bridges — not
yet engine-derived. Under those alphas the guarantee flags these pairs, which
therefore **must not** carry text on glass until the colours train re-emits
them (they render fine as `solid`):

| theme | tier | why |
|---|---|---|
| light | subtle | sheer α=.439, band straddles the polarity crossover |
| dark | muted | white label fails at the bright-backdrop boundary (~4.3:1) |
| dark | soft | near-black tint at α=.698 — white label washes out on light backdrop |
| dark | subtle | sheerest dark tier, band spans almost the full axis |
| dark | elevated | white label fails at the bright-backdrop boundary |

Guaranteed today: **light** {base, muted, soft, elevated} and **dark** {base}.
This is a finding on the provisional alphas, not a defect of the mechanics —
the golden test locks the set so a silent regression trips CI.

## Placement rules (invariants)

- Glass is a **navigational / transient** layer (bars, modals, popovers) — not
  a skin for large content regions.
- **Never nest glass in glass** (`glass-on-glass` reads as a seam / striping).
  Enforced in the docs demo by an e2e selector check.
- Do not butt two glass panes edge-to-edge (visible seam).
- **Text on glass uses only guaranteed surface tokens** (polarity foreground).
  Accent / link text on glass is not permitted.

## Deferred to the next slice

- **Refraction lens** (SVG displacement from `feat/liquid-glass`,
  `liquid-glass.js` ≈ 26 KB / 700+ lines) is **not** ported here: it exceeds the
  slice's complexity ceiling and is a **cosmetic** enhancement over an already-
  guaranteed surface. It lands as an opt-in effect in a dedicated slice with its
  own visual-regression gate (design ch6: "гарантия — только α-bound; эффекты —
  косметический слой ПОВЕРХ").
- **Static noise grain / edge rim / accent×glass** — later slices.

## API

```ts
import { guaranteeReport, evaluateTier, relativeLuminance } from '@labpics/ui-materials';
import '@labpics/ui-materials/material.css';
```
