package pics.lab.ui.sample

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors

class SegmentedConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png; Thread.sleep(10)
        }
        error("Segmented consumer did not settle")
    }
    @Test fun installedMavenChoiceUpdatesItsRealResultInBothThemesAndTextScales() {
        val output = File("build/segmented-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val scene = ImageComposeScene(450, 220, Density(1f, scale)) { SegmentedPeriodExample(theme) }
            fun radios() = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.RadioButton }
            fun selected() = radios().single { it.config.getOrNull(SemanticsProperties.Selected) == true }.config[SemanticsProperties.Text].single().text
            try {
                settle(scene); assertEquals("Неделя", selected())
                radios()[2].config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
                assertEquals("Месяц", selected())
                assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Показан период: Месяц" } == true })
                radios()[0].config[SemanticsActions.OnClick].action!!.invoke()
                val png = settle(scene); assertEquals("День", selected())
                File(output, "consumer-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(png)
            } finally { scene.close() }
        }
    }
}
