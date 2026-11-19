package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.getValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.io.ByteArrayInputStream
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Actual popup and font rendering without a window, sound or accessibility app. */
class TooltipRenderTest {
    private val text = "Hello, my name is Tooltip"
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png; Thread.sleep(10)
        }
        error("Tooltip did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun keyboardFocusEscapeAndAccessibleLongPressUseOneControl() {
        lateinit var state: LabTooltipState
        var enabled by mutableStateOf(true)
        val scene = ImageComposeScene(500, 240) { LabTheme(theme()) {
            Box(Modifier.padding(120.dp, 90.dp)) {
                state = rememberLabTooltipState()
                LabTooltip(text, state = state, enabled = enabled) { trigger -> LabButton("Help", {}, trigger) }
            }
        } }
        try {
            settle(scene)
            fun button() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }
            assertFalse(state.open)
            button().config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
            assertTrue(state.open)
            assertTrue(button().config[SemanticsProperties.Focused])
            assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == text } == true })
            scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyDown)); settle(scene)
            assertFalse(state.open); assertTrue(button().config[SemanticsProperties.Focused])
            button().config[SemanticsActions.OnLongClick].action!!.invoke(); settle(scene)
            assertTrue(state.open)
            enabled = false; settle(scene); assertFalse(state.open)
        } finally { scene.close() }
    }
    @Test fun authoredTypesTailsThemesAndTextScaleRenderThroughRealPopup() {
        val output = File("build/tooltip-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (type in LabTooltipType.entries) for (tail in listOf(LabTooltipTail.Chevron, LabTooltipTail.Bubble)) for (placement in LabTooltipPlacement.entries) {
            val scene = ImageComposeScene(420, 220, Density(1f)) { LabTheme(theme(appearance)) {
                Box(Modifier.fillMaxSize().background(if (appearance == LabAppearance.Light) androidx.compose.ui.graphics.Color(0xfff4f4f4) else androidx.compose.ui.graphics.Color(0xff1e1e1e)).padding(140.dp, 130.dp)) {
                    LabTooltip(text, state = rememberLabTooltipState(initiallyOpen = true), type = type, tail = tail, placement = placement) { LabButton("Help", {}, it) }
                }
            } }
            try { output.resolve("${appearance.name}-${type.name}-${tail.name}-${placement.name}.png").writeBytes(settle(scene)) }
            finally { scene.close() }
        }
        val scene = ImageComposeScene(420, 300, Density(1f, 2f)) { LabTheme(theme()) {
            Box(Modifier.padding(120.dp)) { LabTooltip(text, state = rememberLabTooltipState(true)) { LabButton("Help", {}, it) } }
        } }
        try { output.resolve("large-text.png").writeBytes(settle(scene)); assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == text } == true }) }
        finally { scene.close() }
    }
    @Test fun positioningFlipsAtEdgesAndMirrorsStartInRtl() {
        val anchor = IntRect(80, 2, 120, 32); val window = IntSize(300, 200); val popup = IntSize(100, 56)
        var geometry: TooltipGeometry? = null
        val provider = TooltipPosition(LabTooltipPlacement.TopStart, 4) { geometry = it }
        val ltr = provider.calculatePosition(anchor, window, LayoutDirection.Ltr, popup)
        assertEquals(2, geometry!!.side); assertEquals(80, ltr.x); assertEquals(36, ltr.y)
        val rtl = provider.calculatePosition(anchor, window, LayoutDirection.Rtl, popup)
        assertEquals(20, rtl.x)
        for (placement in LabTooltipPlacement.entries) {
            val position = TooltipPosition(placement, 4) {}.calculatePosition(IntRect(290, 190, 300, 200), window, LayoutDirection.Ltr, popup)
            assertTrue(position.x >= 4 && position.x + popup.width <= window.width - 4)
            assertTrue(position.y >= 4 && position.y + popup.height <= window.height - 4)
        }
    }
    @Test fun horizontalPopupTailOccupiesTheSamePhysicalSpaceInRtl() {
        val output = File("build/tooltip-evidence").apply { mkdirs() }
        fun bounds(png: ByteArray, argb: Int, region: IntRect? = null): IntRect {
            val image = ImageIO.read(ByteArrayInputStream(png))
            var left = image.width; var top = image.height; var right = 0; var bottom = 0
            val area = region ?: IntRect(0, 0, image.width, image.height)
            for (y in area.top until area.bottom) for (x in area.left until area.right) if (image.getRGB(x, y) == argb) {
                left = minOf(left, x); top = minOf(top, y); right = maxOf(right, x + 1); bottom = maxOf(bottom, y + 1)
            }
            assertTrue(right > left && bottom > top, "Tooltip surface must be visible")
            return IntRect(left, top, right, bottom)
        }
        for (placement in listOf(LabTooltipPlacement.Left, LabTooltipPlacement.Right)) for (tail in listOf(LabTooltipTail.Chevron, LabTooltipTail.Bubble)) {
            var ltr: IntRect? = null
            for (direction in LayoutDirection.entries) {
                val theme = theme()
                val scene = ImageComposeScene(600, 300) { LabTheme(theme) {
                    Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color(0xfff4f4f4))) {
                        Box(Modifier.absoluteOffset(250.dp, 120.dp)) {
                            CompositionLocalProvider(LocalLayoutDirection provides direction) {
                                LabTooltip("Tip", state = rememberLabTooltipState(true), type = LabTooltipType.Accent,
                                    placement = placement, tail = tail) { LabButton("Help", {}, it) }
                            }
                        }
                    }
                } }
                try {
                    val png = settle(scene)
                    output.resolve("${direction.name}-${placement.name}-${tail.name}.png").writeBytes(png)
                    val actual = bounds(png, theme.colors[LabTooltipType.Accent.surfaceRole].toArgb())
                    if (direction == LayoutDirection.Ltr) ltr = actual
                    else assertEquals(ltr, actual, "$placement/$tail must reserve its physical side in RTL")
                    val anchor = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }.boundsInRoot
                    val extent = (if (tail == LabTooltipTail.Chevron) LabComponents.TooltipTailHeight else LabComponents.TooltipTailBubbleHeight).toInt()
                    val gap = LabComponents.TooltipGap.toInt()
                    val tailLeft = if (placement == LabTooltipPlacement.Right) anchor.right.toInt() + gap else anchor.left.toInt() - gap - extent
                    val tailBounds = bounds(png, theme.colors[LabTooltipType.Accent.surfaceRole].toArgb(), IntRect(tailLeft, 0, tailLeft + extent, 300))
                    assertTrue(kotlin.math.abs(tailBounds.center.y - anchor.center.y) <= 2f,
                        "$placement/$tail tail must point at its control: $tailBounds, anchor=$anchor")
                } finally { scene.close() }
            }
        }
    }
}
