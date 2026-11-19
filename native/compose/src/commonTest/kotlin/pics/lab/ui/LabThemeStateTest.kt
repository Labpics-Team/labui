package pics.lab.ui

import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class LabThemeStateTest {
    @Test fun failedUpdateKeepsBothPaletteAndPreferences() = runTest {
        val state = LabThemeState(LabColorOutput(mapOf("label-primary" to Color.Black)))
        val host = object : ColorProgramHost {
            override suspend fun resolve(preferences: LabPreferences): LabColorOutput = error("Rejected input")
            override fun close() {}
        }
        assertFailsWith<IllegalStateException> { state.update(host, LabPreferences(LabAppearance.Dark)) }
        assertEquals(Color.Black, state.colors["label-primary"])
        assertEquals(LabAppearance.Light, state.preferences.appearance)
    }

    @Test fun laterAcceptedUpdateCannotBeOverwrittenBySlowPreviousOne() = runTest {
        val first = CompletableDeferred<LabColorOutput>()
        val entered = CompletableDeferred<Unit>()
        val state = LabThemeState(LabColorOutput(mapOf("label-primary" to Color.Black)))
        val host = object : ColorProgramHost {
            override suspend fun resolve(preferences: LabPreferences): LabColorOutput {
                if (preferences.appearance == LabAppearance.Dark) { entered.complete(Unit); return first.await() }
                return LabColorOutput(mapOf("label-primary" to Color.Blue))
            }
            override fun close() {}
        }
        val slow = async { state.update(host, LabPreferences(LabAppearance.Dark)) }
        entered.await()
        state.update(host, LabPreferences())
        first.complete(LabColorOutput(mapOf("label-primary" to Color.White)))
        slow.await()
        assertEquals(Color.Blue, state.colors["label-primary"])
        assertEquals(LabAppearance.Light, state.preferences.appearance)
    }

    @Test fun authoredBlurSigmaSurvivesDensityConversion() {
        for (density in listOf(1f, 1.25f, 2f, 3f)) {
            for (radius in listOf(12f, 20f, 25f, 128f)) {
                val physicalRadius = hazeRadius(radius, density) * density
                val actualSigma = physicalRadius * .57735f + .5f
                assertEquals(radius * .5f * density, actualSigma, .0001f)
            }
        }
    }
}
