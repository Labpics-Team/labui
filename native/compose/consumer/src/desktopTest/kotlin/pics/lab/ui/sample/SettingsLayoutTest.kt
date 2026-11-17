package pics.lab.ui.sample

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import pics.lab.ui.ColorProgramHost
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabMaterial
import pics.lab.ui.LabPreferences
import pics.lab.ui.initialLabColors

/** Exercises the actual settings composition; no platform window or screen reader. */
class SettingsLayoutTest {
    private fun nodes(scene: ImageComposeScene): List<SemanticsNode> {
        fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
        return scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    }

    private fun label(node: SemanticsNode): String =
        node.config.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text }.orEmpty()

    private fun renderUntil(scene: ImageComposeScene, ready: () -> Boolean) {
        val deadline = System.nanoTime() + 10_000_000_000L
        do {
            scene.render().close()
            if (ready()) return
            Thread.sleep(10)
        } while (System.nanoTime() < deadline)
        error("Settings did not reach the expected state: ${nodes(scene).map(::label)}")
    }

    @Test
    fun appearanceRowsHaveSeparateTouchAreasAtNormalAndLargeTextScales() = runBlocking {
        val output = File("build/settings-layout").apply { mkdirs() }
        for ((width, scale, appearance) in listOf(
            Triple(640, 1f, LabAppearance.Light),
            Triple(320, 2f, LabAppearance.Dark),
        )) {
            val directory = Files.createTempDirectory("labui-layout-test").toFile()
            val job = SupervisorJob()
            val store = createWorkspaceStore(
                directory.resolve(settingsFileName).absolutePath,
                CoroutineScope(job + Dispatchers.IO),
            )
            store.updateDisplay { it.copy(
                preferences = LabPreferences(appearance = appearance, reducedMotion = true),
                material = LabMaterial.Solid,
            ) }
            val colors = object : ColorProgramHost {
                override suspend fun resolve(preferences: LabPreferences) = initialLabColors(preferences)
                override fun close() = Unit
            }
            val scene = ImageComposeScene(width, 1200, Density(1f, scale)) {
                SettingsScreen(colors, store)
            }
            try {
                renderUntil(scene) { nodes(scene).any { label(it) == "Оформление" } }
                val open = nodes(scene).single { label(it) == "Оформление" }
                assertTrue(open.config[SemanticsActions.OnClick].action!!.invoke())
                val labels = listOf("Высокий контраст", "Меньше движения", "Меньше прозрачности")
                fun rows() = labels.map { text -> nodes(scene).single {
                    it.config.getOrNull(SemanticsProperties.Role) == Role.Switch && label(it) == text
                } }
                renderUntil(scene) { nodes(scene).count {
                    it.config.getOrNull(SemanticsProperties.Role) == Role.Switch
                } == 4 }
                val heading = nodes(scene).single { label(it) == "Оформление" }
                val close = nodes(scene).single { label(it) == "Закрыть" }
                val textLayout = mutableListOf<TextLayoutResult>()
                assertTrue(heading.config[SemanticsActions.GetTextLayoutResult].action!!.invoke(textLayout))
                assertTrue(textLayout.single().lineCount <= 2, "Sheet action must not squeeze the title into fragments")
                if (scale == 2f) {
                    assertTrue(heading.boundsInRoot.bottom <= close.boundsInRoot.top,
                        "At large text scale the action belongs below the full-width heading")
                }
                val bounds = rows().map { it.boundsInRoot }
                bounds.forEach { assertTrue(it.height >= 48f, "Touch row must be at least 48 dp: $it") }
                bounds.zipWithNext().forEach { (above, below) ->
                    assertTrue(above.bottom <= below.top, "Settings touch rows overlap: $above / $below")
                }
                File(output, "$width-${scale}-bounds.txt").writeText(labels.zip(bounds).joinToString("\n"))
                scene.render().use { image -> image.encodeToData()!!.use {
                    File(output, "$width-${scale}.png").writeBytes(it.bytes)
                } }
                // Hit the first row's padded upper edge, away from the small authored track.
                val point = Offset(bounds.first().left + 8f, bounds.first().top + 1f)
                scene.sendPointerEvent(PointerEventType.Press, point)
                scene.sendPointerEvent(PointerEventType.Release, point)
                renderUntil(scene) { runBlocking { store.data.first().display.preferences.increasedContrast } }
                val saved = store.data.first().display.preferences
                assertEquals(true, saved.reducedMotion, "The adjacent row must not receive the pointer")
                assertEquals(false, saved.reducedTransparency)
            } finally {
                scene.close()
                job.cancelAndJoin()
                directory.deleteRecursively()
            }
        }
    }
}
