# `@labpics/colors` (local stub)

**Temporary.** This package vendors the `--lab-*` CSS custom-property contract by
hand so LabUI can pin and test the color integration point before the real
`@labpics/colors` is published.

- Real package: produced by `lab-colors-v1` → chapter `native-and-release`.
- Real runtime: `lab-colors-v1` → chapter `runtime-engine` (resolves `--lab-*`
  from the background at runtime, per surface).

## What this is

`contract.css` declares the **full semantic `--lab-*` role contract** — the names
components consume — and pins each role to a placeholder constant. The values are
the exact resolved Light/Dark palette snapshotted from the LabUI Figma **Semantic**
collection (488-token W3C DTCG export, `fileKey LuaiBd4anRi4DMZayKAnY2`,
`reference/labui-tokens-snapshot.dtcg.json`). They are **not computed here** — this
file does **not** implement the resolver and does **not** duplicate `semantic.rs`.

**Three-language rule.** Components read **only** semantic `--lab-*` roles. The
primitives (`N0..N12`, accent hex) are this file's internal kitchen — they are
never exposed as their own custom properties. A role is the public API; a primitive
is an implementation detail.

`roles.json` is the machine-readable canonical role list (the drift anchor). The
presence test (`test/contract.test.ts`) asserts `contract.css` exposes exactly that
set in every theme scope, so a dropped or renamed role fails CI.

## Theme switching

- `:root` carries the **Light** palette (default).
- `[data-theme="dark"]` forces **Dark**.
- `[data-theme="light"]` forces **Light** (wins over OS preference).
- `@media (prefers-color-scheme: dark)` applies **Dark** as a fallback only when no
  explicit `[data-theme]` is set.

## Role catalog

Each role lists the Figma Semantic path it mirrors (for traceability) and its
primitive mapping. `N*` = Neutral ladder primitive; `@NN` = alpha step (percent).
Sentiment accents: Brand `#007AFF`, Danger/Red `#FF3B30`, Warning/Orange `#FFA100`,
Success/Green `#34C759`, Info/Blue `#3E87FF` (Light-mode anchors).

### Backgrounds (23) — surface roles

| Role | Semantic path | Mapping (Light → Dark) |
| --- | --- | --- |
| `--lab-bg-primary` | Backgrounds/Neutral/Primary | N0 → N0(dark) |
| `--lab-bg-secondary` | Backgrounds/Neutral/Secondary | N1 → N1(dark) |
| `--lab-bg-tertiary` | Backgrounds/Neutral/Tertiary | N0 → N2(dark) |
| `--lab-bg-inverted` | Backgrounds/Neutral/Inverted | N12 → N12(dark) |
| `--lab-bg-grouped-primary` | Backgrounds/Neutral/Grouped/Primary | N1 → N0(dark) |
| `--lab-bg-grouped-secondary` | Backgrounds/Neutral/Grouped/Secondary | N0 → N1(dark) |
| `--lab-bg-grouped-tertiary` | Backgrounds/Neutral/Grouped/Tertiary | N1 → N2(dark) |
| `--lab-bg-static-light` | Backgrounds/Neutral/Static/Light | White (both modes) |
| `--lab-bg-static-dark` | Backgrounds/Neutral/Static/Dark | Dark (both modes) |
| `--lab-bg-overlay-ghost` | Backgrounds/Overlay/Ghost | N0 @0 / Dark @0 |
| `--lab-bg-overlay-soft` | Backgrounds/Overlay/Soft | @20 |
| `--lab-bg-overlay-base` | Backgrounds/Overlay/Base | @48 |
| `--lab-bg-overlay-strong` | Backgrounds/Overlay/Strong | @80 |
| `--lab-bg-material-elevated-01` / `-02` | Backgrounds/Materials/Elevated/01·02 | translucent + tint layers |
| `--lab-bg-material-base-01` / `-02` | Backgrounds/Materials/Base/01·02 | translucent + tint layers |
| `--lab-bg-material-muted-01` / `-02` | Backgrounds/Materials/Muted/01·02 | translucent + tint layers |
| `--lab-bg-material-soft-01` / `-02` | Backgrounds/Materials/Soft/01·02 | translucent + tint layers |
| `--lab-bg-material-subtle-01` / `-02` | Backgrounds/Materials/Subtle/01·02 | translucent + tint layers |

> Materials are two-layer recipes (`01` translucent base + `02` tint). The
> `mix-blend-mode` and `backdrop-filter` parts of the Figma material are **not**
> colors and are intentionally out of this contract — they belong to component CSS.

### Labels (36) — text / icon roles

Opacity ladder per family: Primary `@100`, Secondary `@72`, Tertiary `@52`,
Quaternary `@32`.

| Role family | Semantic path | Primary mapping |
| --- | --- | --- |
| `--lab-label-{primary,secondary,tertiary,quaternary}` | Labels/Neutral/* | Primary=N12; Secondary=N8 @72; Tertiary=N8 @52; Quaternary=N8 @32 |
| `--lab-label-inverted-{primary,secondary,tertiary,quaternary}` | Labels/Neutral/Inverted/* | Primary=N0; ladder on N4 |
| `--lab-label-brand-{primary,secondary,tertiary,quaternary}` | Labels/Brand/* | Primary=Brand; ladder @72/@52/@32 |
| `--lab-label-danger-{primary,secondary,tertiary,quaternary}` | Labels/Danger/* | Primary=Red; ladder |
| `--lab-label-warning-{primary,secondary,tertiary,quaternary}` | Labels/Warning/* | Primary=Orange; ladder |
| `--lab-label-success-{primary,secondary,tertiary,quaternary}` | Labels/Success/* | Primary=Green; ladder |
| `--lab-label-info-{primary,secondary,tertiary,quaternary}` | Labels/Info/* | Primary=Blue; ladder |
| `--lab-label-static-light-{primary,secondary,tertiary,quaternary}` | Labels/Static/Light/* | White ladder |
| `--lab-label-static-dark-{primary,secondary,tertiary,quaternary}` | Labels/Static/Dark/* | Dark ladder |

> `--lab-label-primary` is surface-relative: the stub value is the resolved
> snapshot anchor (`N12` on light, `N0` on dark), not a fixed near-white. The real
> engine recomputes it from the actual background.

### Fills (33) — tinted surface roles

Neutral fill base is `N6` (`#787880`). Sentiment ladder: Primary `@12`,
Secondary `@8`, Tertiary `@4`, Quaternary `@2`.

| Role family | Semantic path | Mapping |
| --- | --- | --- |
| `--lab-fill-{primary,secondary,tertiary,quaternary,none}` | Fills/Neutral/* | N6 Light @20/@16/@12/@8/@0 (Dark @36/@32/@24/@16/@0) |
| `--lab-fill-static-light-{primary,secondary,tertiary,quaternary}` | Fills/Neutral/Static/Light/* | N6 @20/@16/@12/@8 |
| `--lab-fill-static-dark-{primary,secondary,tertiary,quaternary}` | Fills/Neutral/Static/Dark/* | N6 @36/@32/@24/@16 |
| `--lab-fill-brand-{primary,secondary,tertiary,quaternary}` | Fills/Brand/* | Brand @12/@8/@4/@2 |
| `--lab-fill-danger-{primary,secondary,tertiary,quaternary}` | Fills/Danger/* | Red @12/@8/@4/@2 |
| `--lab-fill-warning-{primary,secondary,tertiary,quaternary}` | Fills/Warning/* | Orange @12/@8/@4/@2 |
| `--lab-fill-success-{primary,secondary,tertiary,quaternary}` | Fills/Success/* | Green @12/@8/@4/@2 |
| `--lab-fill-info-{primary,secondary,tertiary,quaternary}` | Fills/Info/* | Blue @12/@8/@4/@2 |

### Border (26) — stroke roles

| Role family | Semantic path | Mapping |
| --- | --- | --- |
| `--lab-border-strong` | Border/Neutral/Strong | N12 |
| `--lab-border-base` | Border/Neutral/Base | N6 @16 (Dark @20) |
| `--lab-border-soft` | Border/Neutral/Soft | N6 @8 (Dark @12) |
| `--lab-border-ghost` | Border/Neutral/Ghost | N6 @0 |
| `--lab-border-inverted` | Border/Neutral/Inverted | N0 |
| `--lab-border-static-light-{strong,base,soft}` | Border/Neutral/Static/Light/* | White / N6 @16 / @8 |
| `--lab-border-static-dark-{strong,base,soft}` | Border/Neutral/Static/Dark/* | Dark / N6 @20 / @12 |
| `--lab-border-{brand,danger,warning,success,info}-{strong,base,soft}` | Border/{sentiment}/* | Strong=accent; Base @20; Soft @12 |

### FX (15) — effects

| Role | Semantic path | Mapping |
| --- | --- | --- |
| `--lab-fx-glow-neutral` | FX/Glow/Neutral | White @52 |
| `--lab-fx-glow-inverted` | FX/Glow/Inverted | N4 |
| `--lab-fx-glow-{brand,danger,warning}` | FX/Glow/* | accent @52 |
| `--lab-fx-focus-ring-neutral` | FX/Focus-ring/Neutral | N12 |
| `--lab-fx-focus-ring-{brand,danger,warning}` | FX/Focus-ring/* | accent (opaque) |
| `--lab-fx-skeleton-base` | FX/Skeleton/Base | N6 @8 (Dark @12) |
| `--lab-fx-skeleton-highlight` | FX/Skeleton/Highlight | N6 @4 |
| `--lab-fx-shadow-minor` | FX/Shadow/Minor | Dark @1 (Dark-mode @2) |
| `--lab-fx-shadow-ambient` | FX/Shadow/Ambient | Dark @2 (Dark-mode @4) |
| `--lab-fx-shadow-penumbra` | FX/Shadow/Penumbra | Dark @4 (Dark-mode @12) |
| `--lab-fx-shadow-major` | FX/Shadow/Major | Dark @12 (Dark-mode @20) |

> Focus-ring **Success** and **Info** are absent from the source snapshot
> (Figma only ships Neutral/Brand/Danger/Warning focus rings); they are therefore
> **not** in the contract. Add them upstream first if a component needs them.

### Misc (3) — composed roles

| Role | Semantic path | Mapping |
| --- | --- | --- |
| `--lab-control-bg` | Misc/Control/Control-bg | Light=Backgrounds/Neutral/Primary; Dark=Fills/Neutral/Primary |
| `--lab-badge-label-contrast` | Misc/Badge/Label-contrast | Labels/Static/Dark/Primary |
| `--lab-badge-label-default` | Misc/Badge/Label-default | Labels/Static/Light/Primary |

### Backward-compatible aliases

The original 5-variable stub names are kept as aliases so existing consumers do not
break. Prefer the systematic roles above.

| Alias | Aliases to |
| --- | --- |
| `--lab-surface-base` | `--lab-bg-primary` |
| `--lab-surface-raised` | `--lab-bg-secondary` |
| `--lab-accent` | `--lab-label-brand-primary` |

(`--lab-label-primary` and `--lab-label-secondary` from the original stub already
exist as first-class roles in the Labels group, with the same names.)

## IC — reserved

The source snapshot ships **Increased-Contrast** variants (`Light-mode/IC`,
`Dark-mode/IC`) for every role. They are intentionally **not emitted** here yet —
the role *structure* is reserved, but IC values await design sign-off and a chosen
activation mechanism (e.g. a `[data-contrast="more"]` scope). When added, IC must
reuse the same `--lab-*` names under that scope; no new role names.

## Provenance & regeneration

`contract.css` and `roles.json` are generated from
`reference/labui-tokens-snapshot.dtcg.json` (the `4.2 Semantic` collection, modes
`Light-mode` / `Dark-mode`). Do not hand-edit individual values — re-derive from the
snapshot if they drift. The presence test guards the role **names**; **values** are
owned by the resolver and calibrated by the design owner.

## Swap-out plan

1. When `@labpics/colors` is published, replace the workspace `@labpics/colors`
   dependency target from this stub to the registry package.
2. The `--lab-*` variable **names** must not change, so consumers
   (`apps/docs`, components) need zero edits.
3. Delete `packages/colors-stub`.

Do **not** add a color resolver here. Missing core API is filed as a request to
`lab-colors-v1`, never implemented in LabUI.
