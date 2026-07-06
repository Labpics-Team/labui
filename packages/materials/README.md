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
backdrop can take. We bound that range in the **same space the browser paints** —
straight-alpha compositing per-channel in **gamma-encoded sRGB** — by the two
backdrop extremes:

```
effLow  = L( tint over black )      (backdrop L_bd = 0)  → minimum
effHigh = L( tint over white )      (backdrop L_bd = 1)  → maximum
```

Luminance and the composite are both monotonic per channel, so black and white
give the **true** extrema over *every* backdrop (coloured ones included). A tier
is **guaranteed** only if its polarity-committed label clears the WCAG AA floor
(4.5:1) at the **worst point of the whole band** `[effLow, effHigh]` — not just
its ends: a label whose own luminance falls **inside** the band is driven to 1:1
contrast by some backdrop even when both endpoints pass. The math lives in
`material-guarantee.ts`; `test/alpha-boundary.test.ts` runs it over the values
parsed straight from the generated contract (no second copy of the numbers), and
`apps/docs/tests/materials-flag.spec.ts` differentially checks `effLow`/`effHigh`
against the real browser compositor (`canvas` `getImageData`).

### Unguaranteed pairs (current PROVISIONAL Figma-anchor alphas)

The `--lab-bg-material-*` emissions are still `мост: Figma-якорь` bridges — not
yet engine-derived. Under those alphas the guarantee flags these pairs, which
therefore **must not** carry text on glass until the colours train re-emits
them (they render fine as `solid`):

| theme | tier | why |
|---|---|---|
| light | soft | near-black label, real composite worst ≈ 4.1:1 on a dark backdrop — **below AA** |
| light | subtle | sheer α=.439, band straddles the polarity crossover |
| dark | subtle | sheerest dark tier, band spans almost the full axis |
| dark | elevated | white label fails at the bright-backdrop boundary |

Guaranteed today: **light** {base, muted, elevated} and **dark** {base, muted,
soft}. This is a finding on the provisional alphas, not a defect of the
mechanics — the golden test locks the set so a silent regression trips CI.

> **Re-derivation note.** Moving the α-boundary onto the real composite flipped
> three pairs honestly: `light/soft` **lost** its guarantee (the old
> blend-of-luminances read ~5.7:1 where the browser paints ~4.1:1), while
> `dark/muted` and `dark/soft` **gained** one (the blend was wrongly pessimistic
> for a dark tint over a bright backdrop — the real gamma composite is darker, so
> the white label actually holds ≥ AA).

### Composite space (resolved)

The guarantee bounds the composite in **gamma-encoded sRGB**, per-channel —
exactly what the browser paints and byte-identical to lab-colors' own
`composite_over_encoded` (proven by the 12-pair Figma-neutral roundtrip in
`crates/labcolors-core/src/alpha.rs`). Luminance is measured with WCAG Rec.709
coefficients on that composite, the same colorimetry lab-colors uses. Engine,
guarantee, and screen agree; a `guaranteed` verdict is a **real browser-AA
promise**, not a model artefact. (The earlier worry that lab-colors composites in
*linear* sRGB was a misread — its linear path is colorimetry-only; compositing is
in the encoded space.)

## Corridor guarantee (ADR-0004 Решение 2)

The α-boundary is ONE class of math parametrised by the reachable **backdrop
corridor**. The material case is the corridor `[black, white]` (any live backdrop);
a KNOWN region narrows it to the per-channel extremes actually reachable there.
`evaluateTier(…, { backdrop })` takes a `BackdropCorridor` (default = the full
`[black, white]` — byte-identical to the old behaviour), and `bandOverCorridor` /
`worstContrastOverBand` are the shared primitives the tier evaluator and the ladder
both build on (one math, no drift). `cornerCorridor(colours…)` and `unionCorridor`
construct corridors from a sampled region and from two adjacent regions.

## Byte-exact composite (task #52)

`compositeOverByte(source, base)` is the straight-alpha composite quantised to the
8-bit channel the **display commits** — `Uint8ClampedArray` round-half-to-even, the
exact byte the browser's `ImageData` and the engine's map both store. It is proven
**byte-for-byte** (zero tolerance) against lab-colors' SSOT `composite_over_encoded`
on the 12 Figma-neutral pairs (`byte-composite-golden.test.ts`), the material
contract domain is proven tie-free (so round-half-even ≡ lab-colors' round-half-away
here), and the composited contract pixels are frozen in a versioned golden
(`byte-composite-corridor-golden.test.ts` — re-bless only with a `GOLDEN_VERSION`
bump + CHANGELOG line). The docs differential (`materials-flag.spec.ts`) compares
`compositeOverByte` against the real canvas pixel **byte-exact** — no luminance
tolerance — verified equal across Chromium AND WebKit.

## Legibility ladder (task #58)

`legibility-ladder.ts` resolves a label on ANY background to one of two states —
a proven corridor guarantee, or a mandatory scrim floor the SYSTEM inserts. There
is no "put the text down and hope" path (the resolver structurally cannot return
`guaranteed` unless the corridor worst-case clears the floor):

| Case | Rung | Guarantee |
|---|---|---|
| solid | `resolveOnSolid` | corridor collapses to a point → direct contrast |
| material | `resolveOnMaterial` | tint over unknown backdrop → `[black, white]` corridor |
| image (readable) | `resolveOnImageRegion` | per-channel region corridor → solver → forced `computeScrimFloor` if unreachable |
| tainted (cross-origin) | `resolveOnTainted` | pixels unreadable → **scrim mandatory by contract** (never `guaranteed`) |
| boundary (two regions) | `resolveOnBoundary` | must hold over the `unionCorridor` of both |

The browser wiring (`getImageData` in a try/catch → `SecurityError` = tainted →
`resolveOnTainted`) is a thin consumer adapter; the module never imports the DOM,
so every rung is exhaustively unit-tested.

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
import {
  guaranteeReport,
  evaluateTier, // now accepts { backdrop } — the corridor
  relativeLuminance,
  compositeOverByte, // byte-exact composite (#52)
  cornerCorridor,
  unionCorridor,
  // legibility ladder (#58):
  resolveOnSolid,
  resolveOnMaterial,
  resolveOnImageRegion,
  resolveOnBoundary,
  resolveOnTainted,
  corridorFromPixels,
  computeScrimFloor,
} from '@labpics/ui-materials';
import '@labpics/ui-materials/material.css';
```
