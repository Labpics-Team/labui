package pics.lab.ui.sample

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
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

@OptIn(androidx.compose.ui.InternalComposeUiApi::class)
class AlertConsumerTest {
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
        error("Installed Alert consumer did not settle")
    }
    @Test fun installedQueueRetainsEveryMessageAndClosesExactlyTheRequestedOne() {
        val output = File("build/alert-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val scene = ImageComposeScene(430, 700, Density(1f, scale)) { AlertQueueExample(theme) }
            try {
                for ((index, message) in listOf("Изменения сохранены", "Экспорт подготовлен", "Доступ обновлён").withIndex()) {
                    val png = settle(scene)
                    assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == message } == true })
                    assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Осталось сообщений: ${3 - index}" } == true })
                    if (index == 0) File(output, "consumer-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(png)
                    val buttons = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Закрыть уведомление") == true }
                    assertEquals(1, buttons.size)
                    buttons.single().config[SemanticsActions.RequestFocus].action!!.invoke()
                    settle(scene)
                    scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyDown))
                    scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyUp))
                }
                settle(scene)
                assertTrue(nodes(scene).none { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Закрыть уведомление") == true })
                assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Осталось сообщений: 0" } == true })
                assertTrue(nodes(scene).any { node -> node.config.getOrNull(SemanticsProperties.Focused) == true && node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Показать сообщения" } == true })
            } finally { scene.close() }
        }
    }
}
