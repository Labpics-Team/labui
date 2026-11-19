# Avatar integration — 19 November 2026

Avatar from `096b61d831ce084c1dca625942cde43bf62cf922` is integrated on root
`ca8fec1`. Source commits are `dd92021`, `a6b8c28`, `4c20a08`. The existing
19 component profiles, typography resolution, SSR input restoration, conditional
package exports and current adapter generators are preserved. All authored
Avatar component, font and material bytes remain identical to the accepted
source freeze. Generated Colors programs and adapters come from the combined
sources; catalog provenance points at the integrated native code.

## Installed web

Fresh Core, React, Tokens, Colors, Fonts, Vue, Materials and Shadow tarballs were
installed outside the workspace. `verify.mjs` passed ESM, CJS, SSR, CSS and font
imports. An esbuild bundle has no source aliases and serves its hashed assets
under `/dist/assets/`.

`installed-materials.json` records Chromium 140, Firefox 141 and WebKit 26,
four appearance/contrast modes, both component sizes and both renderers.
Chromium also covers density 2. All 40 resource URLs load and decode. The 16
screenshots contain 640 Avatar discs; every inner crop has more than 100 distinct
RGB colors (observed minimum 226), so a flat fallback cannot pass as material.
The capture and pixel-verification scripts are retained in
[`../avatar-20261119/web-consumer/`](../avatar-20261119/web-consumer/).

Two earlier dark density-2 evidence images were captured too early. Their
replacements await `Image.decode()` for the actual computed background URLs
and two animation frames. This fixes the evidence path; it does not modify
the accepted material compiler or resources.

`installed-hydration.json` records the separate packed SSR consumer. Images
load before the hydration bundle is released; the original Lit and React image
nodes are reused, become visible after decoding, and react to later prop
updates. A true boolean SSR input survives constructor defaults and is later
updated to false. Browser errors must be empty.

## Installed Compose

The integration was published to an isolated local Maven repository as
`pics.lab:ui-compose-desktop:0.1.0-avatar-integrated-20261119` and consumed by an
independent Gradle build. The consumer asserts the exact version in its JAR
code source and uses public APIs only. Two tests passed with SOFTWARE rendering
and headless Java 21.

All four material modes at density 1, 2 and 4 are **pixel-identical** to the
accepted native screenshots. `installed-native.json` references their existing
files and hashes, avoiding duplicate images. Four new `native-letters-*.png`
captures show all three Avatar sizes beside the current `LabText` and
`LabButton`, at font scale 1 and 2 in light/dark themes. Both fonts are preloaded,
rendering must settle, and each Avatar's central crop must contain white letter
pixels inside its colored disc.

## Checks

- Full non-docs package build and Core/React/Tokens/codegen typechecks passed.
- Material compiler `--check`: 40 variants, zero changed outputs.
- Native component and Colors program `--check`: passed.
- Core Avatar: 3 tests; Colors: 256 tests; adapter-codegen: 32 tests.
- Browser Avatar: seven behaviors verified in Chromium and WebKit, including
  pre-hydration image reuse, failure/recovery and texture scope changes.
- Native Avatar: 5 tests; external Maven consumer: 2 tests.
- All non-Avatar component profiles equal root `ca8fec1` exactly.

The only browser assertion repair accepts the equivalent `px` or `rem` computed
gradient serialization. Presence-dot geometry and the RTL cutout direction are
still checked; no rendering source changed.
