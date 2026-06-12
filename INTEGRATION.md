# Color core integration (`@labpics/colors`)

LabUI **consumes** the color core. It does not implement a color resolver, does
not copy `semantic.rs`, and does not build a WASM color engine. The only seam is
the CSS custom-property contract: variables prefixed `--lab-*`.

## Current state — stub

`@labpics/colors` is **not published to npm yet**. It is produced by the
`lab-colors-v1` epic, chapter `native-and-release`; its runtime engine
(chapter `runtime-engine`) resolves the `--lab-*` properties from the background
at runtime.

Until the package ships, this repo vendors the contract as a local workspace
stub: [`packages/colors-stub`](packages/colors-stub/) is published into the
workspace under the name `@labpics/colors`. `apps/docs` depends on it via
`workspace:*` and imports `@labpics/colors/contract.css`.

The `apps/docs` smoke test asserts that the heading's computed color equals the
resolved `--lab-label-primary` token — proving the integration point works.

## Swap-out (when the core is published)

1. Repoint the `@labpics/colors` dependency from the workspace stub to the
   published registry version.
2. The `--lab-*` variable **names** are the contract and must not change, so
   `apps/docs` and future components need **zero** edits.
3. Delete `packages/colors-stub`.

## Open requests to `lab-colors-v1`

| Need | Status |
| ---- | ------ |
| Published `@labpics/colors` npm package exposing a CSS entry (`contract.css` or equivalent) and/or a JS runtime that injects `--lab-*`. | **Open** — filed against `lab-colors-v1` (`native-and-release` / `runtime-engine`). LabUI must not implement it. |
| **JND-calibrated shadow alphas** for the four shadow layers, written to the existing `--lab-shadow-alpha-{minor,ambient,penumbra,major}` contract. `@labpics/ui-shadow` ships with PROVISIONAL Figma values (light @1/@2/@4/@12, dark @2/@4/@12/@20) behind these names; the final alphas come from the JND surface contracts. | **Open** — filed against `lab-colors-v1` (`surface-jnd-contracts`). LabUI must not compute JND/derive the solver. Swap-in is a no-op: same variable names, no geometry change. |
| **Per-surface shadow tint** `--lab-surface-shadow-tint` — the surface hue a shadow should be tinted with (the shadow is the surface's own colour, never pure black). `@labpics/ui-shadow` reads it and falls back to the theme dark anchor (`#101012`) when absent. | **Open** — filed against `lab-colors-v1` (`runtime-engine` resolves surface roles). LabUI only consumes the variable. |

Any further missing core API (e.g. a token for a specific surface role) is filed
as a request to `lab-colors-v1`, never implemented inside LabUI.
