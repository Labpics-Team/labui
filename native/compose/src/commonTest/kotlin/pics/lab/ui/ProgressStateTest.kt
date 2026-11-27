package pics.lab.ui

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import kotlin.test.Test
import kotlin.test.assertEquals

class ProgressStateTest {
    @Test fun finiteValuesClampAndCustomRangesRetainTheirMeaning() {
        for ((input, value, fraction) in listOf(Triple(-30f, 20f, 0f), Triple(40f, 40f, .25f), Triple(200f, 100f, 1f))) {
            val state = labProgressState(input, 20f, 100f)
            assertEquals(value, state.value)
            assertEquals(fraction, state.fraction)
            assertEquals(ProgressBarRangeInfo(value, 20f..100f), state.rangeInfo)
        }
        assertEquals("25%", labProgressState(40f, 20f, 100f).text)
        assertEquals(.5f, labProgressState(0f, -Float.MAX_VALUE, Float.MAX_VALUE).fraction)
    }

    @Test fun unknownNeverInventsANumberOrPercentage() {
        for (value in listOf(null, Float.NaN, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY)) {
            val state = labProgressState(value, 0f, 100f)
            assertEquals(null, state.value)
            assertEquals("", state.text)
            assertEquals(ProgressBarRangeInfo.Indeterminate, state.rangeInfo)
        }
        for ((min, max) in listOf(10f to 10f, 20f to 10f, Float.NaN to 100f, 0f to Float.POSITIVE_INFINITY)) {
            val state = labProgressState(20f, min, max)
            assertEquals(null, state.value)
            assertEquals(ProgressBarRangeInfo.Indeterminate, state.rangeInfo)
        }
    }
}
