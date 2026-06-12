---
"@labpics/ui-tokens": minor
---

Make `@labpics/ui-tokens` real: a single typed config + pure generator produces
the LabUI dimension contract as three coherent artifacts (`tokens.css`,
`tokens.dtcg.json`, typed TS).

- **spacing** — linear rem multiplier on a 0.25rem base, explicit `space-0` zero
  token, semantic aliases (`xs..3xl`)
- **radii** — geometric rem progression + `full` pill (9999px) + `radius-0`
- **z-index** — Daniel's 15 semantic layers re-mapped to a collision-free,
  gap-100 monotonic sequence with documented purposes
- **typography** — continuous fluid gradient: `clamp(min, slope·vw + intercept,
  max)` per step with rem in every position (WCAG zoom), base 16px immovable at
  both anchors, display step damped (~57px narrow → ~112px wide), no media queries

Interface scaling is root font-size only (Unit 75–133% modes excluded). Every
scale defines an explicit zero token. Aliases resolve via `var()` references
(primitives → semantics → components).
