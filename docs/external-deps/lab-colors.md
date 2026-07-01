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
> engine binds roles under `[data-theme]`). The published-engine swap itself is
> the LATER `colors-publish-swapout` scope; this file is the consumer-side record
> of blockers ON `lab-colors-v1`.

## The five EXTERNAL-blocker capability classes

The `colors-contract-pin` exit criterion mandates that every unmet engine
capability falls into one of **five** classes. Each is recorded below with its
consuming labui call site (or an honest "no current consumer — anticipated"),
the role/entry it would consume, the provisional value labui ships today, and
the owning `lab-colors-v1` chapter.

| # | Capability class | Consuming call site (`file:line`) | Owner chapter | Detailed below |
| --- | --- | --- | --- | --- |
| 1 | **Published `@labpics/colors` CSS+JS entry** | `apps/docs/package.json:17` (`workspace:*`) + `apps/docs/src/styles.css:9` (`@import "@labpics/colors/contract.css"`); stub `exports` at `packages/colors-stub/package.json:8-12`. JS runtime entry: **no current consumer — anticipated**. | `native-and-release` / `runtime-engine` | [§ Published package entry](#published-labpicscolors-cssjs-entry) |
| 2 | **Frozen decorative floor / separator / shadow-ramp magnitudes** | separator: `packages/tokens/src/generated/tokens.css:106` (`--lab-stroke-hairline`); shadow-ramp geometry: `packages/shadow/src/generated/shadow.css:30-49`. | `runtime-engine` / `surface-jnd-contracts` | [§ Decorative magnitudes](#decorative-floor--separator--shadow-ramp-magnitudes) |
| 3 | `--lab-surface-shadow-tint` | `packages/shadow/src/generated/shadow.css:31` | `runtime-engine` | [§ Shadow stack](#shadow-stack--packagesshadowsrcgeneratedshadowcss) |
| 4 | `--lab-shadow-alpha-*` JND alphas | `packages/shadow/src/generated/shadow.css:23-26` | `surface-jnd-contracts` | [§ Shadow stack](#shadow-stack--packagesshadowsrcgeneratedshadowcss) |
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
| `--lab-shadow-color` | `packages/shadow/src/generated/shadow.css:18`, `packages/shadow/src/config.ts` | `#101012` | Theme shadow-colour anchor — the dark base a shadow tints toward when no per-surface tint resolves. |
| `--lab-shadow-` (alphas: `--lab-shadow-alpha-{minor,ambient,penumbra,major}`) | `packages/shadow/src/generated/shadow.css:23-26` | `0.01 / 0.02 / 0.04 / 0.12` | JND-calibrated shadow alphas from the surface-JND contracts; same variable names, swap-in is a no-op. |
| `--lab-surface-shadow-tint` | consumed in `packages/shadow/src/generated/shadow.css:31` (`color-mix` body); resolved per-element when present | _(unset — falls back to `--lab-shadow-color`)_ | Per-surface shadow hue: the surface's own colour, so a shadow is never pure black. Resolved by the runtime engine's surface roles. |
| `--lab-light-angle` | `packages/shadow/src/generated/shadow.css:13` | `35deg` | Single global light-source angle driving every elevation offset. |
| `--lab-elevation-` (`--lab-elevation-{resting,raised,overlay,modal}`) | `packages/shadow/src/generated/shadow.css:30-49` | composed from the alphas + angle above | Semantic elevation roles. Provisional until the engine owns the shadow geometry/alpha contract. |

### Materials — `packages/core/src/materials.css`

| Gap token (prefix) | Declared at | Role | What the engine should provide |
| --- | --- | --- | --- |
| `--lab-mat-` (`--lab-mat-blur`, `--lab-mat-fill-alpha`, `--lab-mat-rim`, …) | `packages/core/src/materials.css:125-128` (+ role block) | Semantic **material role** a surface reads (Solid / BG-Blur / Glass). | The material role layer resolved from the engine's surface model, not LabUI-tuned primitives. |
| `--lab-ambient-` (`--lab-ambient-base`, `--lab-ambient-rim-color`, …) | `packages/core/src/materials.css:45-92` | Ambient material **primitives** (blur ladder, fill alphas, rim/specular). | Engine-owned primitives; LabUI mirrors Figma values 1:1 as a provisional snapshot. |
| `--lab-glass-` | `packages/core/src/materials.css` (legacy alias surface referenced in the materials header) | Prior glass-material aliases the `--lab-mat-*` roles superseded. | Folded into the engine's material roles; recorded so the alias family is not silently dropped. |

### Published `@labpics/colors` CSS+JS entry

The package itself is an EXTERNAL blocker: `@labpics/colors` is **not published**
yet. LabUI consumes it today through a local workspace stub.

| Capability | Consuming call site | Provisional source today | What the engine should provide |
| --- | --- | --- | --- |
| **CSS entry** (`contract.css`) | `apps/docs/package.json:17` (`"@labpics/colors": "workspace:*"`); `@import "@labpics/colors/contract.css"` at `apps/docs/src/styles.css:9` (+ `button-demo.css`, `materials-demo.css`, `primitives-demo.css`, `proof-demo.css`, `shadow-demo.css`, `template/component-page.css`). | `packages/colors-stub/contract.css`, exposed via `packages/colors-stub/package.json:8-12` `exports["./contract.css"]`. PROVISIONAL — placeholder role values owned by the resolver. | The published `@labpics/colors` CSS entry exporting the same `--lab-*` role bindings. Swap-in = repoint the dependency from `workspace:*` to the registry version; the import specifier is unchanged. |
| **JS runtime entry** (injects `--lab-*` from the background) | _no current consumer — anticipated._ LabUI consumes only the static CSS contract today; no JS resolver is imported (and none may be — law 2). | _(none — LabUI must not implement a resolver / WASM / `semantic.rs`.)_ | The runtime engine that resolves `--lab-*` per surface/background at runtime. Owned by `runtime-engine`; LabUI will consume it as a published entry, never re-implement it. |

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
| **Shadow-ramp geometry** — the per-elevation offset/blur ramp | `packages/shadow/src/generated/shadow.css:30-49` (`--lab-elevation-{resting,raised,overlay,modal}`); generated from `packages/shadow/src/config.ts`. | resting → modal spatial ramp (`0.0625rem` → `0.5rem` base offsets, `0.125rem` → `8rem` blur), alpha-damped 1 / 0.85 / 0.7 / 0.55 | The frozen elevation-ramp geometry resolved from the engine's shadow contract. Provisional until the engine owns the geometry; same role names, no consumer edit. |

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

## Invariants (NEVER regress)

- No colour VALUE above is computed in LabUI — every value is a snapshot of the
  Figma/engine-provisional source. Replacing a gap means repointing to the
  published engine role, **never** re-deriving the number here.
- No resolver / WASM / `semantic.rs` is introduced into LabUI.
- The `lab-colors` repo is never built, branched, or modified from LabUI.
- When the engine ships a role, the local declaration is deleted and the token
  moves from the `local-or-gap` bucket to `colour-contract` — a pure rename of
  ownership, no geometry change.
