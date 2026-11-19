# Pin Input

`lab-pin-input`, React `PinInput` and Compose `LabPinInput` implement the immutable
Lab UI Input Pin and Input Pin / Cell. The shared `pin-input` profile in
`packages/tokens/src/components.json` owns geometry, semantic paints and text roles.
Lit and React use one generated stylesheet; Compose consumes generated metrics.

The authored M cell is 48×56, radius 12, inside stroke 2; cells have a 12 gap.
The source has 4- and 6-digit groups and six cell states: empty, filled and danger,
each with hover. A filled masked cell contains an 8px circle. Empty source dots have
opacity 0.0001 and are visually absent. Keyboard focus adds the source focus ring.
S/L, visible characters, warning/success, disabled and readonly are library
extensions. Visible characters use the shared Body role; auxiliary text uses Caption/S.

## Web

```html
<form>
  <lab-pin-input name="code" label="Код подтверждения" count="6" otp required>
  </lab-pin-input>
  <button type="reset">Сбросить</button>
</form>
```

`value` is controlled when supplied, including a JavaScript property assignment.
The consumer accepts an edit by updating that property in `value-change`; ignoring
the event keeps the accepted value. Omit `value` for local editing initialized by
`defaultValue` / `default-value`. `currentValue` reads the accepted Lit value.
React has the same `value` / `defaultValue` modes and `onValueChange(value, string)`.
Both expose completion; Lit also emits `value-invalid` for rejected characters.
Completion observes the accepted, type-valid code. The browser form value and
validity are synchronized before calling the handler, so `requestSubmit()` works
inside it. Uncontrolled hydration retains dirty native cells, including a code
autofilled before JavaScript loaded; reset still returns to the server default.
Recovered characters outside `valueType` remain editable and invalidate the form
until corrected. The character rule also applies to externally controlled values.

Zag owns navigation, insertion, deletion, paste, roving focus and completion. The
shared integration adapts dynamic count, IME composition and short autofill for
Zag 1.41.2 without copying its state machine. IME commits once even when the browser
sends another input after compositionend. Changing `count` keeps the visible prefix
and cannot submit an invisible suffix. Counts are bounded to 1–32; authored counts
are 4/6. Numeric, alphabetic and alphanumeric values use ASCII character sets.

The Lit host is form-associated. Its `name`, external `form` attribute, disabled
fieldset, required completeness, reset and string state restoration use
ElementInternals. React uses Zag's real native form control and supports `form`.
Passive `checkValidity()` does not move focus. When browser submission validation
focuses React's form control, focus is forwarded to its visible code cells.
Reset cancellation is respected; a controlled value remains consumer-owned.
Helper/error references also reach each focusable cell, not only the group.

## Compose

```kotlin
val code = rememberTextFieldState()
LabPinInput(code, "Код подтверждения", count = 6, otp = true)
// Reset and programmatic changes keep the native selection/IME state contract.
code.setTextAndPlaceCursorAtEnd("")
```

One native state-based editor supplies selection, keyboard navigation, IME, paste
and accessibility; the cells are decoration. `mask` selects `BasicSecureTextField`
with permanent obscuring, password semantics and no copy action. `otp` supplies
`ContentType.SmsOtpCode`. A tap positions the native caret in the corresponding cell.
Collapsed selection has a stationary caret and focus ring; a selected range fills
the affected cells with `LocalTextSelectionColors.backgroundColor`. The caret uses
the same shared selection colors. Forward and reversed ranges retain native
replacement behavior, including when masked.

User and IME edits apply the length limit synchronously through `InputTransformation`.
After a successful composition, programmatic overlong values are trimmed to the
visible prefix, including initial values, resets, replacement `TextFieldState` instances and count
changes. Trimming clamps both selection endpoints without reversing the range;
valid text and its active IME composition are left intact. External changes are
normalized when the mounted field applies their next composition, using that
composition's count. The field cannot intercept an external `state.edit` synchronously.

Each cell owns its hover feedback; reduced motion follows the public LabMotion
preference. There is no idle animation or polling. Platform-specific submission and
form validation belong to the surrounding screen, as with `LabInput`.

Sources: [Lab UI](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[Zag Pin Input](https://zagjs.com/components/pin-input),
[Compose state-based fields](https://developer.android.com/develop/ui/compose/text/user-input).
See [source and installed-consumer evidence](../evidence/pin-input-20261119/README.md).
