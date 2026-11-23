@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package pics.lab.ui

import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import platform.Foundation.*

internal actual fun calendarLocale(localeTag: String): CalendarLocale = AppleCalendarLocale(localeTag)
private class AppleCalendarLocale(localeTag: String) : CalendarLocale {
    private val locale = NSLocale(localeIdentifier = localeTag)
    private val zone = NSTimeZone.timeZoneForSecondsFromGMT(0)
    private val calendar = NSCalendar(NSCalendarIdentifierGregorian).apply { this.locale = this@AppleCalendarLocale.locale; timeZone = zone }
    private fun formatter(template: String) = NSDateFormatter().apply {
        this.locale = this@AppleCalendarLocale.locale
        this.calendar = this@AppleCalendarLocale.calendar
        timeZone = zone
        gregorianStartDate = NSDate.distantPast
        setLocalizedDateFormatFromTemplate(template)
    }
    private val monthFormat = formatter("yMMMM")
    private val fullDate = formatter("yMMMMEEEEd")
    private val names = formatter("EEEE")
    private val number = NSNumberFormatter().apply { this.locale = this@AppleCalendarLocale.locale; numberStyle = NSNumberFormatterDecimalStyle; usesGroupingSeparator = false }
    override val firstDay: DayOfWeek = DayOfWeek.entries[((calendar.firstWeekday.toInt() + 5) % 7)]
    // Foundation requires NSDate for formatting. This UTC-noon bridge is presentation only;
    // arithmetic, selection and storage remain proleptic Gregorian LocalDate values.
    private fun nativeDate(date: LocalDate): NSDate = NSDate.dateWithTimeIntervalSince1970(date.toEpochDays() * 86_400.0 + 43_200.0)
    override fun month(date: LocalDate): String = monthFormat.stringFromDate(nativeDate(date))
    override fun weekday(day: DayOfWeek, full: Boolean, narrow: Boolean): String =
        (if (full) names.weekdaySymbols else if (narrow) names.veryShortWeekdaySymbols else names.shortWeekdaySymbols)[(day.ordinal + 1) % 7] as String
    override fun date(date: LocalDate): String = fullDate.stringFromDate(nativeDate(date))
    override fun day(date: LocalDate): String = number.stringFromNumber(NSNumber(int = date.day)) ?: date.day.toString()
}
