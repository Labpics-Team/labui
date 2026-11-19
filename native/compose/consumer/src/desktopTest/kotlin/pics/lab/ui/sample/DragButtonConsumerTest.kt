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

class DragButtonConsumerTest {
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
        error("Drag Button consumer did not settle")
    }
    @Test fun installedActionKeepsOneResultUntilExplicitReset() {
        val output = File("build/drag-button-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val scene = ImageComposeScene(400, 430, Density(1f, scale)) { DragTransferExample(theme) }
            fun action() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.singleOrNull() == "Подтвердить перевод" }
            fun activate() { action().config[SemanticsActions.OnClick].action!!.invoke(); settle(scene) }
            try {
                settle(scene); activate(); activate()
                assertEquals("Отправлено", action().config[SemanticsProperties.StateDescription])
                assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Отправлено переводов: 1" } == true })
                val reset = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Role) == Role.Button && it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Новый перевод" } == true }
                reset.config[SemanticsActions.OnClick].action!!.invoke(); settle(scene); activate()
                assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Отправлено переводов: 2" } == true })
                File(output, "consumer-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(settle(scene))
            } finally { scene.close() }
        }
    }
}
