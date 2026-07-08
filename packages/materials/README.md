# @labpics/ui-materials

The **material mode axis** for LabUI surfaces. A single scope attribute —
`data-material="solid | glass | blur | acrylic"` — sits beside `data-theme` and
re-skins every `.lab-material` surface below it with **zero markup change**.

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
  - `acrylic` — Fluent-class **diffusion** (not glass's refraction): `blur(48px)`
    + `saturate(180%)` + tint + a baked **~2% grain** (see "Acrylic" below).

Labels/borders do **not** carry material — they react to the effective surface.

`glass`, `blur` and `acrylic` are the **live-blur** family (translucent tint over a
`backdrop-filter`); `solid` is opaque. That partition drives the background policy
and the degradation ladder below.

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

## Acrylic (ADR-0004 Решение 1)

Acrylic is **diffusion** (a low-frequency blur that scatters the backdrop), not
glass's **refraction** (a lens that offsets the sampled backdrop) — two physics, not
two presets. The recipe **reuses the ladder** (no new magic value):

| Layer | Value | Provenance |
|---|---|---|
| `backdrop-filter: blur()` | `--_blur-glass` (48px) | Figma BG-blur Base, ∈ Fluent 30–60px |
| `saturate()` | `--_saturate-on` (180%) | reused, not a new token |
| tint | `--lab-bg-material-<tier>-01` (straight-alpha) | **DECLARED** trade-off: NOT Fluent luminosity/exclusion blend — that would break the byte-exact guarantee, so the tint composites straight-alpha like every other mode |
| grain | `--_acrylic-noise` (~2%, baked into alpha) | ADR-0002 §1; the ONE thing that separates acrylic from plain blur — it kills gradient banding under the blur |

Because acrylic uses the **same tint over the same unmeasured `[0,1]` corridor** as
glass (ADR-0004 Решение 2 — the compression multiplier `C` is not yet measured), its
α-boundary verdict is **identical to glass's**: no new guaranteed/unguaranteed pairs.

The grain is a **one-generation** asset (a tiled data-URI PNG), not a runtime filter
(`feTurbulence` recomputes every frame; a decoded PNG rasterises once). It is produced
deterministically by `scripts/build-acrylic-noise.ts` (fixed seed, a dependency-free
`node:zlib` PNG encoder — no binary in git) and inlined into `material.css` between
`ACRYLIC-NOISE:GENERATED` sentinels. `pnpm --filter @labpics/ui-materials check-generated`
re-generates and `git diff --exit-code`s it; `test/acrylic-noise.test.ts` decodes the
asset (dims, colour type, baked alpha) and seals inline ≡ generator (no drift).

## Specular rim (Стекло v2)

The 1px light-catching edge on glass and acrylic — a vertical gradient, bright at
the top, fading down, that reads as light glancing off the surface's edge. It is a
private handle `--_rim` (unset by default, like `--_noise`): the modes rebind **it**,
never the single paint rule. The ring is painted on a **`::before`** with the
`mask-composite` gradient-border technique — so it respects `border-radius` (a
`border-image` gradient would square the corners; a `box-shadow` inset cannot carry
a vertical gradient) at **zero markup change**. `z-index: -1` sits it above the tint
but below the label; `pointer-events: none` keeps it inert.

- **ON** for `glass` (refractive edge catches light) and `acrylic` (Fluent's luminous
  edge stroke); **OFF** for `blur` (heavy frost is diffuse — no sharp edge) and `solid`
  (opaque canon — not glass).
- **Colour is achromatic and from the contract, never a literal.** Specular reflection
  is white regardless of the surface tint (physics), so the source is the theme-
  invariant static-surface tokens `--lab-bg-static-light` / `--lab-bg-static-dark`,
  through `color-mix(in srgb, transparent, <token> α)` — the same idiom the shadow
  engine uses, so `no-hardcoded-colour` stays green (zero raw `rgb()` in `material.css`).
- **Theme rebinds** `--_rim-active` (light bright / dark subtle), so the system stays
  dynamic. DECLARED alphas (visually calibrated): light white `.50 → .05`; dark white
  `.12` top → faint dark `.04` bottom.
- Every **degradation** (no `backdrop-filter` / reduced-transparency / contrast:more /
  forced-colors) resets `--_rim: none` with the translucency — the rim rides the
  glass, and collapses with it to the opaque solid canon.

Gated by `test/specular-rim.test.ts` (structure + provenance) and
`test/degradations.test.ts` (`dropsRim`), plus the live browser assertions in
`apps/docs/tests/materials-flag.spec.ts` (rim ON glass/acrylic, OFF solid/blur,
theme brightness, stripped under degradation).

## Background policy (`background-policy.ts`)

The explicit, tested contract of *which material reads what*:

- **Live-blur family** = `glass | blur | acrylic` (`isLiveBlur`, `LIVE_BLUR_MODES`);
  `solid` is opaque.
- **No live-blur nested in live-blur** (`canNest(outer, inner)`): two stacked live
  blurs read as a seam. `solid` nests freely in either direction.
- **A material's own fill comes only from `--lab-bg-material-*`** (`MATERIAL_FILL_FAMILY`).
  The live backdrop *under* the surface may be any `bg` role (the scene), but the
  surface's tint/base never pull an arbitrary background role — a `material.css` scan
  test seals it.

## Degradation ladder (honest fallback)

The material picks the strongest surface the environment actually supports and falls
back deterministically — no JS, pure CSS `@supports`/`@media`:

- **Refraction** (Chromium + engine) → glass gets the lens (`--_blur` re-bound to the
  calibrated radius). Acrylic has **no** lens rung — it is diffusion, not refraction.
- **`backdrop-filter` present** → the live-blur CSS stack (glass/blur/acrylic).
- **No `backdrop-filter`, or `prefers-reduced-transparency`, or `prefers-contrast: more`,
  or `forced-colors: active`** → the **opaque solid canon of the same tier** (grain
  dropped, blur zeroed). Solid is opaque, so the label contract always holds and the
  backdrop cost is zero. `data-material="solid"` is the manual escape hatch and always
  wins. Every downgrade path is guarded by `test/degradations.test.ts`.

## Placement rules (invariants)

- Glass/acrylic are a **navigational / transient** layer (bars, modals, popovers) —
  not a skin for large content regions.
- **Never nest a live-blur material in a live-blur material** (`glass-on-glass`,
  `acrylic-on-acrylic`, … read as a seam / striping). `canNest` encodes it; the docs
  demo enforces it across every live mode with an e2e selector check.
- Do not butt two live-blur panes edge-to-edge (visible seam).
- **Text on a material uses only guaranteed surface tokens** (polarity foreground).
  Accent / link text on glass is not permitted.

## Deferred to a later slice

- **Refraction lens** — LANDED (ADR-0003 ch-02, PR #85): the SVG-displacement engine
  lives in `./engine/`, mounted declaratively via `mountMaterialRuntime()`.
- **Acrylic grain** — LANDED (this slice): see "Acrylic" above.
- **Parity oracle** (CAM16-UCS ΔE budget across solid/acrylic/glass, ADR-0004
  Решение 3/4) — still a blueprint; a scheduled, expensive browser oracle, not a
  per-PR gate. Readability on the material is already covered by the legibility ladder.
- **Corridor compression `C`** (ADR-0004 Решение 2) — unmeasured; until then acrylic
  conservatively inherits glass's `[0,1]` corridor.
- **Edge rim / accent×glass** — later slices.

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
  // background policy (A):
  isLiveBlur,
  canNest,
  LIVE_BLUR_MODES,
  MATERIAL_FILL_FAMILY,
} from '@labpics/ui-materials';
import '@labpics/ui-materials/material.css';
```
