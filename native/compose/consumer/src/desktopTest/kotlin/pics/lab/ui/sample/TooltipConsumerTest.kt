package pics.lab.ui.sample

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
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

class TooltipConsumerTest {
    private fun walk(n: SemanticsNode): List<SemanticsNode> = listOf(n) + n.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png; Thread.sleep(10)
        }
        error("Installed Tooltip did not settle")
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun installedTooltipDescribesWithoutTakingFocus() {
        val output = File("build/tooltip-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val scene = ImageComposeScene(600, 430, Density(1f, scale)) { TooltipExample(LabThemeState(initialLabColors(preferences), preferences)) }
            try {
                settle(scene)
                fun button() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }
                button().config[SemanticsActions.RequestFocus].action!!.invoke()
                output.resolve("${appearance.name}-${scale}.png").writeBytes(settle(scene))
                assertTrue(button().config[SemanticsProperties.Focused])
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Сохранено в вашей библиотеке" } == true })
                scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyDown)); settle(scene)
                assertEquals(1, nodes(scene).count { it.config.getOrNull(SemanticsProperties.Role) == Role.Button })
                assertTrue(button().config[SemanticsProperties.Focused])
            } finally { scene.close() }
        }
    }
}
