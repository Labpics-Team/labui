package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** CPU-only ImageComposeScene: never opens a window or a screen reader. */
class SegmentedRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun radios(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        .filter { it.config.getOrNull(SemanticsProperties.Role) == Role.RadioButton }
    private fun name(node: SemanticsNode) = node.config.getOrNull(SemanticsProperties.Text)?.singleOrNull()?.text
        ?: node.config.getOrNull(SemanticsProperties.ContentDescription)?.singleOrNull().orEmpty()
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png
            Thread.sleep(10)
        }
        error("Segmented scene did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light, reduced: Boolean = true): LabThemeState {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = reduced)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    private fun press(scene: ImageComposeScene, key: Key) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun radiosSkipDisabledMirrorRtlAndKeepControlledRefusal() {
        for (rtl in listOf(false, true)) {
            var selected by mutableStateOf<String?>("a")
            var accept by mutableStateOf(false)
            val requests = mutableListOf<String>()
            val items = listOf(LabSegmentedItem("a", "A"), LabSegmentedItem("b", "B", disabled = true), LabSegmentedItem("c", "C"))
            val scene = ImageComposeScene(400, 90) { LabTheme(theme()) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    LabSegmentedControl(selected, { requests.add(it); if (accept) selected = it }, items)
                }
            } }
            try {
                settle(scene)
                radios(scene)[0].config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
                press(scene, if (rtl) Key.DirectionLeft else Key.DirectionRight)
                assertEquals(listOf("c"), requests)
                assertEquals("A", name(radios(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }))
                assertEquals("C", name(radios(scene).single { it.config.getOrNull(SemanticsProperties.Focused) == true }))
                accept = true; settle(scene); press(scene, Key.Spacebar)
                assertEquals("c", selected)
                press(scene, Key.MoveHome); assertEquals("a", selected)
                press(scene, Key.MoveEnd); assertEquals("c", selected)
            } finally { scene.close() }
        }
    }
    @Test fun allAuthoredCountsSelectionsShapesAndThemesHaveOneRadioChoice() {
        val output = File("build/segmented-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (shape in LabSegmentedShape.entries) for (count in 2..5) {
            var selected by mutableStateOf("1")
            val items = (1..count).map { LabSegmentedItem("$it", "Label $it") }
            val scene = ImageComposeScene(740, 80, Density(2f)) { LabTheme(theme(appearance)) {
                Box(Modifier.fillMaxSize().background(if (appearance == LabAppearance.Light) Color.White else Color(0xFF101012))) {
                    LabSegmentedControl(selected, { selected = it }, items, Modifier.width(370.dp), shape)
                }
            } }
            try {
                File(output, "native-${appearance.name.lowercase()}-${shape.name.lowercase()}-$count.png").writeBytes(settle(scene))
                for (index in 1..count) {
                    selected = "$index"; settle(scene)
                    assertEquals(count, radios(scene).size)
                    assertEquals("Label $index", name(radios(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }))
                    assertEquals(72f, radios(scene).first().boundsInRoot.height)
                }
            } finally { scene.close() }
        }
    }
    @Test fun interruptedSelectionReducedMotionScaleAndEmptyChoiceReachSameResult() {
        for (reduced in listOf(false, true)) for (scale in listOf(1f, 1.25f, 2f)) {
            var selected by mutableStateOf<String?>(null)
            val scene = ImageComposeScene(320, 110, Density(1f, scale)) { LabTheme(theme(reduced = reduced)) {
                LabSegmentedControl(selected, { selected = it }, listOf(
                    LabSegmentedItem("a", "Очень длинный период"), LabSegmentedItem("b", "Год")))
            } }
            try {
                settle(scene)
                assertTrue(radios(scene).none { it.config.getOrNull(SemanticsProperties.Selected) == true })
                selected = "a"; scene.render(System.nanoTime()).close()
                selected = "b"; scene.render(System.nanoTime()).close()
                selected = "a"; settle(scene)
                assertEquals("Очень длинный период", name(radios(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }))
            } finally { scene.close() }
        }
    }
}
