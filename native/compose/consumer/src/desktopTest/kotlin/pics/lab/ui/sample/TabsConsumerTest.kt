package pics.lab.ui.sample

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Density
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabMaterial
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors

class TabsConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png
            Thread.sleep(10)
        }
        error("Tabs consumer did not settle")
    }

    @Test fun installedConsumerPreservesDraftAcrossRejectedAndAcceptedChangesOnEveryMaterial() {
        val output = File("build/tabs-consumer").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (material in LabMaterial.entries) for (fontScale in listOf(1f, 1.25f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val scene = ImageComposeScene(400, 720, Density(1f, fontScale)) { TabsWorkspaceExample(theme, material) }
            fun tabs() = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Tab }
            fun editor() = nodes(scene).single { it.config.contains(SemanticsProperties.EditableText) }
            try {
                settle(scene)
                assertEquals(3, tabs().size)
                editor().config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("Сохранённый черновик"))
                tabs()[1].config[SemanticsActions.OnClick].action!!.invoke()
                settle(scene)
                assertEquals(true, tabs()[0].config[SemanticsProperties.Selected])
                assertEquals("Сохранённый черновик", editor().config[SemanticsProperties.EditableText].text)
                nodes(scene).single { it.config.getOrNull(SemanticsProperties.Role) == Role.Switch }
                    .config[SemanticsActions.OnClick].action!!.invoke()
                tabs()[1].config[SemanticsActions.OnClick].action!!.invoke()
                settle(scene)
                assertEquals(true, tabs()[1].config[SemanticsProperties.Selected])
                assertEquals("Новый текст", editor().config[SemanticsProperties.EditableText].text)
                tabs()[0].config[SemanticsActions.OnClick].action!!.invoke()
                val png = settle(scene)
                assertEquals("Сохранённый черновик", editor().config[SemanticsProperties.EditableText].text)
                assertTrue(tabs()[2].config.contains(SemanticsProperties.Disabled))
                File(output, "tabs-consumer-${appearance.name.lowercase()}-${material.name.lowercase()}-${(fontScale * 100).toInt()}.png").writeBytes(png)
            } finally { scene.close() }
        }
    }
}
