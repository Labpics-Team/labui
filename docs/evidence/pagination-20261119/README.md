# Pagination — 19 November 2026

Read-only source: Lab UI v2.1, Pagination, Page-button, Chevron-button and
Compact Pagination. The source measurements and original PNG exports in this
directory were read without editing, copying or changing Figma modes.

The numbered profile preserves 40×40 controls, 12 px corners, 8 px gaps,
Geist Medium 16/24, Backgrounds/Neutral/Tertiary for the active page, Base border
and Quaternary hover fill. Page-button uses Hug sizing with 12 px padding, so
longer page numbers may widen the 40 px minimum. Compact preserves 8 px dots, 6 px receding edge dots,
a 20×8 temporal track, 8 px padding and Base material for Ambient. Static master
selection describes a position in the visible window; real page numbers come
from the consumer's collection.

`source-*.png` are original exports at 3×; `source-measurements.json` retains
geometry and typography without private Figma identifiers. The profile tests
compare the common data against those measurements. Source variables were
resolved from the saved original semantic-variable payload, not guessed from
their preview colors.

`packed.generated.json` records installed npm archive digests and two real
browser versions. `pagination-packed.mjs` installs independent archives,
renders the four generated SSR adapters plus native React, then hydrates those
server nodes without assigning missing properties. It verifies controlled
refusal, accepted data changes, authored dimensions, loaded Geist and zero
browser errors. The PNGs show the installed packages at 100% light and 200% dark.
All five installed renderers change the displayed records after an accepted
request. `browser-light.png` and `browser-dark.png` show both interactive demo
renderers after the final material fix, with Geist loaded and no page errors.

`pagination.spec.ts` exercises both renderers in Chromium and WebKit: actual
records, native destinations, passive ellipses, controlled refusal, stable
page-node identity, empty/invalid/shrinking datasets, keyboard activation,
compact window navigation, RTL and narrow 200% layout. All 18 browser tests
passed. The Ambient regression also measures the material surface against its
capsule at 100% and 200%; the shared material stylesheet must not override its
absolute position when React imports it after the component stylesheet.
The focus fixture advances a controlled acceptance by 100 ms with the browser
clock. It verifies accepted window replacement, continued arrow navigation,
refusal, leaving with Tab before acceptance and unrelated progress updates.
Temporal progress changes the fill's width, keeping its 8 px height and round
ends untransformed in both LTR and RTL. The initial three review regressions
failed before their respective fixes; final Chromium and WebKit checks passed.

Compose `PaginationRenderTest` passed all six tests and renders the same profile in both appearances,
LTR/RTL and 100/200% system font scales. It verifies accepted/rejected requests
and displayed records, disabled empty bounds and bounded allocation through
Int.MAX_VALUE. Direct keyboard events also verify one Compact Tab stop, RTL,
controlled refusal and overflow-safe movement at both page bounds. Before the
fix, the forward arrow at Int.MAX_VALUE requested page 1; the regression now
keeps the final page. `PaginationConsumerTest` compiles and changes the visible records
using the published local Maven artifact, with no source substitution.
An additional native focus regression accepts the request after an already
settled frame, preserving focus only when it remains inside Compact. Pointer
events verify both chevrons' default, hover and disabled pigment in both
appearances. `chevron-*.png` shows the native 3× default and hover controls.

Commands:

```sh
pnpm --filter @labpics/ui-tokens exec vitest run test/pagination-profile.test.ts
pnpm --filter @labpics/ui-core exec vitest run test/pagination-contract.test.ts
pnpm --filter @labpics/ui-docs exec playwright test tests/pagination.spec.ts --project=chromium --project=webkit --workers=1
node apps/docs/tests/pagination-packed.mjs
./gradlew :desktopTest --tests pics.lab.ui.PaginationRenderTest
```

The Maven consumer was run with uiVersion `0.1.0-pagination-20261119.3` and a
local published repository. Its existing Icons dependency used the local
qualified artifact `0.4.0-semantic.6`; neither coordinate is a public release.
