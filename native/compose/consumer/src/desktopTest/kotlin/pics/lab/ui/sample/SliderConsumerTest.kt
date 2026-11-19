package pics.lab.ui.sample

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.Modifier
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*
import pics.lab.ui.*

class SliderConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    @Test fun installedLinearGesturePreservesItsOriginalValue() {
        var value by mutableStateOf(1f)
        var range by mutableStateOf(1f..2f)
        val singleChanges = mutableListOf<Float>()
        val rangeChanges = mutableListOf<ClosedFloatingPointRange<Float>>()
        var ended = 0
        val state = LabThemeState(initialLabColors(LabPreferences()))
        val scene = ImageComposeScene(448, 180) {
            LabTheme(state) { Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                LabSlider(value, { value = it; singleChanges.add(it) }, "Volume", labelHidden = true, onValueChangeEnd = { ended++ })
                LabRangeSlider(range, { range = it; rangeChanges.add(it) }, "Range", labelHidden = true, onValueChangeEnd = { ended++ })
            } }
        }
        fun settle() { repeat(12) { scene.render().close(); Thread.sleep(5) } }
        fun gesture(y: Float) {
            val origin = Offset(30f, y)
            scene.sendPointerEvent(PointerEventType.Press, origin)
            scene.sendPointerEvent(PointerEventType.Release, origin); settle()
            assertEquals(1f, value); assertEquals(1f..2f, range)
            scene.sendPointerEvent(PointerEventType.Press, origin)
            scene.sendPointerEvent(PointerEventType.Move, Offset(98f, y)); settle()
            if (y == 46f) assertEquals(20f, value) else assertEquals(1f..20f, range)
            scene.sendPointerEvent(PointerEventType.Move, origin); settle()
            assertEquals(1f, value); assertEquals(1f..2f, range)
            scene.sendPointerEvent(PointerEventType.Release, origin); settle()
        }
        try {
            settle(); gesture(46f); gesture(110f)
            assertEquals(listOf(20f, 1f), singleChanges)
            assertEquals(listOf(1f..20f, 1f..2f), rangeChanges)
            assertEquals(0, ended)
        } finally { scene.close() }
    }

    @Test fun installedSlidersChangeTheImageSettings() {
        val state = LabThemeState(initialLabColors(LabPreferences()))
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(460, 640, Density(1f, 2f)) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(state, font) { Box(Modifier.fillMaxSize().background(state.colors["bg-primary"]).padding(20.dp)) { SliderImageExample() } }
        }
        fun settle() { repeat(20) { scene.render().close(); Thread.sleep(5) }; assertTrue(ready.get()) }
        fun nodes() = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        fun progress(name: String, value: Float) {
            val node = nodes().single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(name) == true }
            assertTrue(node.config[SemanticsActions.SetProgress].action!!.invoke(value)); settle()
        }
        try {
            settle()
            progress("Яркость", 70f); progress("Тени", 30f); progress("Света", 90f); progress("Поворот", 180f)
            assertTrue(nodes().flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }
                .any { it.text == "Яркость 70 · диапазон 30–90 · поворот 180°" })
            val output = File("build/slider-consumer").apply { mkdirs() }
            scene.render().use { image -> image.encodeToData()!!.use { File(output, "installed-font-2.png").writeBytes(it.bytes) } }
        } finally { scene.close() }
    }

    @Test fun installedPointerAndAccessibilityPathsReachTheirValues() {
        var dial by mutableStateOf(0f)
        var range by mutableStateOf(0f..0f)
        var stepped by mutableStateOf(5f)
        val state = LabThemeState(initialLabColors(LabPreferences()))
        val scene = ImageComposeScene(448, 320) {
            LabTheme(state) { Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                LabSlider(dial, { dial=it }, "Dial", variant=LabSliderVariant.Circular, labelHidden=true)
                LabRangeSlider(range, { range=it }, "Collapsed", labelHidden=true)
                LabSlider(stepped, { stepped=it }, "Stepped", min=5f, max=100f, step=20f, labelHidden=true)
            } }
        }
        fun settle() { repeat(12) { scene.render().close(); Thread.sleep(5) } }
        try {
            settle()
            scene.sendPointerEvent(PointerEventType.Press, Offset(26f,72f))
            scene.sendPointerEvent(PointerEventType.Release, Offset(26f,72f)); settle()
            assertEquals(75f, dial)
            scene.sendPointerEvent(PointerEventType.Press, Offset(30f,162f))
            scene.sendPointerEvent(PointerEventType.Move, Offset(98f,162f)); settle()
            scene.sendPointerEvent(PointerEventType.Release, Offset(98f,162f)); settle()
            assertEquals(0f..20f, range)
            val node = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
                .single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Stepped") == true }
            val info = node.config[SemanticsProperties.ProgressBarRangeInfo]
            assertEquals(ProgressBarRangeInfo(5f, 5f..85f, 3), info)
            val increment = (info.range.endInclusive-info.range.start)/(info.steps+1)
            assertTrue(node.config[SemanticsActions.SetProgress].action!!.invoke(info.current+increment)); settle()
            assertEquals(25f, stepped)
        } finally { scene.close() }
    }
}
