# ColorPicker qualification — 2026-11-23

Immutable source: [LabUI ColorPicker6387:45035](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6387-45035). Official `get_design_context`, screenshots and read-only geometry covered all15 authored variants; Figma was not edited or copied. The profile records390px width,24px padding,16px gaps,32px radius,120 standard and 100 LCH exact source paint samples. Native/web reuse Elevated, Geist1.400, SegmentedControl, Switch and public Icons.

The source examples contain mutually inconsistent values and raster previews. `lch(72.09 84.86 65.34)` projects through Color.js0.7.1 to sRGB `[0.9999709167090652, 0.5843105051189468, -0.00013225105424062494]`, approximately `#FF9500`, while source paint is `#FFAA00` and the displayed hue/RGB examples differ again. At that fixed L/C, integer sRGB hues are125–139; wide yellow/pink intervals in the authored raster do not represent those coordinates. Its apparent vertical graph domain also differs from the established reference.

The implementation keeps one actual structured selected color. Parent review accepted the reference domain145, or195 when Rec.2020 is shown, across all graph pixels, markers, ranges and pointer mappings. All three channel strips vary one coordinate while keeping the other two fixed, as the [reference range implementation](https://github.com/evilmartians/oklch-picker/blob/main/view/range/index.ts) specifies. [Reference configuration](https://github.com/evilmartians/oklch-picker/blob/main/config.ts) defines the domain. Transparent unavailable intervals are intentional; preview clipping never rewrites raw value. No hand-adjusted chroma taper or screenshot-specific numeric formula was introduced.

The actual graph shapes establish the authored row association: Lightness → fixed H (L×C triangle), Chroma → fixed L (H×C wave), Hue → fixed C (H×L islands). Spectrum LCH contains fixed H and fixed L planes. Upstream chart names denote the fixed coordinate, so copying their names as row labels would reverse the author's association.

Web behavior passed 22 tests per engine (44 total) in headless Chromium and WebKit: all15 view/model combinations retain raw FormData; precise alpha, reset, IME, pointer cancellation, controlled rejection, two-coordinate edits, graph cache and supported eyedropper/clipboard effects. Seven pure numeric tests independently check CSS D50 red, out-of-gamut preservation, exact serialization and fixed-coordinate edits. Native passed 19 tests plus common metadata compilation, including nullable cancellation, rejected null completion, exact partial LCH editing, pending sampler invalidation, endpoint handle clicks and both palette matrices. Its conversion oracle contains 2304 vectors.

Initial WebGL2 graph preparation observed1.1–3.7ms for the first graph and0.3–0.6ms for the following graphs on this Windows host. These are CPU submission times, not a GPU timing claim. Alpha edits do not increase graph paint counts. The CPU fallback was forced without WebGL2 and passed a stale-render comparison against a fresh final-value graph; the spectrum planes render at 340 by 163 CSS pixels inside their borders. CPU fallback is cancellable and yields between6ms slices; it uses CSS-pixel resolution. The final integrated capture observed142.7 and143.5ms across the two cooperatively scheduled planes; see `cpu.generated.json`. Earlier concurrent qualification observed158–241ms. These observations are not a universal latency bound or a controlled before/after performance comparison.

The eyedropper is a pixel-picking capability. Web uses official EyeDropper or a supplied `pickScreenColor` callback. Native exposes a suspend callback to a real host pixel picker and disables the button when unavailable. No generic color dialog is represented as an eyedropper. Clipboard is implemented through platform APIs. Headless tests verify effect success/cancel/rejection; they do not claim to have sampled a real OS pixel.

Public Icons0.4 was unavailable during qualification. Consumer installation used the root-verified tarball SHA256`d4962b817d19431393131f0aebb5d70f745e103e4062a6003a52926a8362c3bb` with a temporary override, absent from the committed manifests/lockfile. Baseline integration already had unrecorded Icons dependencies in its lockfile; this branch changes the lock only for its two actual dependencies.

Sources: [Color.js](https://github.com/color-js/color.js), [CSS Color4 conversion matrices](https://www.w3.org/TR/css-color-4/#color-conversion-code), [colormath](https://github.com/ajalt/colormath), [GPU reference renderer](https://github.com/dkryaklin/colordx-gpu), [browser EyeDropper](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper).


Installed tarball qualification passed ESM/CJS export and declaration checks, plus Lit, React, Vue, Solid, Svelte and Astro SSR/hydration in both Chromium and WebKit. The checks verify raw SSR value attributes, retained DOM, exact partial edits, FormData and reset. React submits its SSR hidden input before JavaScript; FACE submission for custom elements starts after hydration. `installed.generated.json` records the tested archives.

Independent review caught two assumptions in the first implementation: reusing the LCH grid for all models and displaying HEX channel bytes in decimal. A fresh read of all five Grid nodes established 120 cells/12 columns in the four standard models and 100 cells/10 columns in LCH; the four standard arrays are exactly equal. `figma-palettes.json` records the exact paint arrays and original HEX labels. Runtime selection, keyboard row navigation and both renderers now derive from the selected profile matrix.

## Integrated review corrections

The integrated source fix is `d2069a56`, on top of the ColorPicker/FileUpload merge
`16cce794` and Calendar merge `d18a1693`. A second independent pass reproduced a
focused Lit draft surviving native form reset. Reset now clears the editing
state and restores every text field, including the focused field, without
emitting a change. Twelve independent counterexamples covered HEX, opacity and
RGB-coordinate fields across both renderers and browsers.

Read-only Figma properties also distinguished hollow channel rings from filled
LCH Lightness/Chroma handles. Both renderers now use that shared profile and the
four-layer Shadow/XS. The small plane marker is 12px inside an outside 3px stroke
(18px overall); the large marker is 24px inside an outside 4px stroke (32px
overall). Rendering and pointer capture use the same geometry. Sources:
[RGB ring](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6390-49724),
[small marker](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6390-48190),
[large marker](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6390-51793).

The combined Calendar/ColorPicker browser run passed72 scenarios; the four new
ring pixel checks initially used an unsupported brightness expectation. The
corrected check compares the same strip pixel with and without its hollow ring.
All12 affected reset, ring, plane-style and pointer-cancellation scenarios then
passed in Chromium/WebKit. Core/React/docs typechecks,16 core value/SSR tests,
34 generator/catalog tests and the production documentation build passed.
Both installed-package scripts were repeated against the integrated archives:
all six renderers in both browser engines passed. Native's final affected
renderer checks and historical full checks are distinguished in its README.
The PNGs in this directory were recaptured from the integrated build; the
render script accepts `PW_BASE_URL` for an already-running local server.
