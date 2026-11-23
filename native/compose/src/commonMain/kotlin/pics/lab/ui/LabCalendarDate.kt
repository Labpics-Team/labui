package pics.lab.ui

import kotlinx.datetime.*
import kotlin.time.Clock

public enum class LabCalendarSelection { Single, Range }
public enum class LabCalendarSize { Small, Medium }

/** The label describes all events, even when the visual indicator is capped at five. */
public data class LabCalendarEvents(public val count: Int, public val label: String) {
    init {
        require(count >= 0) { "Event count must not be negative" }
        require(count == 0 || label.isNotBlank()) { "Events require an accessible description" }
    }
}

public data class LabCalendarStrings(
    public val label: String = "Calendar",
    public val previousMonth: String = "Previous month",
    public val nextMonth: String = "Next month",
    public val today: String = "Today",
    public val unavailable: String = "Unavailable",
    public val marked: String = "Marked",
    public val rangeStart: String = "Range start",
    public val rangeEnd: String = "Range end",
)

internal val calendarFirst = LocalDate(1, 1, 1)
internal val calendarLast = LocalDate(9999, 12, 31)
internal fun LocalDate.calendarMonth() = LocalDate(year, month, 1)
internal fun calendarToday(): LocalDate = Clock.System.now().toLocalDateTime(TimeZone.UTC).date
internal fun LocalDate.calendarShiftDays(days: Int): LocalDate =
    LocalDate.fromEpochDays((toEpochDays() + days).coerceIn(calendarFirst.toEpochDays(), calendarLast.toEpochDays()))

internal fun LocalDate.calendarShiftMonths(months: Int): LocalDate =
    plus(months, DateTimeUnit.MONTH).coerceIn(calendarFirst, calendarLast)

/** Null cells are the unrepresentable neighbours outside the shared ISO year contract. */
internal fun calendarDays(month: LocalDate, firstDay: DayOfWeek): List<LocalDate?> {
    val first = month.calendarMonth()
    val start = first.toEpochDays() - (first.dayOfWeek.isoDayNumber - firstDay.isoDayNumber + 7) % 7
    return List(42) { index -> (start + index).takeIf { it in calendarFirst.toEpochDays()..calendarLast.toEpochDays() }?.let(LocalDate::fromEpochDays) }
}

internal fun calendarAvailable(date: LocalDate, min: LocalDate?, max: LocalDate?, unavailable: ((LocalDate) -> Boolean)?): Boolean =
    (min == null || date >= min) && (max == null || date <= max) && unavailable?.invoke(date) != true

/** Null means the request is rejected; the controlled value is never repaired behind its caller. */
internal fun calendarSelect(value: List<LocalDate>, date: LocalDate, selection: LabCalendarSelection,
    min: LocalDate?, max: LocalDate?, unavailable: ((LocalDate) -> Boolean)?): List<LocalDate>? {
    if (!calendarAvailable(date, min, max, unavailable)) return null
    if (selection == LabCalendarSelection.Single || value.size != 1) return listOf(date)
    val start = minOf(value[0], date)
    val end = maxOf(value[0], date)
    if (!calendarAvailable(start, min, max, unavailable) || !calendarAvailable(end, min, max, unavailable)) return null
    if (unavailable != null) {
        var day = start
        while (day < end) {
            day = day.plus(1, DateTimeUnit.DAY)
            if (unavailable(day)) return null
        }
    }
    return listOf(start, end)
}

internal interface CalendarLocale {
    val firstDay: DayOfWeek
    fun month(date: LocalDate): String
    fun weekday(day: DayOfWeek, full: Boolean, narrow: Boolean = false): String
    fun date(date: LocalDate): String
    fun day(date: LocalDate): String
}
internal expect fun calendarLocale(localeTag: String): CalendarLocale
