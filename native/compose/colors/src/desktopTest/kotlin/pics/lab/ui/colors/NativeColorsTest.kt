package pics.lab.ui.colors

import kotlinx.coroutines.runBlocking
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabColorContext
import pics.lab.ui.LabSrgb8
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors
import pics.lab.ui.loadLabColorProgram
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame
import kotlin.test.assertNotEquals

class NativeColorsTest {
    @Test fun actualSurfaceUpdatesOneNativeSessionAndRejectedContextCanRecover() = runBlocking {
        val white = LabColorContext(listOf(LabSrgb8(255, 255, 255)))
        val black = LabColorContext(listOf(LabSrgb8(0, 0, 0)))
        val incompatible = LabColorContext(white.backgrounds + black.backgrounds)
        val preferences = LabPreferences(increasedContrast = true)
        val state = LabThemeState(initialLabColors(preferences), preferences)
        LabColorsProgramHost().use { host ->
            state.update(host, preferences, white)
            val onWhite = state.colors
            assertSame(onWhite, host.resolve(preferences, LabColorContext(white.backgrounds)))
            state.update(host, preferences, black)
            val onBlack = state.colors
            assertNotEquals(onWhite["label-primary"], onBlack["label-primary"])
            assertFailsWith<IllegalStateException> { state.update(host, preferences, incompatible) }
            assertSame(onBlack, state.colors)
            assertEquals(black, state.context)
            state.update(host, preferences, white)
            assertEquals(onWhite["label-primary"], state.colors["label-primary"])
            assertEquals(white, state.context)
        }
    }

    @Test fun installedNativeSolverMatchesSharedFirstFrameForAllThemes() = runBlocking {
        LabColorsProgramHost().use { host ->
            for (appearance in LabAppearance.entries) for (contrast in listOf(false, true)) {
                val preferences = LabPreferences(appearance = appearance, increasedContrast = contrast)
                val resolved = host.resolve(preferences)
                val initial = initialLabColors(preferences)
                for (role in loadLabColorProgram(preferences).roles) {
                    assertEquals(initial[role.name], resolved[role.name], "${appearance}/${contrast}/${role.name}")
                }
                assertSame(resolved, host.resolve(preferences.copy(reducedMotion = true)))
            }
        }
    }

    @Test fun closedHostRejectsNewWorkAndCloseIsIdempotent(): Unit = runBlocking {
        val host = LabColorsProgramHost()
        host.resolve(LabPreferences())
        host.close()
        host.close()
        assertFailsWith<IllegalStateException> { host.resolve(LabPreferences()) }
    }
}
