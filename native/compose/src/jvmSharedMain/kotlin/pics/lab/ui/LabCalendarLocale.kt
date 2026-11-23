package pics.lab.ui

import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.text.NumberFormat
import java.time.format.DateTimeFormatter
import java.time.format.DecimalStyle
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

internal actual fun calendarLocale(localeTag: String): CalendarLocale = object : CalendarLocale {
    private val locale = Locale.forLanguageTag(localeTag)
    private val fullDate = DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(locale).withDecimalStyle(DecimalStyle.of(locale))
    private val monthFormat = DateTimeFormatter.ofPattern("LLLL y", locale).withDecimalStyle(DecimalStyle.of(locale))
    private val number = NumberFormat.getIntegerInstance(locale).apply { isGroupingUsed = false }
    override val firstDay: DayOfWeek = DayOfWeek.entries[WeekFields.of(locale).firstDayOfWeek.value - 1]
    override fun month(date: LocalDate): String = monthFormat.format(date.toJavaLocalDate())
    override fun weekday(day: DayOfWeek, full: Boolean, narrow: Boolean): String = java.time.DayOfWeek.of(day.ordinal + 1)
        .getDisplayName(if (full) TextStyle.FULL else if (narrow) TextStyle.NARROW else TextStyle.SHORT, locale)
    override fun date(date: LocalDate): String = fullDate.format(date.toJavaLocalDate())
    override fun day(date: LocalDate): String = number.format(date.day)
}
