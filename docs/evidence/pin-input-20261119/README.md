# Pin Input — authored web/native verification

Source: immutable Lab UI v2.1, REST version `2423213750570316842`, observed
2026-11-19. The source was read and rendered only. `source.generated.json` records
all six Cell variants and both 4/6-digit groups; `figma-cells.png` is the original
render. Run `node scripts/verify-pin-input-source.mjs <read-only REST nodes JSON>`
to compare a fresh source response against the shared profile.

The authored cell is 48×56 / radius12 / stroke2 / gap12; filled mask dot8. Native
and both web renderers use the same profile. The Figma default dot has opacity
0.0001, so empty cells render without a visible dot. Visible numbers and auxiliary
captions are library extensions using the shared text roles.

`python docs/evidence/pin-input-20261119/compare-cells.py` compares the original
2× Figma raster with independently installed Chromium, WebKit and Compose cells.
All nine empty/filled/danger comparisons have mean absolute channel error below
**0.664 / 255**; `source-comparison.generated.json` records the individual results.

## Web

`apps/docs/tests/pin-input.spec.ts` covers the existing editing/ARIA contract;
`pin-input-author.spec.ts` covers authored geometry, real FormData and validity,
cancelled reset, changing count, controlled refusal, fieldset disabling, state
restoration, IME final-event ordering and two-character autofill. Chromium and
WebKit passed. `packages/core/test/pin-input-ssr.test.ts` checks the server's actual
declarative shadow DOM, values, mask and associations.

The review regressions invoke `requestSubmit()` synchronously inside completion,
checking both `FormData` and browser validity before any later render. The
installed consumer hydrates dirty `92`, whole-code autofill `6789` and a controlled
`12`; it also checks reset to the original server default. Invalid pre-hydration
numeric/alphabetic/alphanumeric text stays available for correction, blocks native
validation, and becomes a complete valid code through ordinary paste.
The multiple-code React form regression checks that passive validation preserves
focus and that submission focuses the first invalid code without a focus cycle.

`node apps/docs/tests/pin-input-packed.mjs` packs and installs real npm archives into
an isolated temporary consumer, bundles `web-consumer/`, runs both browsers and
removes the temporary installation. `installed-web.generated.json` records geometry,
zero axe violations and **0 idle RAF / 0 idle timers over 250ms** after settling.
The twelve `web-*.png` files show light/dark at 100/125/200% root text scale. Fractional
CSS borders can snap to physical pixels; the check allows less than one physical
pixel for the 125% stroke while checking cell geometry exactly.

## Native

The reusable public-API `PinInputRenderTest` tests the real Compose text editor:
paste, rejected characters, arrows, Backspace, changing count, reset, readonly,
secure password/copy semantics, cell-specific hover and idle frame settlement.
The review regressions additionally cover programmatic edits, replacement state,
simultaneous count/text changes, preservation of reversed selection, taps after
state replacement and real native keyboard replacement of selected characters.
An intercepted native input-method session sends composing/commit commands and
checks that valid IME composition survives text observation and count changes.
All renders use `ImageComposeScene`, Java headless and Skiko SOFTWARE.

The independent `native-consumer` resolves a published JAR and verifies its
`0.1.0-pin-review-20261120` coordinate in the class code source. It reuses only the test
source; the component comes from Maven. `native-*.png` are installed-consumer
captures at light/dark and 100/125/200% density.
Six `native-selection-*.png` captures show caret, full and partial ranges in
visible and masked fields. Their selection colors are supplied through Compose's
shared `LocalTextSelectionColors`, and reversed ranges paint the same selected cells.
All seven installed tests passed; `installed-native.generated.json` records the run.

```powershell
$env:JAVA_HOME='C:/Program Files/Zulu/zulu-21'
$env:JAVA_TOOL_OPTIONS='-Djava.awt.headless=true -Dskiko.renderApi=SOFTWARE'
$env:SKIKO_RENDER_API='SOFTWARE'
native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.PinInputRenderTest
native/compose/gradlew.bat -p native/compose publishDesktopPublicationToDistributionRepository '-PpublicationVersion=0.1.0-pin-review-20261120' '-PpublicationRepository=<absolute scratch repository>'
native/compose/gradlew.bat -p docs/evidence/pin-input-20261119/native-consumer test '-PuiRepository=<absolute scratch repository>' '-PuiVersion=0.1.0-pin-review-20261120'
```

References: [Zag Pin Input](https://zagjs.com/components/pin-input),
[Compose text input](https://developer.android.com/develop/ui/compose/text/user-input),
[Compose side effects](https://developer.android.com/develop/ui/compose/side-effects),
[Figma source](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6202-7355).

Integration check (20 November): the packed consumer passed again in Chromium
and WebKit on the combined Icon/Drag Button/Pin Input branch. Icons came from
release CI's exact 0.4.0 archive (SHA256
`d4962b817d19431393131f0aebb5d70f745e103e4062a6003a52926a8362c3bb`),
through `LAB_ICONS_TARBALL`; `publicIcons: false` records that npm publication
is still pending. The seven Pin Input and seven Drag Button native tests passed
together using public Icons Maven 0.4.0. Independent review also confirmed that
multiple invalid React fields retain focus during `checkValidity()` and focus
the first invalid field on submission without an asynchronous focus cycle.
