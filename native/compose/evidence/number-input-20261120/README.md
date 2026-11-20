# Native Number Input

`LabNumberInput` uses the existing `LabInput` frame, label notch, S/M/L metrics,
helper/error treatment and disabled/read-only states. There is no separate Number
Input Figma master: the two step controls reuse the Input accessory slot and the
Dropdown chevron geometry. Figma LabUI v2.1 was not changed.

The application owns the actual `TextFieldState`. There is no second text buffer,
numeric state or observation loop that overwrites application edits. Editing keeps
the draft, selection and IME composition. Enter, blur and software-keyboard Done
normalize a valid dot-decimal/exponent value and clamp it. Empty stays empty;
invalid input stays editable with an error. An application's form error always
takes priority and cannot be cleared by a local edit or step.

Up/Down step by `step`, Page Up/Down by ten steps in one operation. Both visible
buttons and the editor's accessibility actions use the same transition. Buttons
do not create additional Tab stops; editor shortcuts with modifiers remain native.
The Enter that finishes an IME composition does not also commit the number.

## Numeric boundary

Finite `Double?` bounds and a finite positive `Double` step keep the API convenient
for a Kotlin consumer. Their canonical decimal strings enter a small exact decimal
addition/comparison implementation. The draft's own digits are retained, including
digits beyond binary precision. There is no repeated binary accumulator: 1,000
increments of 0.1 produce exactly 100 and 1,000 decrements return exactly zero.

NaN, Infinity, invalid notation, binary overflow and underflow are rejected. A step
must also change the finite Double value in the requested direction. A step below
that resolution is unavailable; it is not enlarged, rounded to a different step,
or retried. At an explicit bound the transition clamps to that bound. Empty step
actions initialize zero clamped to the interval; out-of-range valid drafts recover
to the nearest bound. Direct decimal entry is not forced onto a step grid.

Text and its expanded decimal representation are limited to 1,024 characters.
Addition and comparison are linear in the bounded decimal length. Page actions
adjust a decimal exponent once; they do not repeat ten edits. Ordinary input
changes compute available actions once per draft/constraint change. No coroutine
collects every text change and no external arbitrary-precision package is added.

The alternative considered was [Kotlin Multiplatform BigNum](https://github.com/ionspin/kotlin-multiplatform-bignum),
whose own README describes its broader arbitrary integer/decimal API, rounding
modes and pre-1.0 API changes. Number Input only needs bounded signed addition and
comparison; keeping those operations local avoids a new transitive dependency and
platform version coordination. JVM `java.math.BigDecimal` is used only as an
independent test oracle, never by production common code.

## Sources and verification

- [WAI Spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/):
  one focusable editor, visible increase/decrease actions, arrow and page steps,
  retaining standard text editing. Native Compose exposes editor text plus named
  actions rather than claiming an unsupported ARIA role.
- [Compose state-based text fields](https://developer.android.com/develop/ui/compose/text/user-input):
  hoisted `TextFieldState`, real composition/selection and `onKeyboardAction` for
  software-keyboard Done. The local APIs compile against the repository's Compose
  Multiplatform version, rather than assuming the latest documentation version.
- [Kotlin `toDoubleOrNull`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.text/to-double-or-null.html):
  parsing is explicitly followed by finite/nonzero-underflow checks.

`NumberInputValueTest` compares 5,000 deterministic signed decimal additions and
comparisons against `BigDecimal`, and checks drift, bounds, invalid configuration,
subnormal steps, overflow, unavailable steps and the input-work bound.

`NumberInputRenderTest` uses a real `ImageComposeScene`, Foundation editor,
platform IME edit/action callbacks and software Skia. It covers keyboard/buttons,
blur and Done, composition completion, application state replacement, form errors,
disabled/read-only actions and Input S/M/L geometry at 100% and 200% text scale in
both themes. PNG evidence is generated under `build/number-input-evidence/`.

Verified on 2026-11-20: **14/14 tests passed** (8 real-editor/render cases and
6 numeric cases). The numeric suite took 0.221 s, including 5,000 independent
oracle comparisons; the render suite took 9.010 s. These are local verification
costs, not device latency benchmarks. The full incremental Gradle command took
36 s. The adjacent XML files record this run. All four PNGs were inspected:
[Light 100%](fields-Light-1.0.png), [Light 200%](fields-Light-2.0.png),
[Dark 100%](fields-Dark-1.0.png), [Dark 200%](fields-Dark-2.0.png).

Run on Windows without opening a platform window or an accessibility client:

```powershell
$env:JAVA_TOOL_OPTIONS='-Djava.awt.headless=true -Dskiko.renderApi=SOFTWARE'
native/compose/gradlew.bat -p native/compose :desktopTest `
  --tests pics.lab.ui.NumberInputValueTest --tests pics.lab.ui.NumberInputRenderTest `
  '-Pkotlin.compiler.execution.strategy=in-process' '-Dorg.gradle.jvmargs=-Xmx768m' `
  --max-workers=1 --no-daemon --console=plain
```

This is desktop headless qualification of common production code, not a claim of
device-level Android/iOS keyboard or assistive-technology testing.
