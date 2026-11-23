package pics.lab.ui

import kotlinx.datetime.*
import kotlin.test.*

class CalendarDateTest {
    @Test fun gridUsesRealGregorianDaysAndAlwaysHasSixWeeks() {
        val may = calendarDays(LocalDate(2025, 5, 17), DayOfWeek.MONDAY)
        assertEquals(42, may.size)
        assertEquals(LocalDate(2025, 4, 28), may.first())
        assertEquals(LocalDate(2025, 5, 1), may[3])
        assertEquals(LocalDate(2025, 6, 8), may.last())
        assertEquals(LocalDate(2025, 4, 27), calendarDays(LocalDate(2025, 5, 1), DayOfWeek.SUNDAY).first())
    }
    @Test fun monthAndYearMovementClampsLeapDaysWithoutTimezoneArithmetic() {
        assertEquals(LocalDate(2024, 2, 29), LocalDate(2024, 1, 31).calendarShiftMonths(1))
        assertEquals(LocalDate(2025, 2, 28), LocalDate(2024, 2, 29).calendarShiftMonths(12))
        assertEquals(LocalDate(2024, 12, 31), LocalDate(2025, 1, 31).calendarShiftMonths(-1))
        assertEquals(LocalDate(2025, 3, 10), LocalDate(2025, 3, 9).calendarShiftDays(1))
        assertEquals(LocalDate(2025, 11, 3), LocalDate(2025, 11, 2).calendarShiftDays(1))
    }
    @Test fun reversedRangeIsInclusiveAndUnavailableInteriorRejectsWholeRequest() {
        val start = LocalDate(2025, 5, 3)
        val end = LocalDate(2025, 5, 9)
        assertEquals(listOf(start, end), calendarSelect(listOf(end), start, LabCalendarSelection.Range, null, null, null))
        assertEquals(listOf(start, start), calendarSelect(listOf(start), start, LabCalendarSelection.Range, null, null, null))
        assertNull(calendarSelect(listOf(start), end, LabCalendarSelection.Range, null, null) { it == LocalDate(2025, 5, 6) })
        assertEquals(listOf(start), calendarSelect(listOf(start, end), start, LabCalendarSelection.Range, null, null, null))
        assertEquals(listOf(start), calendarSelect(listOf(end), start, LabCalendarSelection.Single, null, null, null))
    }
    @Test fun boundsAreInclusiveAndInvalidOldAnchorsCannotBypassNewLimits() {
        val min = LocalDate(2025, 5, 3)
        val max = LocalDate(2025, 5, 9)
        assertTrue(calendarAvailable(min, min, max, null))
        assertTrue(calendarAvailable(max, min, max, null))
        assertFalse(calendarAvailable(min.calendarShiftDays(-1), min, max, null))
        assertFalse(calendarAvailable(max.calendarShiftDays(1), min, max, null))
        assertNull(calendarSelect(listOf(min.calendarShiftDays(-1)), max, LabCalendarSelection.Range, min, max, null))
    }
    @Test fun supportedYearEdgesStayRepresentableAndNeverWrap() {
        assertEquals(calendarFirst, calendarFirst.calendarShiftDays(-1))
        assertEquals(calendarLast, calendarLast.calendarShiftDays(1))
        assertEquals(calendarFirst, calendarFirst.calendarShiftMonths(-1))
        assertEquals(calendarLast, calendarLast.calendarShiftMonths(1))
        assertNull(calendarDays(calendarFirst, DayOfWeek.SUNDAY).first())
        assertTrue(calendarDays(calendarLast, DayOfWeek.MONDAY).any { it == null })
    }
    @Test fun localeFormattingKeepsProlepticGregorianDatesAndLocalizedNumerals() {
        val historical = calendarLocale("en-US").date(LocalDate(1582, 10, 10))
        assertTrue(historical.contains("Sunday"), historical)
        assertTrue(historical.contains("October") && historical.contains("10") && historical.contains("1582"), historical)
        assertEquals("١٢", calendarLocale("ar-EG").day(LocalDate(2025, 5, 12)))
        assertEquals(DayOfWeek.MONDAY, calendarLocale("ru-RU").firstDay)
    }
}
