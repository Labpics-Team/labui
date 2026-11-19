@file:OptIn(androidx.compose.ui.InternalComposeUiApi::class)

package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*

class SliderRenderTest {
    private fun theme(appearance: LabAppearance = LabAppearance.Light) = LabPreferences(appearance = appearance, reducedMotion = true).let {
        LabThemeState(initialLabColors(it), it)
    }
    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equal = if (ready() && previous?.contentEquals(bytes) == true) equal + 1 else 0
            if (equal >= 3) return bytes
            previous = bytes
            Thread.sleep(5)
        }
        error("Slider did not settle")
    }
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun sliders(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        .filter { it.config.contains(SemanticsProperties.ProgressBarRangeInfo) }

    @Test fun authoredMastersAtEveryScale() {
        val output = File("build/slider-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val state = theme(appearance)
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene((668 * scale).toInt(), (960 * scale).toInt(), Density(scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(state, font) {
                    Column(Modifier.fillMaxSize().background(state.colors["bg-primary"]).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(36.dp)) {
                        for (value in listOf(0f, 50f)) LabSlider(value, {}, "Label", labelHidden = true)
                        for (value in listOf(0f, 50f, 100f)) LabRangeSlider(0f..value, {}, "Label",
                            variant = LabSliderVariant.Circular, labelHidden = true)
                        for (value in listOf(0f, 50f, 100f, 7f)) LabSlider(value, {}, "Label", variant = LabSliderVariant.Large)
                    }
                }
            }
            try {
                File(output, "native-${appearance.name.lowercase()}-density-$scale.png").writeBytes(settle(scene) { ready.get() })
                assertEquals(12, sliders(scene).size)
            } finally { scene.close() }
        }
    }

    @Test fun rangeSemanticsConstrainEachStableThumb() {
        var value by mutableStateOf(20f..80f)
        val scene = ImageComposeScene(400, 120) {
            LabTheme(theme()) { LabRangeSlider(value, { value = it }, "Budget") }
        }
        try {
            settle(scene)
            var nodes = sliders(scene)
            assertEquals(2, nodes.size)
            assertEquals(ProgressBarRangeInfo(20f, 0f..80f), nodes[0].config[SemanticsProperties.ProgressBarRangeInfo])
            assertEquals(ProgressBarRangeInfo(80f, 20f..100f), nodes[1].config[SemanticsProperties.ProgressBarRangeInfo])
            assertTrue(nodes[0].config[SemanticsActions.SetProgress].action!!.invoke(99f))
            settle(scene)
            assertEquals(80f..80f, value)
            nodes = sliders(scene)
            assertEquals(listOf("Budget minimum"), nodes[0].config[SemanticsProperties.ContentDescription])
            assertFalse(nodes[1].config[SemanticsActions.SetProgress].action!!.invoke(10f))
            assertEquals(80f..80f, value)
        } finally { scene.close() }
    }

    @Test fun pointerTracksAuthoredTrailingEdgeGeometry() {
        var value by mutableStateOf(20f)
        var ended = 0
        val scene = ImageComposeScene(400, 100) {
            LabTheme(theme()) { LabSlider(value, { value = it }, "Volume", labelHidden = true, onValueChangeEnd = { ended++ }) }
        }
        try {
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Press, Offset(74f, 22f))
            scene.sendPointerEvent(PointerEventType.Move, Offset(274f, 22f))
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Release, Offset(274f, 22f))
            settle(scene)
            assertEquals(70f, value)
            assertEquals(1, ended)
        } finally { scene.close() }
    }

    @Test fun circularPointerClampsAtTheSeamAndReturnsSmoothly() {
        var value by mutableStateOf(95f)
        val scene = ImageComposeScene(160, 160) {
            LabTheme(theme()) { Box(Modifier.padding(24.dp)) {
                LabSlider(value, { value = it }, "Dial", labelHidden = true, variant = LabSliderVariant.Circular)
            } }
        }
        fun point(fraction: Float): Offset = Offset(72 + (46 * kotlin.math.sin(fraction * 2 * Math.PI)).toFloat(),
            72 - (46 * kotlin.math.cos(fraction * 2 * Math.PI)).toFloat())
        try {
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Press, point(.95f))
            for (fraction in listOf(.97f, .99f, 1.01f, 1.1f)) {
                scene.sendPointerEvent(PointerEventType.Move, point(fraction)); settle(scene)
            }
            assertEquals(100f, value)
            scene.sendPointerEvent(PointerEventType.Move, point(.97f)); settle(scene)
            scene.sendPointerEvent(PointerEventType.Release, point(.97f)); settle(scene)
            assertEquals(97f, value)
        } finally { scene.close() }
    }

    @Test fun fractionalDomainAndReadOnlyAreHonest() {
        val domain = SliderDomain(-.7f, 1.3f, .2f)
        assertEquals(.3f, domain.snap(.3f), .000001f)
        assertEquals(90f, SliderDomain(0f, 100f, 30f).snap(100f))
        assertEquals(.3f, SliderDomain(0f, .3f, .1f).snap(.3f))
        assertEquals(listOf(.9f, .9f), domain.replace(listOf(-.3f, .9f), 0, 1.1f))
        val scene = ImageComposeScene(400, 240) {
            LabTheme(theme()) { Column {
                LabSlider(40f, {}, "Read only", readOnly = true)
                LabSlider(40f, {}, "Disabled", enabled = false)
            } }
        }
        try {
            settle(scene)
            val nodes = sliders(scene)
            assertEquals(2, nodes.size)
            assertFalse(nodes[0].config.contains(SemanticsActions.SetProgress))
            assertFalse(nodes[1].config.contains(SemanticsActions.SetProgress))
            assertTrue(nodes[1].config.contains(SemanticsProperties.Disabled))
        } finally { scene.close() }
    }

    @Test fun rtlPointerKeyboardAndSemanticsShareThePaintedPosition() {
        var value by mutableStateOf(20f)
        val ends = mutableListOf<Float>()
        val scene = ImageComposeScene(400, 100) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                LabTheme(theme()) { LabSlider(value, { value = it }, "Volume", labelHidden = true, onValueChangeEnd = { ends += it }) }
            }
        }
        try {
            settle(scene)
            assertEquals(326f, sliders(scene).single().boundsInRoot.center.x, 1f)
            scene.sendPointerEvent(PointerEventType.Press, Offset(326f, 22f))
            scene.sendPointerEvent(PointerEventType.Move, Offset(126f, 22f)); settle(scene)
            scene.sendPointerEvent(PointerEventType.Release, Offset(126f, 22f)); settle(scene)
            assertEquals(70f, value)
            assertEquals(126f, sliders(scene).single().boundsInRoot.center.x, 1f)
            scene.sendKeyEvent(KeyEvent(Key.DirectionLeft, KeyEventType.KeyDown)); settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.DirectionLeft, KeyEventType.KeyUp)); settle(scene)
            assertEquals(71f, value)
            assertEquals(listOf(70f, 71f), ends)
        } finally { scene.close() }
    }

    @Test fun escapeCancelsDraftAndControlledRejectionNeverCommits() {
        var value by mutableStateOf(20f)
        var accept by mutableStateOf(true)
        var ended = 0
        val scene = ImageComposeScene(400, 100) {
            LabTheme(theme()) { LabSlider(value, { if (accept) value = it }, "Volume", labelHidden = true, onValueChangeEnd = { ended++ }) }
        }
        try {
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Press, Offset(74f, 22f))
            scene.sendPointerEvent(PointerEventType.Move, Offset(274f, 22f)); settle(scene)
            assertEquals(70f, value)
            scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyDown)); settle(scene)
            scene.sendPointerEvent(PointerEventType.Release, Offset(274f, 22f)); settle(scene)
            assertEquals(20f, value); assertEquals(0, ended)
            accept = false; settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.DirectionRight, KeyEventType.KeyDown)); settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.DirectionRight, KeyEventType.KeyUp)); settle(scene)
            assertEquals(20f, value); assertEquals(0, ended)
        } finally { scene.close() }
    }

    @Test fun largerTextAndNarrowConstraintsStayUsable() {
        val output = File("build/slider-render").apply { mkdirs() }
        for (fontScale in listOf(1f, 1.25f, 2f)) {
            val ready = AtomicBoolean(false)
            val state = theme()
            val scene = ImageComposeScene(360, 560, Density(1f, fontScale)) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(state, font) {
                    Column(Modifier.fillMaxSize().background(state.colors["bg-primary"]).padding(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        LabSlider(50f, {}, "Очень длинная подпись с настройкой насыщенности изображения", variant = LabSliderVariant.Large)
                        LabRangeSlider(20f..80f, {}, "Диапазон яркости", showValue = true)
                        LabSlider(50f, {}, "Поворот", variant = LabSliderVariant.Circular)
                    }
                }
            }
            try {
                File(output, "native-light-font-$fontScale.png").writeBytes(settle(scene) { ready.get() })
                assertEquals(4, sliders(scene).size)
                assertEquals(167f, sliders(scene).first().boundsInRoot.center.x, 1f)
            } finally { scene.close() }
        }
        for (width in listOf(0.dp, 1.dp, 8.dp)) for (variant in LabSliderVariant.entries) {
            val scene = ImageComposeScene(80, 80) {
                LabTheme(theme()) { Box(Modifier.width(width).height(0.dp)) {
                    LabSlider(50f, {}, "Narrow", variant = variant, labelHidden = true)
                } }
            }
            try { settle(scene) } finally { scene.close() }
        }
    }

    @Test fun largeSliderRendersContinuousChanges() {
        var value by mutableStateOf(50f)
        val scene = ImageComposeScene(628, 56) {
            LabTheme(theme()) { LabSlider(value, { value = it }, "Label", variant = LabSliderVariant.Large) }
        }
        try {
            settle(scene)
            repeat(20) { value = 20f + it; scene.render().close(); scene.render().close() }
            val elapsed = (0 until 120).map { frame ->
                val start = System.nanoTime()
                value = 1f + frame % 99
                scene.render().close(); scene.render().close()
                (System.nanoTime() - start) / 1_000_000.0
            }.sorted()
            settle(scene)
            val output = File("build/slider-render").apply { mkdirs() }
            File(output, "render-performance.json").writeText("""{"renderer":"ImageComposeScene CPU", "density":1, "size":[628,56], "updates":120, "rendersPerUpdate":2, "maskSize":[13,62], "medianMs":${elapsed[60]}, "p95Ms":${elapsed[114]}}""")
        } finally { scene.close() }
    }
}
