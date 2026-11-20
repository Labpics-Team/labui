# Tooltip evidence

Source implementation: `4a8ada00`, reviewed accessibility/lifecycle corrections `6201e20a`, keyboard ordering `0f6b9c67`, native tail alignment `6dc18043`. Figma was read only: frame `6203:2958`, version `2423213750570316842`. [`figma-source.json`](figma-source.json) preserves the 24 direction/type components and six authored tails; [`figma-source.png`](figma-source.png) is the original frame render.

[`comparison.png`](comparison.png) places unscaled crops from Figma, installed Chromium/WebKit consumers and the Compose popup together. Body height is 48 px, Geist is 16/24 with −0.25 tracking, padding/radius are 12, smoothing is 0.6. The Figma specimen has width 202 px; the browser's text-derived width is 200.9375 px and Compose rounds it to 201 px. We preserve font metrics and content sizing rather than force the specimen width. Raster antialiasing, shadow blur and the Figma frame background differ by renderer.

The `chromium-*` and `webkit-*` images cover all three types, both tails, both themes, installed React and four adapter SSR helpers upgraded by Lit. The separate `framework-*` images come from real Vue/Solid/Svelte SSR + hydration and an actual Astro build. `native/` includes all eight Neutral/Chevron placements, all type/tail/theme combinations at Top, horizontal LTR/RTL tails, 200% text and four installed consumer renders. The native render test exercised all 96 type/tail/theme/placement combinations through the actual Foundation popup.

## Verified consumer paths

| Check | Result |
| --- | --- |
| Source extraction against `components.json` | 24 solid variants, Body, smoothing, four shadow layers and six tail paths agree |
| Native generated profile | `generate-components.mjs --check` passes |
| Package builds; core, React and docs TypeScript | Pass |
| Browser behavior | 25 pass in Chromium/WebKit; Chromium-specific accessibility-tree test skipped in WebKit. Includes composed descriptions, live slot text, reconnect, Tab and microtask focus transfer |
| Installed npm, React 18.3.1 and 19.2.0 | React/Core ESM/CJS/types, React SSR/hydration, four adapter SSR helpers, one actual control, hover/focus/Escape, descriptions, ref/cleanup and Lit reconnect; both browsers pass |
| Real installed frameworks | Eight cases pass: Vue/Solid/Svelte SSR + hydration and Astro build, Chromium/WebKit; original host/control identity, authored metrics, reactive props, events and teardown |
| Compose desktop | Four tests pass: keyboard/semantic long press, 96 real popup renders and 200% text, viewport placement, actual horizontal tail alignment and physical LTR/RTL bounds |
| Installed Maven consumer r5 | One test passes across two themes × text scales 1/2; focus remains on the actual Button |
| Catalog | 47 families, 103 semantic source references; API and bindings validated |

[`packed.json`](packed.json) and [`packed-react19.json`](packed-react19.json) record the exact npm archive hashes and browser metrics. Icons 0.4.0 came from its exact CI tarball, whose hash is recorded; a public npm installation is **not** claimed. The isolated npm consumer runs outside the workspace, then removes its temporary directory. It fails on browser errors and missing assets.

[`frameworks.json`](frameworks.json) records the separately installed public Vue/Solid/Svelte bindings, `Tooltip.astro`, real compiler/build commands, archive hashes and all eight results. This is separate from the SSR-helper exercise above.

[`native.json`](native.json) records the published Maven coordinates, artifact hashes, source hashes and test results. The consumer resolves `pics.lab:ui-compose:0.1.0-tooltip-20261120-r5` from the local Maven repository; it does not compile linked library sources. The published sources JAR matches the committed Tooltip implementation. XML reports are in `native/`. These checks exercise Compose Desktop; Android/iOS execution and public Maven publication are not claimed here. Native Escape follows the documented Foundation/Material3 trigger-local contract.

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
node apps/docs/tests/tooltip-frameworks-packed.mjs

# In native/compose, with Java 21 and headless software Skiko:
./gradlew.bat :desktopTest --tests pics.lab.ui.TooltipRenderTest
./gradlew.bat :publishDesktopPublicationToDistributionRepository :publishKotlinMultiplatformPublicationToDistributionRepository :ui-colors:publishDesktopPublicationToDistributionRepository :ui-colors:publishKotlinMultiplatformPublicationToDistributionRepository '-PpublicationVersion=0.1.0-tooltip-20261120-r5'
# In native/compose/consumer, uiRepository is the absolute path to the published repository:
../gradlew.bat :desktopTest --tests pics.lab.ui.sample.TooltipConsumerTest '-PuiVersion=0.1.0-tooltip-20261120-r5' '-PuiRepository=<repository>'
```

The design and runtime contract, deliberate extensions and primary references are in [`docs/reference/tooltip.md`](../../reference/tooltip.md).

[`review.md`](review.md) records the independent review, resolved counterexamples and final verification boundaries.

Integration on 20 November: the combined Icon/Drag Button/Pin Input/Slider/Tooltip
branch passed the installed React 18 consumer and all eight real framework
SSR/hydration/build cases after the shared Svelte binding and Icon DOM fixes.
The four native render tests and common Kotlin metadata passed with public
Icons Maven 0.4.0. The web tests still use release CI's exact Icons npm archive;
the public npm check remains pending publication.
