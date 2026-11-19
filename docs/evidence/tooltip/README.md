# Tooltip evidence

Source implementation: `4a8ada00`. Figma was read only: frame `6203:2958`, version `2423213750570316842`. [`figma-source.json`](figma-source.json) preserves the 24 direction/type components and six authored tails; [`figma-source.png`](figma-source.png) is the original frame render.

[`comparison.png`](comparison.png) places unscaled crops from Figma, installed Chromium/WebKit consumers and the Compose popup together. Body height is 48 px, Geist is 16/24 with −0.25 tracking, padding/radius are 12, smoothing is 0.6. The Figma specimen has width 202 px; the browser's text-derived width is 200.9375 px and Compose rounds it to 201 px. We preserve font metrics and content sizing rather than force the specimen width. Raster antialiasing, shadow blur and the Figma frame background differ by renderer.

The `chromium-*` and `webkit-*` images cover all three types, both tails, both themes, and five installed web renderers. `native/` includes all eight Neutral/Chevron placements, all type/tail/theme combinations at Top, 200% text and four installed consumer renders. The native render test exercised all 96 type/tail/theme/placement combinations through the actual Foundation popup.

## Verified consumer paths

| Check | Result |
| --- | --- |
| Source extraction against `components.json` | 24 solid variants, Body, smoothing, four shadow layers and six tail paths agree |
| Native generated profile | `generate-components.mjs --check` passes |
| Package builds; core, React and docs TypeScript | Pass |
| Browser behavior | 19 pass in Chromium/WebKit; Chromium-specific accessibility-tree test skipped in WebKit |
| Installed npm, React 18.3.1 and 19.2.0 | ESM/CJS/types, SSR/hydration, one actual control, hover/focus/Escape, accessible descriptions, preserved consumer ref and cleanup; both browsers pass |
| Compose desktop | Three tests pass: keyboard/semantic long press, 96 real popup renders and 200% text, viewport/RTL placement |
| Installed Maven consumer r3 | One test passes across two themes × text scales 1/2; focus remains on the actual Button |
| Catalog | 47 families, 103 semantic source references; API and bindings validated |

[`packed.json`](packed.json) and [`packed-react19.json`](packed-react19.json) record the exact npm archive hashes and browser metrics. Icons 0.4.0 came from its exact CI tarball, whose hash is recorded; a public npm installation is **not** claimed. The isolated npm consumer runs outside the workspace, then removes its temporary directory. It fails on browser errors and missing assets.

[`native.json`](native.json) records the published Maven coordinates, artifact hashes, source hashes and test results. The consumer resolves `pics.lab:ui-compose:0.1.0-tooltip-20261120-r3` from the local Maven repository; it does not compile linked library sources. The published sources JAR matches the committed Tooltip implementation. XML reports are in `native/`. These checks exercise Compose Desktop; Android/iOS execution and public Maven publication are not claimed here.

## Reproduce

```powershell
node scripts/verify-tooltip-source.mjs
node native/compose/scripts/generate-components.mjs --check
pnpm -r --filter './packages/**' build
pnpm --filter @labpics/ui-docs exec playwright test tooltip.spec.ts --project chromium --project webkit --workers=2

# Set PLAYWRIGHT_BROWSERS_PATH and optionally LAB_ICONS_TARBALL for the exact CI artifact.
$env:LAB_TOOLTIP_REACT_VERSION='18.3.1'
node apps/docs/tests/tooltip-packed.mjs
$env:LAB_TOOLTIP_REACT_VERSION='19.2.0'
node apps/docs/tests/tooltip-packed.mjs

# In native/compose, with Java 21 and headless software Skiko:
./gradlew.bat :desktopTest --tests pics.lab.ui.TooltipRenderTest
./gradlew.bat :publishDesktopPublicationToDistributionRepository :publishKotlinMultiplatformPublicationToDistributionRepository :ui-colors:publishDesktopPublicationToDistributionRepository :ui-colors:publishKotlinMultiplatformPublicationToDistributionRepository '-PpublicationVersion=0.1.0-tooltip-20261120-r3'
# In native/compose/consumer, uiRepository is the absolute path to the published repository:
../gradlew.bat :desktopTest --tests pics.lab.ui.sample.TooltipConsumerTest '-PuiVersion=0.1.0-tooltip-20261120-r3' '-PuiRepository=<repository>'
```

The design and runtime contract, deliberate extensions and primary references are in [`docs/reference/tooltip.md`](../../reference/tooltip.md).
