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
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors

class ChipConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun label(node: SemanticsNode) = node.config.getOrNull(SemanticsProperties.Text)?.joinToString { it.text }.orEmpty()
    private fun settle(scene: ImageComposeScene) {
        var last: ByteArray? = null
        var equal = 0
        repeat(80) {
            val png = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equal = if (last?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return
            last = png
            Thread.sleep(10)
        }
        error("Consumer did not settle")
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun consumerFilterChangesRowsAndResetRestoresThemAt200Percent() {
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val scene = ImageComposeScene(320, 540, Density(1f, 2f)) { ChipFilterExample(theme) }
        try {
            settle(scene)
            fun chip(text: String) = nodes(scene).single { label(it) == text && it.config.getOrNull(SemanticsProperties.Role) == Role.Button }
            assertEquals(3, nodes(scene).count { it.config.getOrNull(SemanticsProperties.Role) == Role.Button })
            chip("Дизайн").config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyUp))
            settle(scene)
            assertTrue(nodes(scene).any { label(it) == "Макеты продукта" })
            assertTrue(nodes(scene).none { label(it) == "Описание API" })
            chip("Сбросить").config[SemanticsActions.OnClick].action!!.invoke()
            settle(scene)
            assertTrue(nodes(scene).any { label(it) == "Описание API" })
            for (node in nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }) {
                assertTrue(node.positionInRoot.x >= 0)
                assertTrue(node.positionInRoot.x + node.size.width <= 320)
            }
            val output = File("build/chip-consumer").apply { mkdirs() }
            scene.render().use { image -> image.encodeToData()!!.use { File(output, "chip-consumer-320-200.png").writeBytes(it.bytes) } }
        } finally { scene.close() }
    }
}
