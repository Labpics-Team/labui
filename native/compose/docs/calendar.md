# Calendar

`LabCalendar` renders the authored Calendar/Mini in small and medium sizes, with
single-date or inclusive range selection. It belongs inside `LabTheme` and
`LabScene`, like the other material surfaces. `LabCalendarStatusDots` is available
separately; the calendar's cells remain an implementation detail.

```kotlin
import androidx.compose.runtime.*
import kotlinx.datetime.LocalDate
import pics.lab.ui.*

@Composable
fun Dates() {
    var value by remember { mutableStateOf(emptyList<LocalDate>()) }
    var month by remember { mutableStateOf(LocalDate(2025, 5, 1)) }
    LabCalendar(
        value = value,
        onValueChange = { value = it },
        month = month,
        onMonthChange = { month = it },
        selection = LabCalendarSelection.Range,
        size = LabCalendarSize.Medium,
        localeTag = "en-GB",
        min = LocalDate(2025, 5, 1),
        events = mapOf(LocalDate(2025, 5, 12) to LabCalendarEvents(8, "8 appointments")),
    )
}
```

## Dates and controlled state

Dates use `kotlinx.datetime.LocalDate` and the proleptic Gregorian calendar, with
ISO years 1–9999. Serialize them as ISO date-only strings; changing locale or
time zone never changes a selected day. `kotlinx-datetime:0.7.1` is an API
dependency, so consumers receive its public types transitively.

`month` may contain any day; the component renders that month and requests its
first day through `onMonthChange`. Value and month change only when the
application accepts the corresponding callback. Adjacent-month dates are
disabled reference cells, with the authored quaternary label. Use the month
buttons or keyboard navigation to reach those dates in their own month; they
then become selectable if the other constraints allow it. A value or range
that extends into another month is retained unchanged.

Single values contain zero or one date. A range contains zero dates, one anchor,
or two ascending endpoints, both inclusive. Selecting a second date before the
anchor orders the endpoints. Selecting a date after a completed range starts
a new anchor; selecting the anchor again completes a one-day range. Invalid
list shapes or reversed controlled endpoints fail at the public boundary.

`min` and `max` are inclusive. `isDateUnavailable` rejects individual dates and
any completed range containing an unavailable day, including an anchor that
became unavailable after its selection. It should be a fast, pure predicate.
With no predicate, range validation uses only endpoint comparisons; a predicate
requires checking the requested span. Invalid requests preserve the value.

`enabled = false` disables selection and navigation. `readOnly = true` preserves
navigation and keyboard exploration while preventing value changes. Neither
mode silently repairs an existing value that a later constraint disallows.

`today` is only an annotation. Its default is the current UTC date, evaluated
during composition. Supply an application's chosen local date for another time
zone, or `null` to omit the annotation. Calendar does not run a midnight timer.

## Locale, input and accessibility

`localeTag` is a BCP 47 locale tag. System formatters supply month names, full
spoken dates, weekday names, numerals and the default first weekday; pass
`firstDayOfWeek` to override the week start. Date arithmetic remains Gregorian.
If short weekday names do not fit, the complete row uses the system's narrow
names and retains full semantic labels.
Translate action and annotation text with `LabCalendarStrings`, and supply
localized `LabCalendarEvents.label` descriptions. Event counts cannot be
negative, and positive counts require a nonblank description. The indicator
shows at most five dots; the complete description remains on the date.

The grid has one date in the Tab sequence. Arrow keys move one day or week;
horizontal arrows respect layout direction. Home/End move to the week's edges.
PageUp/PageDown move one month and Shift+PageUp/PageDown one year, clamping a
missing day to the destination month's end. Enter/Space request selection.
Month changes retain the requested date's keyboard focus after layout. Dates
at the supported year boundaries cannot wrap around. Keyboard movement respects
`min` and `max`. Dates rejected by `isDateUnavailable` remain keyboard-explorable
and announce that they cannot be selected.

Semantics expose a named traversal group, month heading and polite month
announcement, 7-column collection positions, full date descriptions, selection,
disabled state, range endpoints, today, markers and event descriptions. Decorative
digits, dots and icons are not announced twice. `markers` adds the authored
checkmark decoration and an accessible annotation; it does not select a date.

## Geometry and materials

The shared `packages/tokens/src/components.json` profile defines both native and
web geometry, typography, roles and the authored dot contour. Default sizes are
320 and 400 dp, maximum widths 380 and 560 dp. The normal grid is square, with a
weekday row and six date rows; the month header follows the authored S/M layout.
All range cells use the inverted surface, with only the external endpoint
corners rounded. Event dots use the original first circle and subsequent
subtracted-circle shapes.

At narrow widths or enlarged text, each date retains at least two em of width.
Only the two-dimensional grid scrolls horizontally; the header remains inside
the surface. Keyboard focus scrolls the requested date fully into view. Text
is not reduced to fit. Row and cell dimensions grow together. The default is
`LabMaterial.Acrylic`; Solid and Glass use the same `LabSurface` contract.

## Verification and platform boundary

`CalendarDateTest` tests the date contract. `CalendarRenderTest` uses real
`ImageComposeScene` rendering, pointer/key input and semantics on desktop, with
Skiko SOFTWARE and Java headless mode. Evidence and exact commands are in
[`../evidence/calendar-20261123/README.md`](../evidence/calendar-20261123/README.md).
These results qualify the shared Compose implementation on desktop. iOS
metadata compilation checks the Foundation adapter's types; it is not iOS or
Android device, VoiceOver or TalkBack evidence. No native window or screen
reader is opened by these checks.

Sources: [Calendar/Mini in Figma](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6094-1293),
[`kotlinx-datetime`](https://github.com/Kotlin/kotlinx-datetime),
[LocalDate](https://kotlinlang.org/api/kotlinx-datetime/kotlinx-datetime/kotlinx.datetime/-local-date/),
[Java WeekFields](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/temporal/WeekFields.html),
[Apple DateFormatter](https://developer.apple.com/documentation/foundation/dateformatter).
