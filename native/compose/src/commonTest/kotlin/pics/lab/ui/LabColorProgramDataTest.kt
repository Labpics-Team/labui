package pics.lab.ui

import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LabColorProgramDataTest {
    @Test fun everyAppearanceLoadsItsPackagedProgram() = runTest {
        val programs = LabAppearance.entries.flatMap { appearance ->
            listOf(false, true).map { increased ->
                loadLabColorProgram(LabPreferences(appearance, increased))
            }
        }
        for (program in programs) {
            assertContentEquals(byteArrayOf(76, 67, 80, 87), program.bytes.copyOfRange(0, 4))
            assertEquals(3, program.background.size)
            assertTrue(program.roles.any { it.name == "label-primary" })
            assertEquals(program.roles.size, program.roles.map { it.name }.distinct().size)
        }
        assertFalse(programs[0].bytes.contentEquals(programs[1].bytes))
        assertFalse(programs[0].bytes.contentEquals(programs[2].bytes))
    }

    @Test fun outputSlotsAndAliasesDetermineColorsIndependentlyOfArrayOrder() {
        val source = LabPreparedColorProgram(byteArrayOf(), byteArrayOf(), listOf(
            LabColorRole("label-primary", 91), LabColorRole("label-alias", 91), LabColorRole("fill", 12),
        ))
        val output = source.output(intArrayOf(12, 91), byteArrayOf(0, 0, -1, -1, 0, 0), doubleArrayOf(1.0, 0.5))
        assertEquals(Color.Blue, output["fill"])
        assertEquals(Color(1f, 0f, 0f, .5f), output["label-primary"])
        assertEquals(output["label-primary"], output["label-alias"])
    }
}
