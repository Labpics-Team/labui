# @labpics/ui-tokens

LabUI dimension tokens: **spacing, radii, z-index, fluid typography, and
font-weight**, all generated from one typed config into three artifacts with no
divergence.

## The model

One config (`src/config`) is the single source of truth. A pure, idempotent
generator (`src/domain` + `src/generate`) produces:

| Artifact | What | Consumed by |
|---|---|---|
| `tokens.css` | `:root { --lab-* }` custom properties | the runtime contract — `@import "@labpics/ui-tokens/tokens.css"` |
| `tokens.dtcg.json` | canonical W3C DTCG export | future `figma-snapshot-export` round-trip |
| generated TS | typed `var(--lab-*)` refs + literal-union types | `import { space, fontSize } from "@labpics/ui-tokens"` |

**Three-language split:** primitives → semantic aliases → components consume
semantics only. Aliases are emitted as `var()` references, never duplicated
values, so re-theming via `:root` overrides just works at paint time.

**Interface scaling = root font-size.** Everything is rem-relative. The dead
Unit 75–133% modes do not exist; changing `font-size` on `:root` rescales every
dimension coherently.

**Every scale has an explicit zero token.** `--lab-space-0`, `--lab-radius-0`,
and the lowest z-index (`--lab-z-primary: 0`) are all defined — closing the
Figma `pt/0 @ 133.3%` data gap by design.

## Scales

### Spacing — linear rem multiplier (Tailwind v4 model)

`base = 0.25rem` (4px). Step `N` → `N × base`. Steps: `0, 1..12, 14, 16, 18, 20,
22, 24, 26, 28, 30, 32`. Semantic aliases: `none, xs, sm, md, lg, xl, 2xl, 3xl`.

| Step | rem | px (16px root) |
|---|---|---|
| `0` | 0rem | 0 |
| `1` | 0.25rem | 4 |
| `4` (md) | 1rem | 16 |
| `8` (xl) | 2rem | 32 |
| `16` (3xl) | 4rem | 64 |
| `32` | 8rem | 128 |

### Radii — geometric rem + pill

Steps `0, xs, sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl` (`0 → 3rem`), plus
`full = 9999px` (a semantic pill constant, **not** computed 50%). Aliases:
`none, control (8px), card (16px), pill, circle`.

### Z-index — 15 semantic gap-100 levels

Daniel's 15 Figma layers, re-mapped to a clean, collision-free, monotonic
sequence (gap 100, room to insert):

`primary 0 · secondary 100 · tertiary 200 · quaternary 300 · grouped-primary 400
· grouped-secondary 500 · grouped-tertiary 600 · inverted 700 · skip-link 800 ·
dropdown 900 · sticky 1000 · modal-underlay 1100 · modal 1200 · toast 1300 ·
tooltip 1400`

Each level documents its purpose. Components reach for a named layer, never a
magic number — no z-index wars.

### Typography — continuous fluid gradient (no media queries)

Each step is one `clamp(min, slope·vw + intercept, max)`. The min comes from
`base × ratioMin^n`, the max from `base × ratioMax^n`. Because `ratioMin <
ratioMax`, large steps are **damped**: their narrow-viewport floor is
disproportionately smaller, so headings grow slower on small screens while the
base step is identical at both anchors. **rem is kept in every clamp position**
(WCAG 1.4.4 zoom). No `@media`, ever — the words "mobile"/"desktop" never appear.

Default config: `base 16px`, anchors `320px / 1240px`, `ratioMin 1.2`,
`ratioMax 1.32`, `+7 / -2` steps.

| Step | label | narrow (320px) | wide (1240px) |
|---|---|---|---|
| 0 | md (base) | 16px | 16px (immovable) |
| +4 | 3xl | 33.2px | 48.6px |
| +7 | 6xl (display) | 57.3px | 111.7px |

The +7 display step is ~2× larger at the wide anchor than the narrow one — exactly
the requested damping.

### Font-weight — unitless themeable scale

Named roles → numeric weights, emitted as unitless `--lab-font-weight-*` tokens so
weight is a per-client axis instead of a literal baked into components. Default:
`regular 400`, `medium 500`, `semibold 600`, `bold 700`. Components read
`--lab-font-weight-semibold` (the emphasis weight) rather than a hard `600`; a client
re-weights its whole UI through the same override path as every other scale.

### Borders — stroke widths + focus ring

Line thickness is a themeable axis too. Stroke widths emit as `--lab-stroke-*`
(`hairline` 1px, `control` 1.5px, `thick` 2px) — deliberately **not** `--lab-border-*`,
which is the *colour* role namespace; a stroke is a dimension. The focus indicator is
its own sub-system, `--lab-focus-ring-width` / `--lab-focus-ring-offset` (both 2px by
default), so a brand can make its focus ring bolder or further out than its component
borders. Components read these tokens instead of literal `0.0625rem`/`0.0938rem`/`0.125rem`.

## Configuring

```ts
import { generateFromOverride } from '@labpics/ui-tokens';

// A user override merges over the defaults (records key-by-key; order-sensitive
// arrays replaced wholesale). Changing one ratio re-derives the whole scale.
const { css, dtcg, ts } = generateFromOverride({
  typography: { ratioMax: 1.4 },
  spacing: { steps: { '40': 40 } },
});
```

## Build

```sh
pnpm --filter @labpics/ui-tokens build   # generate → bundle → copy artifacts
pnpm --filter @labpics/ui-tokens test    # vitest: invariants + round-trip
```

Generated files in `src/generated/` are committed so consumers and the docs site
can import the CSS without running the generator.
