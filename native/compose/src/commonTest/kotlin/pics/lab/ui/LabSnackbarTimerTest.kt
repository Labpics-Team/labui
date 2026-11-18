package pics.lab.ui

import kotlin.test.Test
import kotlin.test.assertEquals

class LabSnackbarTimerTest {
    @Test fun pausesKeepRemainingTimeAndResumeOneDeadline() {
        var now = 0L
        val timer = LabSnackbarTimer(5000) { now }
        timer.running(true)
        now = 1250
        timer.running(false)
        assertEquals(3750, timer.remaining())
        now = 9000
        timer.running(false)
        assertEquals(3750, timer.remaining())
        timer.running(true)
        now = 10_000
        assertEquals(2750, timer.remaining())
        assertEquals(750, timer.nextChange())
        now = 12_750
        assertEquals(0, timer.remaining())
    }

    @Test fun customDurationsWakeOnlyOnPoseOrSecondBoundaries() {
        var now = 0L
        val timer = LabSnackbarTimer(7500) { now }
        timer.running(true)
        assertEquals(500, timer.nextChange())
        now = 500
        assertEquals(1000, timer.nextChange())
        now = 1500
        assertEquals(1000, timer.nextChange())
        now = 7500
        assertEquals(0, timer.nextChange())
    }
}
