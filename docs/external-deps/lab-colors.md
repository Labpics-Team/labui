# External dependency — `@labpics/colors` engine gaps

> Call-site-anchored record of every `--lab-*` token LabUI declares **locally
> today** that SHOULD eventually be resolved by the external `@labpics/colors`
> colour engine. These are **EXTERNAL blockers**: LabUI must NOT compute their
> values, copy a resolver / `semantic.rs` / WASM engine, or modify the
> `lab-colors` repo. Each gap is owned by the `lab-colors-v1` epic.
>
> This is the CANONICAL, file:line-anchored record of the engine gaps; the
> root [`../../INTEGRATION.md`](../../INTEGRATION.md) is the short fact-sheet
> that points here. The
> governing law is [`../core-CONTRACT.md`](../core-CONTRACT.md) §0 law 2
> (components speak only the semantic `--lab-*` language) and §5 (the colour
> engine binds roles under `[data-theme]`). The engine is published and wired
> (see § Published entry below); what remains here is the consumer-side record
> of capability gaps still bridged locally.

## The five EXTERNAL-blocker capability classes

The `colors-contract-pin` exit criterion mandates that every unmet engine
capability falls into one of **five** classes. Each is recorded below with its
consuming labui call site (or an honest "no current consumer — anticipated"),
the role/entry it would consume, the provisional value labui ships today, and
the owning `lab-colors-v1` chapter.

| # | Capability class | Consuming call site (`file:line`) | Owner chapter | Detailed below |
| --- | --- | --- | --- | --- |
| 1 | **Published `@labpics/colors` CSS+JS entry** | `apps/docs/package.json:17` (`workspace:*`) + `apps/docs/src/styles.css:9` (`@import "@labpics/colors/contract.css"`); stub `exports` at `packages/colors-stub/package.json:8-12`. JS runtime entry: **no current consumer — anticipated**. | `native-and-release` / `runtime-engine` | [§ Published package entry](#published-labpicscolors-cssjs-entry) |
| 2 | **Frozen decorative floor / separator / shadow-ramp magnitudes** | separator: `packages/tokens/src/generated/tokens.css:106` (`--lab-stroke-hairline`); shadow-ramp geometry: `packages/shadow/src/generated/shadow.css:36-61` (roles alias at `:63-66`). | `runtime-engine` / `surface-jnd-contracts` | [§ Decorative magnitudes](#decorative-floor--separator--shadow-ramp-magnitudes) |
| 3 | `--lab-surface-shadow-tint` | `packages/shadow/src/generated/shadow.css:37` | `runtime-engine` | [§ Shadow stack](#shadow-stack--packagesshadowsrcgeneratedshadowcss) |
| 4 | `--lab-shadow-alpha-*` JND alphas | `packages/shadow/src/generated/shadow.css:30-33` | `surface-jnd-contracts` | [§ Shadow stack](#shadow-stack--packagesshadowsrcgeneratedshadowcss) |
| 5 | **IC (inclusive / contrast) theme calibration** | **no current consumer — anticipated** (`THEMES = ['light','dark']` only — `packages/core/src/theme.ts:23`). | `surface-jnd-contracts` | [§ IC theme calibration](#ic-inclusive--contrast-theme-calibration) |

Classes 3 and 4 are `--lab-*` token families and are additionally locked by the
`engine-gaps doc consistency` test against CH-01's `local-or-gap` allowlist (see
below). Classes 1, 2, and 5 are NOT `--lab-*` colour-role families — they are a
package-delivery capability, a dimension/geometry capability, and an
anticipated theme respectively — so the allowlist test does not cover them; they
are locked instead by the `engine-gaps capability-class completeness` test.

## Why this record exists

LabUI consumes `@labpics/colors` **exclusively** through the `--lab-*` CSS
custom-property contract. A consumed `--lab-*` name falls into exactly one of
three buckets (see `packages/colors-stub/test/consumed-contract.ts`):

1. **colour-contract** — a semantic colour role owned by `@labpics/colors`,
   mirrored in `packages/colors-stub/roles.json` + `contract.css`.
2. **dimension** — owned by `@labpics/ui-tokens` (`DIMENSION_PREFIXES` in
   `packages/core/src/css.ts`).
3. **local-or-gap** — provisional tokens LabUI declares **today** because the
   engine does not yet resolve them. **This document is the canonical record of
   bucket 3.**

The `local-or-gap` allowlist in
`packages/colors-stub/test/consumed-contract.ts` (`LOCAL_OR_GAP_PREFIXES`) and
this document are kept in lock-step: the `engine-gaps doc consistency` test
fails if any allowlisted gap token is missing here.

## Gap tokens, by source

### Shadow stack — `packages/shadow/src/generated/shadow.css`

Generated from `packages/shadow/src/config.ts` (the source-of-truth that holds
the same provisional anchor). Provisional values are snapshotted, never computed
in LabUI.

| Gap token (prefix / exact) | Declared at | Provisional value | What the engine should provide |
| --- | --- | --- | --- |
| `--lab-shadow-color` | `packages/shadow/src/generated/shadow.css:19`, `packages/shadow/src/config.ts` | `#101012` | Theme shadow-colour anchor — the dark base a shadow tints toward when no per-surface tint resolves. |
| `--lab-shadow-` (slot alphas: `--lab-shadow-alpha-{s1,s2,s3,s4}`) | `packages/shadow/src/generated/shadow.css:30-33`; contract in `packages/shadow/src/domain/alpha-contract.ts` | `0.12 / 0.04 / 0.02 / 0.01` (per-slot, theme-invariant while `DARK_ALPHA_MULTIPLIER_DEFAULT = 1`) | JND-calibrated per-slot shadow alphas (and, if measurement says so, a dark-theme multiplier ≠ 1); same variable names, swap-in is a no-op. |
| `--lab-surface-shadow-tint` | consumed in `packages/shadow/src/generated/shadow.css:37` (`color-mix` body); resolved per-element when present | _(unset — falls back to `--lab-shadow-color`)_ | Per-surface shadow hue: the surface's own colour, so a shadow is never pure black. Resolved by the runtime engine's surface roles. |
| `--lab-light-angle` | `packages/shadow/src/generated/shadow.css:15` | `0deg` (vertical light — owner's Figma export, 2026-06-13) | Single global light-source angle driving every elevation offset. |
| `--lab-elevation-` (`--lab-elevation-{resting,raised,overlay,modal}`) | `packages/shadow/src/generated/shadow.css:63-66` | aliases onto the five-size ladder `--lab-shadow-{xs,s,m,l,xl}` (`:36-61`); roles map resting→xs, raised→s, overlay→l, modal→xl (`m` is a deliberate ladder gap) | Semantic elevation roles. Provisional until the engine owns the shadow geometry/alpha contract. |

### Materials — CLOSED (refraction engine landed, ADR-0003)

Former gap surface: `packages/core/src/materials.css` — the `--lab-mat-*`
semantic material roles, `--lab-ambient-*` primitives and legacy `--lab-glass-*`
aliases it declared provisionally. **Closed**: the Liquid Glass refraction
engine landed in `packages/materials/src/engine/` (ADR-0003 ch-02), and the
provisional core shims (`materials.css`, `glass.css`) were removed in the
follow-up sweep (#41). All three families left `LOCAL_OR_GAP_PREFIXES`
(`consumed-contract.ts`), `SEMANTIC_ROLE_PREFIXES` (`packages/core/src/css.ts`)
and the hardcoded-colour / box-shadow scanner allowlists in the same sweep. The
only remaining literal carrier is the frozen Figma anchor
(`packages/colors-stub/figma-reference.css`) — raw measurements, not consumed
code. A future material gap gets a **new** record here; these retired prefixes
must not be revived.

### Material tint pairs — two-layer derivation (Стекло v2, слайс A)

The `--lab-bg-material-<tier>-01/-02` pairs (tiers `base/muted/soft/subtle/
elevated`, per theme) are **still `мост: Figma-якорь` bridges** — raw eyedropper
greys, hue-less (equal RGB channels), α picked by hand. They are the last
Materials family not yet engine-derived, and the owner's target is to replace
them with live emission: a translucent tint in the **neutral hue** (286° — the
same `hue_override_deg` the bg ladder and every neutral emission already use)
whose **α is solved** for the tier's **target tone** (the `bg-tone` `dj-anchor`
ladder), over an opaque neutral base at that tone.

| Gap token (prefix) | Declared at | Provisional value | What the engine should provide |
| --- | --- | --- | --- |
| `--lab-bg-material-` (`-<tier>-01` tint / `-<tier>-02` base) | `packages/colors-stub/contract.css:15-24` (light), `:262-271` (dark); consumed by `packages/materials/src/material.css` (`--_tint`/`--_base`) | grey Figma-anchor pairs, e.g. light/base `rgb(153 153 153 / 0.969)` over `rgb(92 92 92)` | A **two-layer material recipe** deriving `01` (neutral-hue translucent tint) + `02` (opaque neutral base) so the solid canon `01`-over-`02` lands on the tier's target tone, with the α-boundary guarantee computable from the emitted values (see request below). |

**Investigation (why this is a request, not a labui-side solve).** The published
`@labpics/colors@0.6.2` wasm `LabColors` class exposes only `loadConfig`,
`muddiness`, `recheckContrast`, `resolveTheme` — **no** standalone composite
primitives (`composite_over_encoded` / `invert_composite_encoded`) and **no**
material ladder position (the Rust `position` menu is fixed:
`label-* / fill-* / border-* / focus-ring / glow / skeleton-*`; probing
`neutral-material-base` returns `invalid_config: неизвестная позиция лестницы`).
The `alpha-analog` recipe DOES exist (emits a `TranslucentRole` — a neutral
translucent tint at a **given** α whose composite over the resolve bg equals a
source solid), and `dj-anchor` DOES emit an opaque neutral at a target |ΔJ'|
(how `bg-tone-2/3` work). But neither models the two-layer `01`-over-`02` where
**α is solved for a target tone of a separate opaque base** — that is the
missing capability. Per the owner's law (physics in the Rust engine, semantics
in the consumer passport) and the standing rule "labui must NOT reimplement
colour science in JS", labui does **not** derive these locally; it keeps the
bridge and files this request.

**Requested engine API (one of two shapes).**

1. **Preferred — a `material` recipe kind** in the passport role menu, e.g.
   `{ kind: "material", source: { kind: "neutral", pick: "mid" }, tone: <dj-anchor light/dark>, density: <α> }`,
   emitting **both** layers per role (a `MaterialResolved` result carrying
   `tintCss` = `oklch(L% C H / α)` at hue 286°, `baseCss` = opaque `oklch`, and
   `compositeHex` = the solid canon), with the **byte-exact** composite guarantee
   already proven for the alpha-analog family (`≤ 1 LSB` vs
   `compositeOverByte`, the discipline in `byte-composite-golden.test.ts`). The
   passport then declares 5 tiers × the tone/density ladder; labui emits them via
   a `materialTintEmission` in `generate-contract.mjs` exactly as the bg ladder
   and fx family are emitted today (cascade-override of the Figma bridge).
2. **Alternative — expose the two composite primitives** standalone in the JS
   API: `compositeOverEncoded(tint, base) → hex` and
   `invertCompositeEncoded(targetHex, alpha, backdropHex) → tintHex` (both in the
   gamma-encoded sRGB space the browser paints, matching
   `crates/labcolors-core/src/alpha.rs`), plus the `TranslucentResolved` shape.
   labui then runs the tier→tone→density solver at generation time with the same
   byte-exact tests. This is heavier on the labui side (a generation-time solver)
   but needs no new recipe.

**Guarantees the engine must preserve.** (a) The emitted tint is `oklch(… / α)`
in the neutral hue, α ∈ (0,1]; (b) `01`-over-`02` is byte-exact to the target
tone (`≤ 1 LSB`); (c) the α-boundary verdict (`guaranteed` / `unguaranteed`
pairs — `packages/materials/README.md` "Unguaranteed pairs") is recomputable
from the emitted `01`/`02` with no second copy of the numbers. Until shipped,
labui keeps the Figma bridge; **slice C (accent-glass)** additionally needs the
engine's accent hue-drift control (`HUE_DRIFT_PENALTY_SLOPE`) exposed so a
tinted accent glass can cap chroma under translucency without drifting hue.

### Published `@labpics/colors` CSS+JS entry

`@labpics/colors` **is published** (exact pin `0.6.2` in
`packages/colors/package.json`) and consumed through three channels: the
workspace stub still serves the **CSS entry** (`contract.css`) to `apps/docs`,
but that file is now a **generated engine artifact** —
`packages/colors/generate-contract.mjs` emits engine-owned roles live from the
published package + passport, bridging the rest from the frozen Figma anchor
(`colors-stub/figma-reference.css`), under the regeneration-discipline gate
(`packages/colors/test/contract-generated.test.mjs`). The **JS runtime entry**
is consumed by `packages/colors` (`@labui/colors`, non-component package —
law 2 keeps components CSS-only) and by the `labcolors-engine` alias in
`apps/docs` for live-engine e2e. The remaining blocker is not publication but
**bridge coverage**: roles still bridged from the Figma anchor migrate to
engine emission as the engine ships them.

| Capability | Consuming call site | Provisional source today | What the engine should provide |
| --- | --- | --- | --- |
| **CSS entry** (`contract.css`) | `apps/docs/package.json:17` (`"@labpics/colors": "workspace:*"`); `@import "@labpics/colors/contract.css"` at `apps/docs/src/styles.css:9` (+ `button-demo.css`, `primitives-demo.css`, `proof-demo.css`, `shadow-demo.css`, `template/component-page.css`). | `packages/colors-stub/contract.css`, exposed via `packages/colors-stub/package.json:8-12` `exports["./contract.css"]` — **generated engine artifact**: engine-owned roles emitted live from the published `0.6.2` package, the rest bridged from the frozen Figma anchor (`generate-contract.mjs` + `contract-generated` gate). | Bridge coverage: each remaining Figma-bridged role migrates to live engine emission as the engine ships it; the import specifier never changes. |
| **JS runtime entry** (injects `--lab-*` from the background) | `packages/colors` (`@labui/colors`) — engine wrapper (`engine.mjs`, exact pin `@labpics/colors@0.6.2`); `labcolors-engine` npm-alias in `apps/docs` for live-engine e2e. Components stay CSS-only (law 2) — the runtime consumer is the non-component engine package. | The published wasm runtime, consumed as-is. | Runtime role coverage growing with the engine (e.g. glow/ladder roles land as released versions ship them). |

This records the "published `@labpics/colors` npm package exposing a CSS entry
and/or a JS runtime" request with the exact consumer sites.

### Decorative floor / separator / shadow-ramp magnitudes

Magnitudes LabUI freezes **today** as provisional snapshots that the engine's
surface-JND contracts should eventually own. These are NOT colour roles — they
are dimension/geometry — so they live outside the `local-or-gap` colour bucket,
but they are still EXTERNAL blockers: LabUI must not *derive* the calibrated
magnitude, only snapshot it.

| Magnitude | Declared at | Provisional value | What the engine should provide |
| --- | --- | --- | --- |
| **Separator floor** — `--lab-stroke-hairline` | `packages/tokens/src/generated/tokens.css:106`; source-of-truth `packages/tokens/src/config/default-config.ts:156`. Consumed e.g. `packages/core/src/components/accordion/lab-accordion.ts:178`, `packages/react/src/card.css:28`. | `0.0625rem` (1px, Figma `strokeWeight` 1) | The JND-calibrated separator magnitude — "barely perceptible but sufficient", a calibrated value, not a guess. Same token name; swap-in is value-only. |
| **Shadow-ramp geometry** — the per-size offset/blur ramp | `packages/shadow/src/generated/shadow.css:36-61` (`--lab-shadow-{xs,s,m,l,xl}`, four plies per size); roles alias at `:63-66`; generated from `packages/shadow/src/config.ts`. | five-size ladder with monotone offset-y/blur growth per ply, fixed per-slot alphas `s1..s4` = `0.12 / 0.04 / 0.02 / 0.01` | The frozen elevation-ramp geometry resolved from the engine's shadow contract. Provisional until the engine owns the geometry; same role names, no consumer edit. |

> **Decorative floor** (a min-contrast magnitude for purely decorative surfaces)
> has **no distinct consuming call site in LabUI today** — it is recorded here as
> _anticipated_ so the engine-swap checklist does not silently drop it. The
> closest shipped magnitudes are the separator floor and shadow ramp above.

### IC (inclusive / contrast) theme calibration

LabUI ships exactly two colour themes today — `THEMES = ['light', 'dark']`
(`packages/core/src/theme.ts:23`), bound under `[data-theme]` per
`docs/core-CONTRACT.md` §5. There is **no IC / inclusive / high-contrast theme**.

| Capability | Consuming call site | Provisional value today | What the engine should provide |
| --- | --- | --- | --- |
| **IC theme calibration** | _no current consumer — anticipated._ No `[data-theme="ic"]` / inclusive / high-contrast selector exists; `theme.css` defines the structural insertion points only and **no colour values** (that would duplicate `semantic.rs`, forbidden). | _(none — LabUI declares no IC values.)_ | The inclusive/contrast theme role calibration, bound under a future `data-theme` value by the engine. LabUI will gain it as a pure role re-binding on an ancestor — zero component edits — never by computing contrast values locally. |

## Non-colour local family in the classifier registry — NOT an engine gap

The `local-or-gap` allowlist (CH-01) doubles as the classification registry for
the zero-unclassified colour gate: **every** consumed `--lab-*` name must land
in a bucket, including families that have nothing to do with the colour engine.
One such family is registered here for that reason alone:

| Family | Declared at | Consumed | Status |
| --- | --- | --- | --- |
| **Motion tokens** — `--lab-motion-*` (durations, easings, semantic transition/emphasis/entrance/exit roles) | `packages/tokens/src/generated/motion.css`; source-of-truth `packages/tokens/src/motion/config.ts` (generated — never hand-edited) | transition/animation sites across `packages/core` + `packages/react` (e.g. `packages/core/src/components/accordion/lab-accordion.ts`), wired in task 125 | **Permanently local, non-colour.** Published by `@labui/tokens`, not provisional, not awaiting the engine. It is listed in `LOCAL_OR_GAP_PREFIXES` solely so the classifier can place it; it must NEVER migrate to the colour contract, and the engine-swap invariants below do not apply to it — there is nothing to swap. It is **not** one of the five EXTERNAL-blocker capability classes above. |

## Invariants (NEVER regress)

- No colour VALUE above is computed in LabUI — every value is a snapshot of the
  Figma/engine-provisional source. Replacing a gap means repointing to the
  published engine role, **never** re-deriving the number here.
- No resolver / WASM / `semantic.rs` is introduced into LabUI.
- The `lab-colors` repo is never built, branched, or modified from LabUI.
- When the engine ships a role, the local declaration is deleted and the token
  moves from the `local-or-gap` bucket to `colour-contract` — a pure rename of
  ownership, no geometry change.
