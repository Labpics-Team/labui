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

class SelectConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 4) return png
            previous = png; Thread.sleep(10)
        }
        error("Select consumer did not settle")
    }
    @Test fun installedMavenSelectRefusesThenAcceptsRemovalResetsAndSavesAcceptedState() {
        val output = File("build/select-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val scene = ImageComposeScene(440, 900, Density(1f, scale)) {
                SelectFormExample(LabThemeState(initialLabColors(preferences), preferences))
            }
            fun named(name: String) = nodes(scene).single {
                it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(name) == true ||
                    it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == name } == true }
            fun click(name: String) { named(name).config[SemanticsActions.OnClick].action!!.invoke(); settle(scene) }
            try {
                settle(scene); click("Удалить Без отдела")
                assertTrue(named("Удалить Без отдела").config.contains(SemanticsActions.OnClick))
                nodes(scene).single { it.config.getOrNull(SemanticsProperties.Role) == Role.Switch }
                    .config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
                click("Удалить Без отдела"); click("Сохранить")
                assertTrue(named("Сохранено: design").config.contains(SemanticsProperties.Text))
                click("Сбросить"); click("Сохранить")
                assertTrue(named("Сохранено: |design").config.contains(SemanticsProperties.Text))
                if (scale == 1f) assertEquals(28f, named("Удалить Дизайн").boundsInRoot.height)
                else assertTrue(named("Удалить Дизайн").boundsInRoot.height >= 28f)
                File(output, "consumer-${appearance.name.lowercase()}-$scale.png").writeBytes(settle(scene))
            } finally { scene.close() }
        }
    }
}
