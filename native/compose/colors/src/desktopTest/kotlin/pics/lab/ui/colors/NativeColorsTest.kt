package pics.lab.ui.colors

import kotlinx.coroutines.runBlocking
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabPreferences
import pics.lab.ui.initialLabColors
import pics.lab.ui.loadLabColorProgram
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class NativeColorsTest {
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
