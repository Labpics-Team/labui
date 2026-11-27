package pics.lab.ui.sample

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.sp
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
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

    private suspend fun renderUntil(scene: ImageComposeScene, ready: () -> Boolean) {
        val deadline = System.nanoTime() + 10_000_000_000L
        do {
            scene.render(System.nanoTime()).close()
            if (ready()) return
            delay(10)
        } while (System.nanoTime() < deadline)
        error("Settings did not reach the expected state: ${nodes(scene).map(::label)}")
    }

    private suspend fun reveal(scene: ImageComposeScene, find: () -> SemanticsNode): SemanticsNode {
        val target = find()
        val scroll = generateSequence(target.parent) { it.parent }.first {
            it.config.getOrNull(SemanticsActions.ScrollBy) != null
        }
        val viewport = scroll.boundsInRoot
        assertTrue(viewport.height > 0, "The form must retain a scrollable viewport")
        val top = target.positionInRoot.y
        val bottom = top + target.size.height
        val dy = if (top < viewport.top) top - viewport.top
            else if (bottom > viewport.bottom) bottom - viewport.bottom else 0f
        if (dy != 0f) {
            assertTrue(scroll.config[SemanticsActions.ScrollBy].action!!.invoke(0f, dy))
        }
        try {
            renderUntil(scene) {
                val visible = find()
                visible.boundsInRoot.height >= minOf(visible.size.height.toFloat(), viewport.height) - 1f
            }
        } catch (failure: IllegalStateException) {
            snapshot(scene, File("build/settings-layout/reveal-failure.png"))
            val visible = find()
            val range = scroll.config.getOrNull(SemanticsProperties.VerticalScrollAxisRange)
            error("Cannot reveal ${label(visible)}: viewport=$viewport initialTop=$top dy=$dy " +
                "position=${visible.positionInRoot} size=${visible.size} clipped=${visible.boundsInRoot} " +
                "scroll=${range?.value?.invoke()}/${range?.maxValue?.invoke()}")
        }
        return find()
    }

    private fun press(scene: ImageComposeScene, node: SemanticsNode) {
        val point = node.boundsInRoot.center
        scene.sendPointerEvent(PointerEventType.Press, point)
        scene.sendPointerEvent(PointerEventType.Release, point)
    }

    private fun snapshot(scene: ImageComposeScene, file: File) {
        scene.render(System.nanoTime()).use { image -> image.encodeToData()!!.use { file.writeBytes(it.bytes) } }
    }

    private fun authoredHeading(node: SemanticsNode): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        assertTrue(node.config[SemanticsActions.GetTextLayoutResult].action!!.invoke(results))
        val text = results.single()
        assertEquals(20.sp, text.layoutInput.style.fontSize, "Figma Sheet title uses its own 20/20 role")
        assertEquals(20.sp, text.layoutInput.style.lineHeight)
        assertEquals(600, text.layoutInput.style.fontWeight?.weight)
        assertEquals((-.33f).sp, text.layoutInput.style.letterSpacing)
        for (line in 0 until text.lineCount - 1) {
            val gap = text.layoutInput.text.text.substring(text.getLineEnd(line, visibleEnd = true), text.getLineStart(line + 1))
            assertTrue(gap.any { it.isWhitespace() }, "Sheet headings must retain whole words at this width")
        }
        return text
    }

    @Test
    fun shortSheetKeepsFieldsAndSaveReachableAtLargeTextScale() = runBlocking {
        val output = File("build/settings-layout").apply { mkdirs() }
        val directory = Files.createTempDirectory("labui-short-sheet-test").toFile()
        val job = SupervisorJob()
        val store = createWorkspaceStore(
            directory.resolve(settingsFileName).absolutePath,
            CoroutineScope(job + Dispatchers.IO),
        )
        store.updateDisplay { it.copy(
            preferences = LabPreferences(reducedMotion = true), material = LabMaterial.Solid,
        ) }
        val colors = object : ColorProgramHost {
            override suspend fun resolve(preferences: LabPreferences) = initialLabColors(preferences)
            override fun close() = Unit
        }
        val scene = ImageComposeScene(320, 320, Density(1f, 2f)) { SettingsScreen(colors, store) }
        fun button(text: String) = nodes(scene).single {
            label(it) == text && it.config.getOrNull(SemanticsActions.OnClick) != null
        }
        fun field(text: String) = nodes(scene).single {
            it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(text) == true
        }
        try {
            renderUntil(scene) { nodes(scene).any { label(it) == "Редактировать" } }
            press(scene, reveal(scene) { button("Редактировать") })
            renderUntil(scene) { nodes(scene).any { label(it) == "Настройки пространства" } }
            authoredHeading(nodes(scene).single { label(it) == "Настройки пространства" })
            snapshot(scene, File(output, "edit-320-320-200-heading.png"))

            val name = reveal(scene) { field("Название") }
            assertTrue(name.config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("Новая лаборатория")))
            reveal(scene) { field("Описание") }
            reveal(scene) { field("Почта для уведомлений") }
            snapshot(scene, File(output, "edit-320-320-200-email.png"))
            assertEquals("Лаборатория", store.data.first().workspace.name, "Editing must retain a draft until Save")
            val save = reveal(scene) { button("Сохранить") }
            snapshot(scene, File(output, "edit-320-320-200-save.png"))
            press(scene, save)
            renderUntil(scene) { runBlocking { store.data.first().workspace.name == "Новая лаборатория" } }
            renderUntil(scene) { nodes(scene).none { label(it) == "Настройки пространства" } }
            assertEquals("hello@labpics.ru", store.data.first().workspace.email)
        } finally {
            scene.close()
            job.cancelAndJoin()
            directory.deleteRecursively()
        }
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
                val textLayout = authoredHeading(heading)
                assertEquals(1, textLayout.lineCount, "The authored appearance heading fits at both tested scales")
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
                scene.render(System.nanoTime()).use { image -> image.encodeToData()!!.use {
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
