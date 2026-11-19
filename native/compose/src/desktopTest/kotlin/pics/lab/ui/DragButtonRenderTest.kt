package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
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
import java.lang.management.ManagementFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** CPU ImageComposeScene: no window, sound, or assistive application. */
class DragButtonRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun button(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        .single { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 4) return png
            previous = png; Thread.sleep(10)
        }
        error("Drag Button did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    @Test fun gestureCommitsOnceAndCancellationResizeRtlAndResetPreserveTheAttempt() {
        for (rtl in listOf(false, true)) {
            var width by mutableStateOf(360f)
            var reset by mutableStateOf(0)
            var status by mutableStateOf(LabDragButtonStatus.Idle)
            var enabled by mutableStateOf(true)
            val calls = mutableListOf<LabDragButtonSource>()
            val scene = ImageComposeScene(450, 110) { LabTheme(theme()) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    LabDragButton("Send", { calls.add(it) }, Modifier.width(width.dp), status, reset, enabled)
                }
            } }
            fun drag(end: Float) {
                val start = if (rtl) width - 28f else 28f
                scene.sendPointerEvent(PointerEventType.Press, Offset(start, 28f))
                scene.sendPointerEvent(PointerEventType.Move, Offset(if (rtl) width - end else end, 28f))
                scene.sendPointerEvent(PointerEventType.Release, Offset(if (rtl) width - end else end, 28f))
                settle(scene)
            }
            try {
                settle(scene); drag(120f); assertTrue(calls.isEmpty())
                drag(340f); assertEquals(listOf(LabDragButtonSource.Drag), calls)
                button(scene).config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
                assertEquals(1, calls.size)
                assertEquals("Pending", button(scene).config[SemanticsProperties.StateDescription])
                status = LabDragButtonStatus.Danger; settle(scene)
                assertEquals("Error", button(scene).config[SemanticsProperties.StateDescription])
                status = LabDragButtonStatus.Idle; reset++; settle(scene)
                val start = if (rtl) width - 28f else 28f
                scene.sendPointerEvent(PointerEventType.Press, Offset(start, 28f))
                scene.sendPointerEvent(PointerEventType.Move, Offset(if (rtl) 180f else 180f, 28f)); settle(scene)
                width = 320f; settle(scene)
                scene.sendPointerEvent(PointerEventType.Release, Offset(300f, 28f)); settle(scene)
                assertEquals(1, calls.size)
                button(scene).config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
                assertEquals(listOf(LabDragButtonSource.Drag, LabDragButtonSource.Press), calls)
                reset++; enabled = false; settle(scene)
                button(scene).config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
                assertEquals(2, calls.size)
            } finally { scene.close() }
        }
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun keyboardKeepsFocusAcrossPendingAndResults() {
        var status by mutableStateOf(LabDragButtonStatus.Idle); var reset by mutableStateOf(0); var calls = 0
        val scene = ImageComposeScene(400, 100) { LabTheme(theme()) { LabDragButton("Send", { calls++ }, status = status, resetKey = reset) } }
        try {
            settle(scene); scene.sendKeyEvent(KeyEvent(Key.Tab, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(Key.Tab, KeyEventType.KeyUp)); settle(scene)
            for (key in listOf(Key.Enter, Key.Spacebar)) {
                scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene)
            }
            assertEquals(1, calls); status = LabDragButtonStatus.Success; settle(scene)
            assertEquals("Success", button(scene).config[SemanticsProperties.StateDescription])
            status = LabDragButtonStatus.Idle; reset++; settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyUp)); settle(scene)
            assertEquals(2, calls)
        } finally { scene.close() }
    }
    @Test fun verticalMovementAtTheEndControlsReleaseInsideTheButton() {
        for (scale in listOf(1f, 2f)) for ((firstOutside, nextOutside, releaseOutside, expected) in listOf(
            listOf(0, 1, 1, 0),
            listOf(1, 0, 0, 1),
            listOf(0, 0, 1, 0),
            listOf(1, 1, 0, 1),
        )) {
            var calls = 0
            val scene = ImageComposeScene(400, 192, Density(1f, scale)) { LabTheme(theme()) {
                Box(Modifier.fillMaxSize()) { LabDragButton("Send", { calls++ }) }
            } }
            try {
                settle(scene)
                val bounds = button(scene).boundsInRoot
                fun y(outside: Int) = if (outside == 1) bounds.bottom + 44f else bounds.center.y
                scene.sendPointerEvent(PointerEventType.Press, Offset(28f, y(0)))
                scene.sendPointerEvent(PointerEventType.Move, Offset(375f, y(firstOutside)))
                settle(scene)
                assertEquals(bounds, button(scene).boundsInRoot, "Drag decoration must preserve measured bounds at fontScale $scale")
                scene.sendPointerEvent(PointerEventType.Move, Offset(375f, y(nextOutside)))
                scene.sendPointerEvent(PointerEventType.Release, Offset(375f, y(releaseOutside)))
                settle(scene)
                assertEquals(expected, calls, "Full drag outside=$firstOutside -> $nextOutside -> release $releaseOutside at fontScale $scale")
            } finally { scene.close() }
        }
    }
    @Test fun authoredStatesBothThemesTextScaleAndNarrowWidthRender() {
        val output = File("build/drag-button-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) for (width in listOf(320, 416, 1144)) {
            val theme = theme(appearance)
            val scene = ImageComposeScene(width, 370, Density(1f, scale)) { LabTheme(theme) {
                Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    for (status in LabDragButtonStatus.entries) LabDragButton("Confirm", {}, status = status)
                }
            } }
            try { File(output, "native-${appearance.name.lowercase()}-${(scale * 100).toInt()}-$width.png").writeBytes(settle(scene)) }
            finally { scene.close() }
        }
    }
    @Test fun sourceDragFramesKeepTheirGrowingButtonAndEndGlyph() {
        val output = File("build/drag-button-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) {
            val theme = theme(appearance)
            val scene = ImageComposeScene(1144, 56) { LabTheme(theme) {
                Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) { LabDragButton("Confirm", {}) }
            } }
            try {
                settle(scene)
                scene.sendPointerEvent(PointerEventType.Press, Offset(28f, 28f))
                scene.sendPointerEvent(PointerEventType.Move, Offset(548f, 28f))
                File(output, "native-${appearance.name.lowercase()}-half.png").writeBytes(settle(scene))
                scene.sendPointerEvent(PointerEventType.Move, Offset(1116f, 28f))
                File(output, "native-${appearance.name.lowercase()}-full.png").writeBytes(settle(scene))
                scene.sendPointerEvent(PointerEventType.Release, Offset(1116f, 28f))
            } finally { scene.close() }
        }
    }

    @Test fun longResultAtLargeTextHasNoHelperOverflow() {
        val output = File("build/drag-button-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) {
            val theme = theme(appearance)
            var showHelper by mutableStateOf(true)
            val scene = ImageComposeScene(320, 220, Density(1f, 2f)) { LabTheme(theme) {
                Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) {
                    LabDragButton("Confirm transfer", {}, status = LabDragButtonStatus.Success,
                        helperText = "Подтвердить перевод в общий бюджет", showHelper = showHelper,
                        successText = "Перевод успешно отправлен получателю")
                }
            } }
            try {
                val result = settle(scene)
                showHelper = false
                assertTrue(result.contentEquals(settle(scene)), "Helper must not paint outside a completed action")
                File(output, "native-${appearance.name.lowercase()}-200-320-long-success.png").writeBytes(result)
            } finally { scene.close() }
        }
    }

    @Test fun dragFrameCostWithoutPngEncoding() {
        val output = File("build/drag-button-evidence").apply { mkdirs() }
        val rows = mutableListOf("density\tframes\tp50_us\tp95_us\tmax_us\tjvm_bytes_per_frame")
        val allocations = ManagementFactory.getThreadMXBean() as com.sun.management.ThreadMXBean
        for (density in listOf(1f, 2f)) {
            val scene = ImageComposeScene((1144 * density).toInt(), (56 * density).toInt(), Density(density)) {
                LabTheme(theme()) { LabDragButton("Confirm", {}) }
            }
            try {
                settle(scene)
                scene.sendPointerEvent(PointerEventType.Press, Offset(28 * density, 28 * density))
                fun frame(index: Int) {
                    val fraction = 0.1f + (index % 100) / 125f
                    scene.sendPointerEvent(PointerEventType.Move, Offset((28 + 1088 * fraction) * density, 28 * density))
                    scene.render(System.nanoTime()).close()
                }
                repeat(40, ::frame)
                val before = allocations.getThreadAllocatedBytes(Thread.currentThread().id)
                val samples = LongArray(180) { index ->
                    val start = System.nanoTime(); frame(index); (System.nanoTime() - start) / 1000
                }.sorted()
                val bytes = allocations.getThreadAllocatedBytes(Thread.currentThread().id) - before
                rows.add("$density\t${samples.size}\t${samples[samples.size / 2]}\t${samples[(samples.size * .95).toInt()]}\t${samples.last()}\t${bytes / samples.size}")
            } finally { scene.close() }
        }
        File(output, "native-frame-cost.tsv").writeText(rows.joinToString("\n") + "\n")
    }

}
