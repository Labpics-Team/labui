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
import kotlin.test.assertTrue
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabMenuItem
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors

class MenuConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun named(scene: ImageComposeScene, text: String) = nodes(scene).first {
        it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == text } == true }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png; Thread.sleep(10)
        }
        error("Installed menu did not settle")
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun installedMenusShareAcceptedStateAndInvokeNestedActions() {
        val location = LabMenuItem::class.java.protectionDomain.codeSource.location.toString()
        assertTrue(location.endsWith(".jar"), "Consumer must load published bytecode: $location")
        val output = File("build/menu-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val scene = ImageComposeScene(900, 900, Density(1f, scale)) { MenuExample(LabThemeState(initialLabColors(preferences), preferences)) }
            fun click(text: String) { named(scene, text).config[SemanticsActions.OnClick].action!!.invoke(); settle(scene) }
            fun escape() { scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyDown)); settle(scene) }
            try {
                settle(scene)
                click("Действия"); click("Показывать сетку")
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Выбор: " } == true })
                escape()
                named(scene, "Объект на холсте").config[SemanticsActions.OnLongClick].action!!.invoke(); settle(scene)
                click("Экспорт"); click("Изображение PNG")
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Действие: png" } == true })
                click("Проект"); click("Показывать сетку")
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Выбор: grid" } == true })
                output.resolve("${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(settle(scene))
                escape()
            } finally { scene.close() }
        }
    }
}
