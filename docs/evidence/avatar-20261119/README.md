# Avatar material — 19 November 2026

The flat fallback is replaced by a finite offline material family shared by web
and Compose. The immutable source file is `LuaiBd4anRi4DMZayKAnY2`, version
`2423213750570316842`, Avatar set `6107:10719`. No Figma writes, copies, mode
switches or browser windows were used.

## Fidelity and generation

`assets/avatar/source/` contains two original 512px Figma layer exports. Their
hashes and variable identities are in `source.json`. The compiler preserves
source-over texture and applies W3C Color offline in sRGB. For increased
contrast it reconstructs dark coverage from the exported white/dark texture:
`premul C = A - A_dark × (1 - dark)`, then changes only the dark paint.
The channel estimate is bounded by the source alpha; no coefficient is fitted
to the two available dark specimens.

Every final variant is explicitly `offline-derived`. They are not represented
as exact Figma exports. `references/` retains the ten light PNGs and existing
blue/orange dark instances used for comparison. `source-vs-compiled.png` shows
actual 32/48px pairs: source left, compiled right. Source texture noise differs
between instances and export scales, so raw pixel error alone is not an
acceptance criterion. The authored volume, softness, saturation and holes were
visually accepted before integration.

The full-resolution source layers are necessary: REST PNG export is limited to
scale 4 (128px for this component). A read-only SVG export was tried, but its
exported filters did not reproduce the texture in Chromium (39.9/255 RGB MAE);
that alternative was discarded. Simple direct recoloring of a final PNG also
loses part of the material. The committed recipe keeps the independent layers.

## Installed consumer checks

- Packed Core/React/Tokens/Colors/Fonts and public adapters were installed into
  an external pnpm consumer, with no source aliases. ESM, CJS and SSR checks passed.
- The bundle emits hashed images under `dist/assets/`. Chromium 140, Firefox 141
  and WebKit 26 each load exactly one correct resource for Lit + React. See
  `installed-browsers.json`; this catches relative-URL failures hidden by Vite.
- Typed `@property` **`<url>`**, rather than `<image>` or an unregistered variable,
  resolves the URL against the defining stylesheet before inheritance. Theme
  asset declarations stay outside React's runtime-injected component CSS.
- The four themes, 32/48px rows, density 1/2 and 200% rem scaling at DPR 2 were
  rendered from the installed bundle. The last case paints a 96 CSS px / 192
  physical px Avatar from a 256px WebP. See `installed-web-*.png`.
- Compose was published as
  `pics.lab:ui-compose-desktop:0.1.0-avatar-material-final-20261119` to local Maven,
  then resolved by the separate `native-consumer/` build. Its test asserts a JAR
  code source, uses only public component APIs and renders all four modes at
  density 1/2/4 with SOFTWARE + headless. See `native-installed-*.png`.
- Core material/contract tests: 3 passed; Colors: 255 passed; browser Avatar
  suite: 7 passed; native Avatar suite: 5 passed. Typecheck passed.

The four original `installed-web-dark-{normal,more}-{100,200}.png` files were
captured before the newly selected CSS backgrounds decoded. Integration review
identified their flat discs. The first correction covered only the density-2
files and omitted the two density-1 files from pixel verification. All four are
now replaced from the integrated packed consumer; production material bytes
are unchanged. `web-consumer/capture.mjs` awaits each computed URL's
`Image.decode()` and records every PNG path it writes, including retained names.
`verify-capture.py` checks actual pixels and requires the complete set of
`installed-*.png` files in both evidence directories to be in that manifest.
The new package provenance, browser results and
native typography captures are in
[`../avatar-integration-20261119/`](../avatar-integration-20261119/README.md).

Native density resources are intentional. Sampling one 256px bitmap on the CPU
with Low, Medium or High filtering aliases the high-frequency noise at 32px.
Offline 48/72/96/144/192px rasters, selected by Compose's normal density resource
mechanism, restore softness without per-Avatar resampling or pixel loops.

For the native installed check, run the library's desktop publication task with
the version above, then run its wrapper with `-p docs/evidence/avatar-20261119/native-consumer`
and `-PuiRepository=<absolute local Maven repository>` and `test`. Set
`JAVA_TOOL_OPTIONS=-Djava.awt.headless=true -Dskiko.renderApi=SOFTWARE`.
Pass `-PuiVersion=<new coordinate version>` when checking a newer publication;
the consumer asserts that exact version in its JAR code source.
The web fixture is retained in `web-consumer/`; bundle it only after installing
the packed packages, with a file loader for WebP and fonts. The screenshots were
taken against that bundled output, not the workspace dev page.

For repeatable installed capture, install `@playwright/test` in that consumer,
copy `capture.mjs`, and run
`node capture.mjs <HTTP base URL> <integration evidence directory> <retained evidence directory>`.
Then run `python verify-capture.py <integration evidence directory>` with Pillow 13.
For installed hydration, also install `@lit-labs/ssr-client`, copy
`hydration.tsx` and `verify-hydration.mjs`, and run
`node verify-hydration.mjs <HTTP base URL> <result.json>` from the consumer.

## Cost

All 40 WebPs total 4,016,540 B in the package; native density PNGs total
6,421,743 B. They are independent resources, not entry-point payloads or an atlas.
The installed blue fallback loads **106,760 B once** for both 2 and 200 Avatar
instances. No other color or mode is requested. Its decoded web bitmap is
262,144 B; measured `createImageBitmap` decoding median 1.5–1.7 ms, p95 1.7–1.8 ms
in Chrome 157 on this machine (20 samples, diagnostic rather than a CI timing
limit). `installed-web.json` records the measurement.

Native decoding at density 1 uses 9,216 B per variant; density 2 uses 36,864 B;
density 4 uses 147,456 B. Resource lookup and decoded image caching are supplied
by Compose. Encoded hashes, pixel sizes and all density resources are recorded
in the common manifest; renderer color lists are generated from it/profile.

## Primary sources read

- [W3C compositing and blending](https://www.w3.org/TR/compositing-1/#blendingnonseparable)
- [CSS Properties and Values API](https://www.w3.org/TR/css-properties-values-api-1/#calculation-of-computed-values)
- [Compose resource usage](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-multiplatform-resources-usage.html)
- [Google lossless WebP](https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification)
- [Immutable Avatar source](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6107-10719)
