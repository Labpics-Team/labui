# Calendar — web qualification, 2026-11-23

Calendar/Mini, Gridcell and Status Dots were implemented from the read-only
official Figma source. The shared component profile supplies dimensions,
typography, colors, dot contours and range/focus geometry to web and Compose.

## Executed checks

- Seven core contract/SSR tests passed.
- Twenty-two interaction tests passed in Chromium 140.0.7339.186 and WebKit 26.0
  (11 scenarios per browser), plus the centered-flex intrinsic-size regression
  in both browsers.
- Core, React, Vue, Solid, Svelte and Astro builds passed. Core, React, docs and
  adapter-codegen TypeScript checks passed; generated adapters reproduced with
  zero further changes. All 34 adapter-codegen/catalog tests passed after the
  native source commit; catalog:generate and catalog:check passed.
- The installed consumer packs the real packages into an isolated directory,
  resolves public exports and declarations, renders SSR for Lit, React ESM/CJS
  and all four generated adapters, then mounts all six in Chromium and WebKit.
  React hydrates its actual server HTML with recoverable hydration errors treated
  as failures; Astro hydrates declarative shadow DOM. Selection, month changes,
  FormData, square grid geometry, unavailable dates and translated event labels
  passed. [packed.json](packed.json) records the exact archive SHA-256 hashes.
- [render.generated.json](render.generated.json) records 320 × 364 S and
  400 × 472 M surfaces, square 288/352 grids, 42 dates and source typography.
  Axe reported no violations with all applicable default rules enabled.

The 56 PNGs include the Lit/React × S/M × light/dark × single/range/disabled
matrix, hover/focus, S/M × LTR/RTL × start/middle/end range focus, narrow 200%
text and forced colors. Captures were visually opened after the final CSS
changes. At 390px and 200% text the month remains fully readable, navigation
wraps below it, and the date grid scrolls internally without document overflow.
The forced-color navigation masks use ButtonText/GrayText, preserving system
contrast. This is a real browser render, not an image of the Figma source.
The production documentation build also passed. [docs-page.png](docs-page.png)
shows the actual `/components.html?component=calendar` route; its live range
selection completed without browser errors, recorded in [docs-page.json](docs-page.json).
The documentation also fits 390px at both 100% and 200% text. Its anatomy/live
containers allow shrinking and the API group scrolls locally. This corrected
the shared template's automatic grid minimum without reducing text size.

## Behavior and corrections

The interaction checks cover uncontrolled reset, accepted/refused controlled
value and month, range reversal and month crossing, unavailable interior dates,
keyboard week/month/year movement, explicit/inherited RTL, readonly, disabled,
required partial ranges, and updates to date bounds. Dates are Gregorian ISO
calendar values, including years 1–9999, rather than timestamps.

Independent review found and verified fixes for navigation borders, inherited
React RTL, a rejected May 31 → June 1 month transition, serializable SSR
restrictions and event translations, and focus after delayed month acceptance.
The last focus cancellation was repeated independently six times per browser:
moving to Reset while the month request is pending must retain Reset focus.
Range focus follows the source's open internal edges. Adjacent-month dates are
passive references; keyboard or header navigation changes the displayed month.

The installed consumer caught CSS removal by tree shaking; calendar.css is now
declared as a side effect. Applications rendering React on the server import
`@labpics/ui-core/calendar.css` into the server CSS entry for styled first paint.
Generated SSR carries unavailableDates and string event templates; JavaScript
callbacks remain client input, as documented in [the contract](../../reference/calendar.md).

The production documentation table exposed a sizing issue hidden by the
fixed-container fixture: inline-size containment erased the calendar's
intrinsic width inside centered flex. The component now supplies its authored
intrinsic width and limits the Lit host to its parent. The ordinary source
dimensions and the separate 200% grid-scroll checks still pass.
The responsive fixture's grid uses `minmax(0,1fr)` so the column is constrained
by its available width rather than an intermediate renderer wrapper's automatic
minimum. Independent Chromium/WebKit experiments confirmed both components fit
a fixed 358px flex parent, and only the ancestor's plain `1fr` expanded to 800px
at 200%. See [CSS Grid §6.6](https://www.w3.org/TR/css-grid-1/#min-size-auto).

## Reproduction and limits

```powershell
pnpm --filter @labpics/ui-core exec vitest run test/calendar-contract.test.ts test/calendar-ssr.test.ts
$env:PW_PORT='4427'
pnpm --filter @labpics/ui-docs exec playwright test tests/calendar.spec.ts --project=chromium --project=webkit --workers=1
node apps/docs/tests/calendar-render.mjs
node apps/docs/tests/calendar-packed.mjs
node apps/docs/tests/calendar-docs.mjs
```

The interaction/render scripts use a docs Vite server on 127.0.0.1:4427;
the packed consumer starts and removes its own isolated installation/server.
The docs script checks a production preview on 127.0.0.1:4428 (or PW_DOCS_URL).
The qualification used the verified Icons 0.4.0 tarball through
`LAB_ICONS_TARBALL`, only in that temporary consumer. Its SHA-256 is
`d4962b817d19431393131f0aebb5d70f745e103e4062a6003a52926a8362c3bb`.
This does not claim an Icons registry publication or a frozen workspace install.
Colors remains 1.0.3. No screen reader, Android or iOS runtime result is claimed
by these web tests; [native evidence](../../../native/compose/evidence/calendar-20261123/README.md)
records 14 software/headless tests, 26 PNGs and platform limits separately.
The mixed development Lit SSR shim/React process prints React useLayoutEffect
SSR warnings; actual React browser hydration completes without recoverable errors.

Primary sources: [Calendar/Mini](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6094-1293),
[Gridcell](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6091-5575),
[Status Dots](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6091-5057),
[Zag Date Picker](https://zagjs.com/components/date-picker),
[Internationalized Date](https://react-spectrum.adobe.com/internationalized/date/index.html),
[Kotlin LocalDate](https://kotlinlang.org/api/kotlinx-datetime/kotlinx-datetime/kotlinx-datetime/-local-date/).
The Figma sample says May 2025 while its weekdays depict May 2024; the component
calculates actual weekdays instead of preserving that sample discrepancy.
