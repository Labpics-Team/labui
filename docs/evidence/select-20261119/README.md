# Select: authored composition and installed consumers

Source: Figma file `LuaiBd4anRi4DMZayKAnY2`, version
`2423213750570316842`; Dropdown `6212:445`, Multiselect `6214:4162`.
The immutable identifiers and decorative leading path are in `source.json`.
The read-only source cache was used; no Figma document was changed.

## What was verified

- Dropdown S/M/L: 32/48/56 CSS px and Compose dp at 100%; an optional leading
  slot; authored border, radius, spacing and chevron. Dropdown has no visible
  external caption. Its accessible label remains present.
- Multiselect: 48 px minimum frame, internal caption, 28 px sharp Chips,
  wrapping, empty placeholder, disabled state and independent removal actions.
  Compose reserves the supplied width even when selection is empty, keeps the
  chevron at the trailing edge, and grows the empty frame for larger text.
- Accepted values survive rejected or delayed requests, item disappearance,
  reset and empty-string keys. Browser native input reads selected options.
  Cancelled reset preserves state, reset follows the current React `form`
  association, and disabled fieldsets respect each first-legend exception.
- Keyboard navigation, disabled-option skipping, Home/End, Escape and focus
  return, including RTL. No removal button is inside the trigger button.

`select.spec.ts` passed 52 checks in Chromium and WebKit. `select-author.spec.ts`
passed 10 checks after its keyboard test was corrected to wait for actual
listbox focus before Escape; visibility alone preceded Zag's scheduled focus.
The core SSR suite passed 2 tests; React and docs type checking passed.

`select-packed.mjs` built eleven npm archives, installed them outside the
workspace, checked public TypeScript imports, and rendered in both engines.
Vue/Solid/Svelte/Astro SSR helpers and native React render chips with JavaScript
disabled. Hydration preserves the original buttons. The connected consumer
checks FormData, removal, reset, controlled rejection and empty keys. Archive
SHA256 values, browser versions and measured frames are in
`installed.generated.json`.

Compose `SelectRenderTest` passed 3 tests, including six render scenes: light
and dark at text scales 100/125/200%, density 2. `SelectConsumerTest` passed the
same six themes/scales at density 1 against a locally published Maven artifact,
without composite source substitution. The consumer rejects then accepts a
removal, saves the accepted state, resets and saves again. Artifact hashes and
test summaries are in `native.generated.json`.

The native checks were repeated from the integrated source revision `394a3d9`
after the accepted LabText fixes for complete glyph ink and caller clipping
(`73ad8e9`, `e1affb9`). All three component tests and all six installed-consumer
scenes passed with Maven version `0.1.0-select-20261119.3`. Gradle confirmed the
published `ui-compose-desktop` runtime variant; see
`native-runtime-dependency.txt`. All twelve new scenes were visually inspected
for captions, empty frames, trailing chevrons, wrapping and enlarged text. The
image hashes match the preceding Select scenes. This repeat replaces the earlier
native proof that depended on the unresolved typography implementation; the
unchanged browser source and its evidence were not rerun.

## Images and limits

`chromium-*` and `webkit-*` contain 72 installed-consumer images: three sizes,
Multiselect, long/disabled/hover states and the open list at each theme/scale.
Web scale changes the root font size, scaling rem geometry too; Compose changes
fontScale while keeping dp geometry. These are distinct platform scale paths.
`native-*` and `consumer-*` contain the twelve Compose scenes. Native Dropdown
scenes deliberately show the no-leading branch; browser scenes supply the source
decorative leading slot.

`compare-source-*` place the Figma export above the light Chromium result at
100%, both rendered at 2×. The source's exported bounds include fractional
stroke/text overhangs: these are visual comparisons, not pixel-identity claims.
The runtime uses the shared system font/color roles and Chip profile. It does
not add a component-specific font or compensate widths for one sample word.

All verification was headless/offscreen with software rendering. These runs
do not prove Android/iOS rendering, system screen-reader speech or public
registry publication. The local Maven version is an integration artifact.

## Reproduce

After building the tokens/core/React and generated adapter packages:

```sh
pnpm --filter @labpics/ui-core exec vitest run test/select-ssr.test.ts
pnpm --filter @labpics/ui-docs exec playwright test select.spec.ts select-author.spec.ts --project=chromium --project=webkit --workers=1
node apps/docs/tests/select-packed.mjs
node native/compose/scripts/generate-components.mjs --check
```

Run Compose with Java 21, `JAVA_TOOL_OPTIONS=-Djava.awt.headless=true` and
`SKIKO_RENDER_API=SOFTWARE`:

```sh
native/compose/gradlew -p native/compose :desktopTest --tests pics.lab.ui.SelectRenderTest
```

Publish `ui-compose` and `ui-colors` desktop and KotlinMultiplatform publications
to a local Maven repository using `publicationVersion`/`publicationRepository`.
Point the separate consumer build at that repository with `uiVersion` and
`uiRepository` (leave `uiSource` unset), then run:

```sh
native/compose/gradlew -p native/compose/consumer :desktopTest --tests pics.lab.ui.sample.SelectConsumerTest
```

The leading colon prevents Gradle from also selecting matching test tasks in
included builds. PNGs are written to `native/compose/build/select-evidence` and
`native/compose/consumer/build/select-consumer`.

[Select contract](../../reference/select.md) ·
[HTML selectedOptions](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/selectedOptions) ·
[current form association](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/form) ·
[form reset event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/reset_event).
