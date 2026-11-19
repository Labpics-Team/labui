package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.FocusInteraction
import androidx.compose.foundation.interaction.HoverInteraction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Packaged Geist and real Compose input/semantics, rendered on CPU without a window. */
class ChipRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun chips(scene: ImageComposeScene): List<SemanticsNode> = scene.semanticsOwners
        .flatMap { walk(it.rootSemanticsNode) }.filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Button }
    private fun layouts(scene: ImageComposeScene): List<TextLayoutResult> = scene.semanticsOwners
        .flatMap { walk(it.unmergedRootSemanticsNode) }.flatMap { node -> mutableListOf<TextLayoutResult>().also {
            node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it)
        } }
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
        error("Chip scene did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light) = LabThemeState(
        initialLabColors(LabPreferences(appearance = appearance, reducedMotion = true)),
        LabPreferences(appearance = appearance, reducedMotion = true),
    )

    @Test fun all56AuthorVariantsKeepGeometryAndLabelsAcrossThemeAndScale() {
        val output = File("build/chip-render").apply { mkdirs() }
        val states = listOf("default", "hover", "pressed", "focus", "active", "disabled", "loading")
        for (appearance in LabAppearance.entries) for (fontScale in listOf(1f, 2f)) {
            val interactions = List(56) { MutableInteractionSource() }
            val ready = AtomicBoolean(false)
            val theme = theme(appearance)
            val cellWidth = if (fontScale == 1f) 168 else 260
            val scene = ImageComposeScene(cellWidth * 7 + 48, 760, Density(1f, fontScale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        for ((shapeIndex, sharp) in listOf(false, true).withIndex())
                            for ((sizeIndex, size) in LabChipSize.entries.withIndex())
                                for ((selectionIndex, selected) in listOf(false, true).withIndex()) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        for ((stateIndex, state) in states.withIndex()) {
                                            val index = shapeIndex * 28 + sizeIndex * 14 + selectionIndex * 7 + stateIndex
                                            Box(Modifier.width((cellWidth - 8).dp)) {
                                                LabChip("Chip label", Modifier.testTag("chip-$index"), size = size, sharp = sharp,
                                                    selected = selected, onSelectedChange = {}, active = state == "active",
                                                    enabled = state != "disabled", loading = state == "loading", interactionSource = interactions[index])
                                            }
                                        }
                                    }
                                }
                    }
                }
            }
            try {
                settle(scene) { ready.get() }
                interactions.forEachIndexed { index, source -> when (states[index % 7]) {
                    "hover" -> source.tryEmit(HoverInteraction.Enter())
                    "pressed" -> source.tryEmit(PressInteraction.Press(Offset.Zero))
                    "focus" -> source.tryEmit(FocusInteraction.Focus())
                } }
                val png = settle(scene)
                File(output, "chip-${appearance.name.lowercase()}-${(fontScale * 100).toInt()}.png").writeBytes(png)
                val nodes = chips(scene)
                assertEquals(56, nodes.size)
                for ((index, node) in nodes.withIndex()) {
                    val medium = index / 14 % 2 == 1
                    val selected = index / 7 % 2 == 1
                    assertEquals(ToggleableState(if (selected) true else false), node.config[SemanticsProperties.ToggleableState])
                    assertEquals(listOf("Chip label"), node.config[SemanticsProperties.Text].map { it.text })
                    val expectedHeight = if (medium) 24 * fontScale + 16 else 12 * fontScale + 16
                    assertTrue(abs(node.size.height - expectedHeight) <= 1, "$index expected height $expectedHeight; got ${node.size.height}")
                    if (fontScale == 1f) {
                        val expected = if (medium) { if (selected) 133 else 101 } else { if (selected) 99 else 83 }
                        assertTrue(abs(expected - node.size.width) <= 1, "$index expected width $expected; got ${node.size.width}")
                    }
                    assertTrue(node.positionInRoot.x + node.size.width <= cellWidth * 7 + 48)
                    assertTrue(node.positionInRoot.y + node.size.height <= 760)
                }
                assertTrue(layouts(scene).all { it.layoutInput.style.fontWeight == FontWeight.Medium })
                File(output, "chip-${appearance.name.lowercase()}-${(fontScale * 100).toInt()}.generated.json").writeText(
                    "{\"theme\":\"$appearance\",\"fontScale\":$fontScale,\"variants\":[" + nodes.mapIndexed { index, node ->
                        "{\"index\":$index,\"x\":${node.positionInRoot.x},\"y\":${node.positionInRoot.y},\"width\":${node.size.width},\"height\":${node.size.height}}"
                    }.joinToString(",") + "]}\n")
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun oneTargetHandlesKeyboardControlledRefusalAndPendingWithoutLosingFocus() {
        var selected by mutableStateOf(false)
        var loading by mutableStateOf(false)
        var enabled by mutableStateOf(true)
        var accept = true
        var calls = 0
        val scene = ImageComposeScene(320, 120) {
            LabTheme(theme()) { Box(Modifier.padding(16.dp)) {
                LabChip("Дизайн", selected = selected, loading = loading, enabled = enabled,
                    onSelectedChange = { calls++; if (accept) selected = it })
            } }
        }
        try {
            settle(scene)
            val originalId = chips(scene).single().id
            chips(scene).single().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyUp))
            settle(scene)
            assertEquals(1, calls)
            assertTrue(selected)
            accept = false
            scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyUp))
            settle(scene)
            assertEquals(2, calls)
            assertTrue(selected)
            val width = chips(scene).single().size.width
            loading = true
            val pending = settle(scene)
            val node = chips(scene).single()
            assertEquals(originalId, node.id)
            assertTrue(node.config[SemanticsProperties.Focused])
            assertTrue(node.config.contains(SemanticsProperties.Disabled))
            assertEquals(width, node.size.width)
            assertEquals(listOf("Дизайн"), node.config[SemanticsProperties.Text].map { it.text })
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Spacebar, KeyEventType.KeyUp))
            settle(scene)
            assertEquals(2, calls)
            assertTrue(selected)
            assertTrue(pending.contentEquals(settle(scene)), "Skeleton has no idle loop")
            loading = false; enabled = false
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Press, Offset(45f, 34f))
            scene.sendPointerEvent(PointerEventType.Release, Offset(45f, 34f))
            settle(scene)
            assertEquals(2, calls)
        } finally { scene.close() }
    }

    @Test fun actionAndRemovalExposeOneExplicitlyNamedActionEach() {
        var actions = 0
        var removals = 0
        val scene = ImageComposeScene(420, 80) {
            LabTheme(theme()) { Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                LabChip("Применить", mode = LabChipMode.Action, onAction = { actions++ })
                LabChip("Дизайн", mode = LabChipMode.Remove, accessibilityLabel = "Удалить Дизайн", onRemove = { removals++ })
            } }
        }
        try {
            settle(scene)
            val nodes = chips(scene)
            assertEquals(2, nodes.size)
            assertEquals(null, nodes[0].config.getOrNull(SemanticsProperties.ToggleableState))
            assertEquals(listOf("Удалить Дизайн"), nodes[1].config[SemanticsProperties.ContentDescription])
            assertEquals(null, nodes[1].config.getOrNull(SemanticsProperties.Text), "Removal name is not announced twice")
            nodes.forEach { it.config[SemanticsActions.OnClick].action!!.invoke() }
            assertEquals(1, actions); assertEquals(1, removals)
        } finally { scene.close() }
    }

    @Test fun longTextWrapsAt200PercentInBothDirectionsAndPendingKeepsItsBox() {
        val output = File("build/chip-render").apply { mkdirs() }
        for (direction in LayoutDirection.entries) {
            var loading by mutableStateOf(false)
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(240, 700, Density(1f, 2f)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                CompositionLocalProvider(LocalLayoutDirection provides direction) { LabTheme(theme(), font) {
                    Box(Modifier.fillMaxSize().background(theme().colors["bg-primary"]).padding(24.dp)) {
                        LabChip("ПодробныйОченьДлинныйФильтр с продолжением", selected = true,
                            onSelectedChange = {}, loading = loading, showLeading = true,
                            leading = { Box(Modifier.size(size).background(color, CircleShape)) })
                    }
                } }
            }
            try {
                File(output, "chip-long-${direction.name.lowercase()}-200.png").writeBytes(settle(scene) { ready.get() })
                val node = chips(scene).single()
                assertTrue(node.size.width <= 192)
                assertTrue(node.size.height > 64)
                val label = layouts(scene).single { it.layoutInput.text.text.startsWith("Подробный") }
                assertFalse(label.didOverflowHeight)
                assertFalse(label.hasVisualOverflow)
                assertTrue(label.lineCount > 1)
                val bounds = node.size
                loading = true; settle(scene)
                assertEquals(bounds, chips(scene).single().size)
            } finally { scene.close() }
        }
    }
}
