package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Offscreen CPU scenes only: no platform window, screen reader or sound. */
class AccordionRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (ready() && previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 4) return png
            previous = png
            Thread.sleep(10)
        }
        error("Accordion did not settle")
    }
    private fun theme(reduced: Boolean = true, appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val preferences = LabPreferences(reducedMotion = reduced, appearance = appearance)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    private fun triggers(scene: ImageComposeScene) = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }

    @Test fun sourceGeometryHoverThemesAndTextScale() {
        val output = File("build/accordion-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) for (expanded in listOf(false, true)) {
            val state = theme(appearance = appearance)
            val ready = AtomicBoolean(false)
            val width = if (scale == 1f) 503 else 320
            val scene = ImageComposeScene(width * 2, 800, Density(2f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(state, font) {
                    Column(Modifier.background(state.colors["bg-primary"])) {
                        LabAccordion(if (expanded) listOf("source") else emptyList(), {},
                            listOf(LabAccordionItem("source", "Is it accessible?")), Modifier.width(width.dp).testTag("accordion")) {
                            LabAccordionText("Yes. It adheres to the WAI-ARIA design pattern.")
                        }
                    }
                }
            }
            try {
                var png = settle(scene) { ready.get() }
                val group = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "accordion" }
                if (scale == 1f) assertEquals(if (expanded) 176 else 112, group.size.height)
                else assertTrue(group.size.height >= if (expanded) 240 else 160)
                assertTrue(triggers(scene).single().config.contains(SemanticsProperties.Heading))
                assertEquals(expanded, triggers(scene).single().config.contains(SemanticsActions.Collapse))
                for (hover in listOf(false, true)) {
                    if (hover) {
                        scene.sendPointerEvent(PointerEventType.Move, Offset(20f, 20f))
                        png = settle(scene)
                    }
                    File(output, "accordion-${appearance.name.lowercase()}-${(scale * 100).toInt()}-${if (expanded) "open" else "closed"}-${if (hover) "hover" else "rest"}.png").writeBytes(png)
                }
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun controlledRefusalKeyboardRetainedDraftAndHiddenFocus() {
        var value by mutableStateOf(listOf("a"))
        var accept by mutableStateOf(false)
        val requests = mutableListOf<List<String>>()
        val disposed = mutableListOf<String>()
        val scene = ImageComposeScene(400, 500) { LabTheme(theme()) {
            LabAccordion(value, { requests.add(it); if (accept) value = it },
                listOf(LabAccordionItem("a", "Draft"), LabAccordionItem("b", "Disabled", true), LabAccordionItem("c", "History"))) { key ->
                var draft by remember { mutableStateOf("Initial $key") }
                DisposableEffect(key) { onDispose { disposed.add(key) } }
                BasicTextField(draft, { draft = it }, singleLine = true)
            }
        } }
        fun editor() = nodes(scene).single { it.config.contains(SemanticsProperties.EditableText) }
        fun key(key: Key) {
            scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene)
        }
        try {
            settle(scene)
            editor().config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("Draft a"))
            triggers(scene).first().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            key(Key.DirectionDown)
            assertTrue(triggers(scene).last().config[SemanticsProperties.Focused])
            key(Key.Enter)
            assertEquals(listOf(listOf("c")), requests)
            assertEquals(listOf("a"), value)
            assertEquals("Draft a", editor().config[SemanticsProperties.EditableText].text)
            accept = true
            settle(scene)
            key(Key.Enter)
            assertEquals(listOf("c"), value)
            assertEquals("Initial c", editor().config[SemanticsProperties.EditableText].text)
            editor().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            value = listOf("a")
            settle(scene)
            assertTrue(triggers(scene).last().config[SemanticsProperties.Focused], "A closed panel returns focus to its own header")
            assertEquals("Draft a", editor().config[SemanticsProperties.EditableText].text)
            assertTrue(disposed.isEmpty())
        } finally { scene.close() }
        assertEquals(setOf("a", "b", "c"), disposed.toSet())
    }

    @Test fun multipleAndNonCollapsibleRespectExternalSelection() {
        var value by mutableStateOf(listOf("a"))
        var multiple by mutableStateOf(false)
        val scene = ImageComposeScene(400, 300) { LabTheme(theme()) {
            LabAccordion(value, { value = it }, listOf(LabAccordionItem("a", "A"), LabAccordionItem("b", "B")),
                multiple = multiple, collapsible = false) { LabAccordionText(it) }
        } }
        try {
            settle(scene)
            triggers(scene).first().config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf("a"), value)
            multiple = true; settle(scene)
            triggers(scene).last().config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf("a", "b"), value)
            triggers(scene).first().config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf("b"), value)
        } finally { scene.close() }
    }

    @Test fun motionUsesIntermediateGeometryAndRetargetsFromTheVisiblePose() {
        var value by mutableStateOf(listOf("a"))
        val scene = ImageComposeScene(503, 200) { LabTheme(theme(reduced = false)) {
            LabAccordion(value, { value = it }, listOf(LabAccordionItem("a", "Is it accessible?")), Modifier.testTag("moving")) {
                LabAccordionText("Yes. It adheres to the WAI-ARIA design pattern.")
            }
        } }
        fun height() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "moving" }.size.height
        var millis = -16L
        fun frame(elapsed: Long = 16): Int {
            millis += elapsed
            scene.render(millis * 1_000_000).close()
            return height()
        }
        try {
            repeat(4) { frame() }
            assertEquals(88, height())
            value = emptyList()
            val closing = List(3) { frame() }
            val interrupted = closing.last()
            assertTrue(interrupted in 57..87, "Interrupt an unfinished close: $closing")
            value = listOf("a")
            // Recompose at the same animation time: a new target must preserve the visible pose.
            assertEquals(interrupted, frame(0), "Retarget must preserve the intermediate height")
            val opening = List(12) { frame() }
            assertTrue(opening.any { it in (interrupted + 1)..87 }, "Expected intermediate reopening heights: $opening")
            assertTrue(opening.zipWithNext().all { (previous, next) -> next >= previous }, "Reopening must continue toward the new target: $opening")
            assertEquals(88, opening.last())
            value = emptyList()
            repeat(12) { frame() }
            assertEquals(56, height(), "A subsequent uninterrupted close must finish")
        } finally { scene.close() }
    }
}
