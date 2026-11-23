# Calendar — native software evidence, 2026-11-23

14 targeted tests passed, with zero failures or errors; test bodies took
17.181 seconds on Windows. [results.json](results.json) records the executed
scenarios and 26 PNGs. These are real `ImageComposeScene` renders with pointer
and key input, Skiko SOFTWARE and Java headless mode. No window, audio or screen
reader was used.

```powershell
$env:JAVA_HOME = 'C:/Program Files/Zulu/zulu-21'
$env:SKIKO_RENDER_API = 'SOFTWARE'
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
./gradlew.bat :desktopTest --tests 'pics.lab.ui.Calendar*' --console=plain
./gradlew.bat :compileIosMainKotlinMetadata --console=plain
```

Run from `native/compose`. The leading colon limits the test task to this
module; an unqualified `desktopTest` also applies the Calendar filter to
`ui-colors`, which has no such tests. New captures are written to
`build/calendar-evidence`.

## What was checked

The common tests cover the real May 2025 grid, six-week allocation, leap days,
end-of-month clamping, year transitions, min/max inclusion, reverse and
single-day ranges, rejected unavailable interior dates and changed anchors,
supported years 1–9999, the proleptic Gregorian date 1582-10-10, and localized
numerals. JVM timezone changes around DST leave formatted date-only values
unchanged.

The rendering tests exercise controlled selection and month rejection through
real clicks, accepted updates, RTL direction, PageUp/PageDown and year jumps,
Enter/Space, a single date in the Tab sequence, disabled dates, readonly
navigation, range selection and complete event descriptions beyond five dots.
Adjacent-month cells are disabled references with quaternary ink. A dedicated
check verifies that pointer and semantic clicks cannot change value or month;
keyboard navigation moves into the next month and Enter then selects its date.
The screenshot matrix covers S/M, light/dark, the three materials, Arabic RTL,
single/range, hover, focus, disabled, markers, dots and Russian narrow 200% text.

At 200%, the grid uses horizontal scrolling while the header stays inside the
surface. [Before navigation](medium-narrow-dark-200.png) and
[after focus moved to Sunday](medium-narrow-dark-200-focus-scroll.png) show
the same surface; the focused date becomes fully visible. The test asserts
the real scroll range, focused semantics and full date-cell width. It does not
mistake cells clipped by the viewport for missing dates.

The Figma source's authored geometry and shared profile are used directly.
The original sample's date labels do not define actual weekdays: May 1, 2025
is Thursday. Source anchors:
[Calendar/Mini](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6094-1293),
[Gridcell](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6091-5575),
[Status Dots](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6091-5057).

## Fixes found by the real checks

Requesting focus before the replacement month's layout returned `true` but
left no focused date after layout. The component now resolves the destination
before composition, attaches a requester to each date, and requests focus on
the next frame. A keyboard test reaches February 29 from January 31, then
March 1, and a prior year before tabbing outside the calendar.

Large text initially made adjacent numbers touch. The grid now retains two em
per date and uses standard scrolling. Arabic system SHORT weekday names were
full words; when those labels do not fit, all weekdays switch to the system's
NARROW names, retaining complete semantic labels. JVM formatters also use the
locale's decimal style for the heading and spoken date, matching day numerals.

Range focus was corrected after independent review of the authored Gridcell
focus overlays. Center cells now paint only top/bottom strokes; start/end cells
also close their external rounded edge, with no internal vertical border.
The cached outline follows RTL direction. The `rangeFocus` test compares real
before/after pixels at the straight and rounded corners for S/M and LTR/RTL,
and saves twelve focused detail PNGs named `range-focus-*`. The former complete
rounded rectangle misses ink at the open interior corners and is rejected by
this check.

## Limits

iOS metadata compilation passed, including the Foundation locale adapter and
its proleptic Gregorian formatter. Existing unrelated dependency metadata and
`AvatarText.kt` warnings remain. This is a source/type check, not execution of
the Apple formatter or device rendering. The desktop run does not claim iOS,
Android, VoiceOver or TalkBack qualification. No Android SDK was found in this
workspace's configured native projects or standard installed SDK locations.

The authoritative public contract is [docs/calendar.md](../../docs/calendar.md).
