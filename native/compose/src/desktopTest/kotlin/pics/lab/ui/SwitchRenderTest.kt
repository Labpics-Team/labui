package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.FocusInteraction
import androidx.compose.foundation.interaction.HoverInteraction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.TextLayoutResult
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Offscreen CPU scenes only: no platform windows or audio. */
class SwitchRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun switches(scene: ImageComposeScene): List<SemanticsNode> = scene.semanticsOwners
        .flatMap { walk(it.rootSemanticsNode) }
        .filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Switch }

    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null
        var equalFrames = 0
        repeat(100) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equalFrames = if (ready() && previous?.contentEquals(bytes) == true) equalFrames + 1 else 0
            if (equalFrames >= 4) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("The switch scene did not settle")
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun oneNamedActionPreservesControlledAndDisabledState() {
        val prefs = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(prefs), prefs)
        var value by mutableStateOf(false)
        var enabled by mutableStateOf(true)
        var width by mutableStateOf(288.dp)
        var calls = 0
        val scene = ImageComposeScene(320, 100) {
            LabTheme(theme) {
                LabSwitch(value, { value = it; calls++ }, "Уведомления",
                    Modifier.padding(16.dp).width(width), enabled = enabled, icon = true)
            }
        }
        try {
            settle(scene)
            val node = switches(scene).single()
            assertEquals(ToggleableState.Off, node.config[SemanticsProperties.ToggleableState])
            assertTrue(node.config[SemanticsProperties.Text].any { it.text == "Уведомления" })
            assertTrue(node.config[SemanticsActions.OnClick].action!!.invoke())
            settle(scene)
            assertEquals(1, calls)
            assertEquals(ToggleableState.On, switches(scene).single().config[SemanticsProperties.ToggleableState])
            assertTrue(switches(scene).single().config[SemanticsActions.RequestFocus].action!!.invoke())
            settle(scene)
            val focusedNode = switches(scene).single().id
            width = 120.dp
            settle(scene)
            assertEquals(focusedNode, switches(scene).single().id, "Reflow must preserve the same native action")
            assertEquals(true, switches(scene).single().config[SemanticsProperties.Focused])
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyUp))
            settle(scene)
            assertEquals(2, calls, "Space must perform exactly one native toggle")
            assertEquals(ToggleableState.Off, switches(scene).single().config[SemanticsProperties.ToggleableState])
            enabled = false
            settle(scene)
            assertTrue(switches(scene).single().config.contains(SemanticsProperties.Disabled))
            scene.sendPointerEvent(PointerEventType.Press, Offset(30f, 28f))
            scene.sendPointerEvent(PointerEventType.Release, Offset(30f, 28f))
            settle(scene)
            assertEquals(2, calls, "A disabled switch must not change its model")
            assertEquals(false, value)
        } finally { scene.close() }
    }

    @Test fun longLabelsWrapAndTheThumbFollowsLayoutDirection() {
        val output = File("build/switch-render").apply { mkdirs() }
        for (direction in listOf(LayoutDirection.Ltr, LayoutDirection.Rtl)) {
            val prefs = LabPreferences(appearance = LabAppearance.Dark, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val ready = AtomicBoolean(false)
            var checked by mutableStateOf(false)
            val scene = ImageComposeScene(320, 700, Density(1f, 2f)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    LabTheme(theme, font) {
                        Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            LabSwitch(checked, { checked = it }, "", size = LabControlSize.Large)
                            LabSwitch(true, {}, "Получать уведомления об изменениях пространства", size = LabControlSize.Large)
                            LabSwitch(false, {}, "Рабочее пространство", labelStart = "Личные настройки")
                        }
                    }
                }
            }
            try {
                settle(scene) { ready.get() }
                fun thumbCenter(): Float {
                    val node = switches(scene).first()
                    val y = (node.positionInRoot.y + node.size.height / 2).toInt()
                    return scene.render().use { image ->
                        val bitmap = org.jetbrains.skia.Bitmap.makeFromImage(image)
                        try {
                            val pixels = (0 until 320).filter { x ->
                                val color = bitmap.getColor(x, y)
                                (color shr 16 and 255) > 245 && (color shr 8 and 255) > 245 && (color and 255) > 245
                            }
                            assertTrue(pixels.isNotEmpty())
                            pixels.average().toFloat()
                        } finally { bitmap.close() }
                    }
                }
                val off = thumbCenter()
                checked = true
                File(output, "switch-long-labels-${direction.name.lowercase()}-200.png").writeBytes(settle(scene) { ready.get() })
                val on = thumbCenter()
                assertTrue(if (direction == LayoutDirection.Ltr) on > off else on < off,
                    "The thumb must move towards the logical end when switched on in $direction")
                val texts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                    .flatMap { node -> mutableListOf<TextLayoutResult>().also {
                        node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it)
                    } }
                assertEquals(3, texts.size)
                assertTrue(texts.any { it.lineCount > 1 })
                // A paragraph may retain the wider constraint after BasicText
                // hugs a short line. Check actual line bounds, not that width.
                for (text in texts) for (line in 0 until text.lineCount) assertTrue(
                    text.getLineLeft(line) >= -1 && text.getLineRight(line) <= text.size.width + 1 &&
                        text.getLineBottom(line) <= text.size.height + 1,
                    "Every rendered label line must remain inside its allocated bounds")
                for (text in texts) for (line in 0 until text.lineCount - 1) {
                    val end = text.getLineEnd(line, visibleEnd = true)
                    val start = text.getLineStart(line + 1)
                    assertTrue(text.layoutInput.text.text.substring(end, start).any { it.isWhitespace() },
                        "Reflow must preserve whole words when they fit the container")
                }
                for (node in switches(scene)) assertTrue(node.positionInRoot.x >= 0 &&
                    node.positionInRoot.x + node.size.width <= 320 && node.positionInRoot.y + node.size.height <= 700)
            } finally { scene.close() }
        }
    }

    @Test fun allAuthoredStatesRenderAtSystemTextScales() {
        val output = File("build/switch-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val ready = AtomicBoolean(false)
            val previews = mutableListOf<Pair<MutableInteractionSource, String>>()
            val columnWidth = if (scale == 2f) 320 else 210
            val imageWidth = columnWidth * 3 + 48
            val imageHeight = if (scale == 2f) 2400 else 1760
            val scene = ImageComposeScene(imageWidth, imageHeight, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        for (size in LabControlSize.entries) for (state in listOf("default", "hover", "pressed", "focus", "disabled")) {
                            for (icon in listOf(false, true)) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                for (intent in listOf(LabIntent.Neutral, LabIntent.Accent, LabIntent.Danger)) {
                                    val interactions = remember {
                                        MutableInteractionSource().also { previews.add(it to state) }
                                    }
                                    LabSwitch(intent == LabIntent.Accent, {}, "Label",
                                        Modifier.width((columnWidth - 16).dp), enabled = state != "disabled",
                                        intent = intent, size = size, icon = icon, labelStart = "Label",
                                        interactionSource = interactions)
                                }
                            }
                        }
                        // The source also contains disabled on/off pairs for every intent.
                        for (size in LabControlSize.entries) for (icon in listOf(false, true)) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            for (intent in listOf(LabIntent.Neutral, LabIntent.Accent, LabIntent.Danger)) {
                                LabSwitch(intent != LabIntent.Accent, {}, "Label", Modifier.width((columnWidth - 16).dp),
                                    enabled = false, intent = intent, size = size, icon = icon, labelStart = "Label")
                            }
                        }
                    }
                }
            }
            try {
                settle(scene) { ready.get() }
                // The child's collectors must be subscribed before transient
                // interaction events are emitted; an initial effect can lose them.
                for ((interactions, state) in previews) {
                    val interaction = when (state) {
                        "hover" -> HoverInteraction.Enter()
                        "pressed" -> PressInteraction.Press(Offset.Zero)
                        "focus" -> FocusInteraction.Focus()
                        else -> null
                    }
                    if (interaction != null) assertTrue(interactions.tryEmit(interaction))
                }
                File(output, "switch-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png")
                    .writeBytes(settle(scene) { ready.get() })
                assertEquals(108, switches(scene).size)
                File(output, "switch-${appearance.name.lowercase()}-${(scale * 100).toInt()}.json").writeText(
                    "{\"width\":$imageWidth,\"height\":$imageHeight,\"controls\":[" +
                        switches(scene).mapIndexed { index, node ->
                            "{\"index\":$index,\"left\":${node.positionInRoot.x},\"top\":${node.positionInRoot.y}," +
                                "\"width\":${node.size.width},\"height\":${node.size.height}}"
                        }.joinToString(",") + "]}\n")
                for (node in switches(scene)) assertTrue(node.positionInRoot.x + node.size.width <= imageWidth &&
                    node.positionInRoot.y + node.size.height <= imageHeight,
                    "Every source variant must remain inside the image at $scale")
            } finally { scene.close() }
        }
    }
}
