package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Real Compose CPU rendering and semantics; no native window, input, or sound. */
class ProgressRenderTest {
    private fun owner() = object : LifecycleOwner {
        override val lifecycle = LifecycleRegistry.createUnsafe(this).apply { currentState = Lifecycle.State.RESUMED }
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light, reduced: Boolean = true): LabThemeState {
        val prefs = LabPreferences(appearance = appearance, reducedMotion = reduced)
        return LabThemeState(initialLabColors(prefs), prefs)
    }
    private fun frame(scene: ImageComposeScene, millis: Long): ByteArray = scene.render(millis * 1_000_000).use { image ->
        image.encodeToData()!!.use { it.bytes }
    }
    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equal = if (ready() && previous?.contentEquals(bytes) == true) equal + 1 else 0
            if (equal >= 3) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("Progress scene did not settle")
    }
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun progressNodes(scene: ImageComposeScene): List<SemanticsNode> = scene.semanticsOwners
        .flatMap { walk(it.rootSemanticsNode) }.filter { it.config.contains(SemanticsProperties.ProgressBarRangeInfo) }

    @Test fun authoredProgressMasters() {
        val output = File("build/progress-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (fontScale in listOf(1f, 2f)) {
            val theme = theme(appearance)
            val lifecycle = owner()
            val ready = AtomicBoolean(false)
            val cell = (128 * fontScale + 32).toInt()
            val row = (128 * fontScale + 48 * fontScale + 112).toInt()
            val scene = ImageComposeScene(cell * 6 + 48, row * 3 + 48, Density(1f, fontScale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        for (size in LabControlSize.entries) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            for (value in listOf(null, 0f, 25f, 50f, 75f, 100f)) Column(Modifier.width((cell - 16).dp),
                                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                BasicText("${size.name} ${value?.toInt() ?: "…"}", style = LabType.body().copy(color = theme.colors["label-primary"]))
                                LabLoader(value, size = size)
                                LabProgress(value, size = size, showValueText = true)
                                LabProgress(value, size = size, variant = LabProgressVariant.Circular, showValueText = true)
                            }
                        }
                    }
                } }
            }
            try {
                File(output, "progress-${appearance.name.lowercase()}-${(fontScale * 100).toInt()}.png").writeBytes(settle(scene) { ready.get() })
                assertEquals(54, progressNodes(scene).size)
            } finally { scene.close() }
        }
        for ((name, width, content) in listOf<Triple<String, Int, @Composable () -> Unit>>(
            Triple("loader-medium-75", 24) { LabLoader(75f) },
            Triple("loader-medium-unknown", 24) { LabLoader() },
            Triple("circular-medium-25", 96) { LabProgress(25f, variant = LabProgressVariant.Circular, showValueText = true) },
        )) {
            val lifecycle = owner()
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(width * 3, width * 3, Density(3f)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme(), font) {
                    Box(Modifier.fillMaxSize().background(Color.White)) { content() }
                } }
            }
            try { File(output, "$name-3x.png").writeBytes(settle(scene) { ready.get() }) } finally { scene.close() }
        }
    }

    @Test fun everyFormExposesOneNamedHonestProgressNode() {
        val lifecycle = owner()
        var value by mutableStateOf<Float?>(40f)
        var max by mutableStateOf(100f)
        val scene = ImageComposeScene(320, 400) {
            CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme()) {
                Column {
                    LabLoader(value, min = 20f, max = max, label = "Загрузка файла")
                    LabProgress(value, min = 20f, max = max, label = "Отправка файла", showValueText = true)
                    LabProgress(value, min = 20f, max = max, label = "Сохранение файла", variant = LabProgressVariant.Circular, showValueText = true)
                }
            } }
        }
        try {
            settle(scene)
            val nodes = progressNodes(scene)
            assertEquals(3, nodes.size)
            assertEquals(listOf("Загрузка файла", "Отправка файла", "Сохранение файла"), nodes.map { it.config[SemanticsProperties.ContentDescription].single() })
            for (node in nodes) {
                assertEquals(ProgressBarRangeInfo(40f, 20f..100f), node.config[SemanticsProperties.ProgressBarRangeInfo])
                assertEquals("25%", node.config[SemanticsProperties.StateDescription])
                assertEquals(null, node.config.getOrNull(SemanticsProperties.Text), "Visible percentage must not be announced twice")
            }
            for (input in listOf(null, Float.NaN, Float.POSITIVE_INFINITY)) {
                value = input
                settle(scene)
                for (node in progressNodes(scene)) {
                    assertEquals(ProgressBarRangeInfo.Indeterminate, node.config[SemanticsProperties.ProgressBarRangeInfo])
                    assertEquals(null, node.config.getOrNull(SemanticsProperties.StateDescription))
                }
            }
            value = 40f; max = 20f
            settle(scene)
            assertTrue(progressNodes(scene).all { it.config[SemanticsProperties.ProgressBarRangeInfo] == ProgressBarRangeInfo.Indeterminate })
        } finally { scene.close() }
    }

    @Test fun valueChangesAnimateButSemanticsImmediatelyDescribeTheMeasuredValue() {
        for (kind in 0..2) for (reduced in listOf(false, true)) {
            val lifecycle = owner()
            val theme = theme(reduced = reduced)
            var value by mutableStateOf<Float?>(0f)
            val scene = ImageComposeScene(120, 120) {
                CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme) {
                    when (kind) {
                        0 -> LabLoader(value)
                        1 -> LabProgress(value)
                        else -> LabProgress(value, variant = LabProgressVariant.Circular)
                    }
                } }
            }
            try {
                frame(scene, 0); frame(scene, 16); frame(scene, 32)
                value = 100f
                frame(scene, 48)
                assertEquals(100f, progressNodes(scene).single().config[SemanticsProperties.ProgressBarRangeInfo].current)
                val poses = (4L..20L).map { frame(scene, it * 16).contentHashCode() }.distinct()
                assertTrue(if (reduced) poses.size <= 2 else poses.size > 2,
                    "kind=$kind reduced=$reduced rendered ${poses.size} distinct measured poses")
            } finally { scene.close() }
        }
    }

    @Test fun unknownMotionStopsForReducedMotionAndInactiveLifecycle() {
        for (kind in 0..2) for (reduced in listOf(false, true)) {
            val lifecycle = owner()
            val theme = theme(reduced = reduced)
            val scene = ImageComposeScene(120, 120) {
                CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme) {
                    when (kind) {
                        0 -> LabLoader()
                        1 -> LabProgress()
                        else -> LabProgress(variant = LabProgressVariant.Circular)
                    }
                } }
            }
            try {
                val poses = (0L..80L).map { frame(scene, it * 16).contentHashCode() }.distinct()
                assertTrue(if (reduced) poses.size == 1 else poses.size > 2,
                    "kind=$kind reduced=$reduced rendered ${poses.size} waiting poses")
                lifecycle.lifecycle.currentState = Lifecycle.State.STARTED
                frame(scene, 1296); frame(scene, 1312)
                val stopped = (83L..110L).map { frame(scene, it * 16).contentHashCode() }.distinct()
                assertEquals(1, stopped.size, "Inactive progress must stop animation")
            } finally { scene.close() }
        }
    }

    @Test fun linearProgressGrowsFromLogicalStartAndZeroHasNoActivePaint() {
        val lifecycle = owner()
        for (direction in LayoutDirection.entries) {
            var value by mutableStateOf<Float?>(25f)
            val scene = ImageComposeScene(200, 8) {
                CompositionLocalProvider(LocalLifecycleOwner provides lifecycle, LocalLayoutDirection provides direction) {
                    LabTheme(theme()) { Box(Modifier.fillMaxSize().background(Color.White)) { LabProgress(value) } }
                }
            }
            fun pixel(x: Int): Int = scene.render().use { image ->
                org.jetbrains.skia.Bitmap.makeFromImage(image).use { it.getColor(x, 2) }
            }
            try {
                settle(scene)
                val start = if (direction == LayoutDirection.Ltr) 24 else 175
                val end = 199 - start
                val active = pixel(start)
                val track = pixel(end)
                assertTrue(active != track)
                value = 0f; settle(scene)
                assertEquals(track, pixel(start))
                assertEquals(track, pixel(end))
                value = 100f; settle(scene)
                assertEquals(active, pixel(start))
                assertEquals(active, pixel(end))
            } finally { scene.close() }
        }
    }

    @Test fun mediumLoaderPreservesTheSourceAngularGradientAcrossTheBottom() {
        val lifecycle = owner()
        val scene = ImageComposeScene(72, 72, Density(3f)) {
            CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme()) {
                Box(Modifier.fillMaxSize().background(Color.White)) { LabLoader(75f) }
            } }
        }
        try {
            settle(scene)
            // Interior samples from the immutable Figma node 6009:2854 exported at 3× on white.
            // The final primary stop lies at 270°; a superficially similar 180° stop darkens the bottom.
            val samples = listOf(
                Triple(36, 24, intArrayOf(113, 113, 119)), Triple(48, 36, intArrayOf(83, 83, 88)),
                Triple(36, 48, intArrayOf(53, 53, 56)), Triple(24, 36, intArrayOf(17, 17, 19)),
                Triple(36, 9, intArrayOf(16, 16, 18)), Triple(24, 24, intArrayOf(255, 255, 255)),
            )
            scene.render().use { image -> org.jetbrains.skia.Bitmap.makeFromImage(image).use { bitmap ->
                for ((x, y, expected) in samples) {
                    val color = bitmap.getColor(x, y)
                    for (channel in 0..2) {
                        val actual = (color shr (16 - channel * 8)) and 255
                        assertTrue(kotlin.math.abs(actual - expected[channel]) <= 5,
                            "Source sample ($x,$y) channel $channel: expected ${expected[channel]}, actual $actual")
                    }
                }
            } }
        } finally { scene.close() }
    }

    @Test fun waitingLoaderStaysCenteredUnderRectangularConstraints() {
        fun pixels(width: Int): IntArray {
            val lifecycle = owner()
            val scene = ImageComposeScene(width, 24) {
                CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme()) {
                    Box(Modifier.fillMaxSize().background(Color.White)) { LabLoader(modifier = Modifier.width(width.dp)) }
                } }
            }
            try {
                settle(scene)
                return scene.render().use { image -> org.jetbrains.skia.Bitmap.makeFromImage(image).use { bitmap ->
                    IntArray(width * 24) { bitmap.getColor(it % width, it / width) }
                } }
            } finally { scene.close() }
        }
        val square = pixels(24)
        val rectangle = pixels(48)
        for (y in 0 until 24) for (x in 0 until 48) {
            val expected = if (x in 12 until 36) square[y * 24 + x - 12] else Color.White.toArgb()
            val actual = rectangle[y * 48 + x]
            for (shift in listOf(0, 8, 16, 24)) assertTrue(
                kotlin.math.abs(((expected shr shift) and 255) - ((actual shr shift) and 255)) <= 2,
                "Centered authored viewBox at ($x,$y), channel $shift")
        }
    }

    @Test fun measuredMotionStopsWhenUnknownOrInactive() {
        val lifecycle = owner()
        var value by mutableStateOf<Float?>(0f)
        var observed: LabProgressMotion? = null
        val scene = ImageComposeScene(120, 120) {
            CompositionLocalProvider(LocalLifecycleOwner provides lifecycle) { LabTheme(theme(reduced = false)) {
                observed = rememberLabProgressMotion(labProgressState(value, 0f, 100f), 1200)
                LabProgress(value)
            } }
        }
        try {
            frame(scene, 0); frame(scene, 16); frame(scene, 32)
            value = 100f
            frame(scene, 48); frame(scene, 64); frame(scene, 80)
            val fraction = checkNotNull(observed).fraction
            assertTrue(fraction.value > 0f && fraction.value < 1f)
            value = null
            frame(scene, 96); frame(scene, 112)
            val cancelled = fraction.value
            (8L..30L).forEach { frame(scene, it * 16) }
            assertEquals(cancelled, fraction.value, "Unknown state cancels the measured tween")
            lifecycle.lifecycle.currentState = Lifecycle.State.STARTED
            value = 75f
            frame(scene, 496); frame(scene, 512)
            assertEquals(0.75f, fraction.value, "Inactive state applies its real value without frames")
            value = 25f
            frame(scene, 528); frame(scene, 544)
            assertEquals(0.25f, fraction.value)
        } finally { scene.close() }
    }
}
