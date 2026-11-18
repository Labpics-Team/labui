package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.HoverInteraction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** CPU-only Compose scenes; no platform window or sound. */
class SelectionRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene, role: Role): List<SemanticsNode> = scene.semanticsOwners
        .flatMap { walk(it.rootSemanticsNode) }.filter { it.config.getOrNull(SemanticsProperties.Role) == role }
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
        error("Selection scene did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(prefs), prefs)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    private fun press(scene: ImageComposeScene, key: Key) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp))
        settle(scene)
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun mixedCheckboxHasOneNamedNativeActionAndPreservesControlledState() {
        val theme = theme()
        var checked by mutableStateOf(false)
        var mixed by mutableStateOf(true)
        var enabled by mutableStateOf(true)
        var calls = 0
        val scene = ImageComposeScene(320, 100) { LabTheme(theme) {
            LabCheckbox(checked, { checked = it; mixed = false; calls++ }, "Выбор",
                Modifier.padding(16.dp), enabled = enabled, indeterminate = mixed, labelStart = "Общий")
        } }
        try {
            settle(scene)
            val action = nodes(scene, Role.Checkbox).single()
            assertEquals(ToggleableState.Indeterminate, action.config[SemanticsProperties.ToggleableState])
            assertEquals(listOf("Общий", "Выбор"), action.config[SemanticsProperties.Text].map { it.text })
            action.config[SemanticsActions.OnClick].action!!.invoke()
            settle(scene)
            assertEquals(true, checked)
            assertEquals(1, calls)
            assertEquals(ToggleableState.On, nodes(scene, Role.Checkbox).single().config[SemanticsProperties.ToggleableState])
            nodes(scene, Role.Checkbox).single().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            press(scene, Key.Spacebar)
            assertEquals(false, checked)
            assertEquals(2, calls)
            enabled = false
            settle(scene)
            assertTrue(nodes(scene, Role.Checkbox).single().config.contains(SemanticsProperties.Disabled))
            scene.sendPointerEvent(PointerEventType.Press, Offset(30f, 28f))
            scene.sendPointerEvent(PointerEventType.Release, Offset(30f, 28f))
            settle(scene)
            assertEquals(2, calls)
        } finally { scene.close() }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun radioKeyboardSkipsDisabledWrapsAndLeavesOneTabStop() {
        val theme = theme()
        var selected by mutableStateOf<String?>("a")
        val items = listOf(LabRadioItem("a", "Первый"), LabRadioItem("b", "Недоступный", disabled = true), LabRadioItem("c", "Последний"))
        val scene = ImageComposeScene(360, 260) { LabTheme(theme) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                LabRadioGroup(selected, { selected = it }, items, label = "Варианты")
                LabCheckbox(false, {}, "После группы")
            }
        } }
        try {
            settle(scene)
            assertEquals(3, nodes(scene, Role.RadioButton).size)
            nodes(scene, Role.RadioButton).first().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            press(scene, Key.DirectionDown)
            assertEquals("c", selected)
            assertTrue(nodes(scene, Role.RadioButton).last().config[SemanticsProperties.Focused])
            press(scene, Key.DirectionDown)
            assertEquals("a", selected)
            press(scene, Key.MoveEnd)
            assertEquals("c", selected)
            press(scene, Key.MoveHome)
            assertEquals("a", selected)
            press(scene, Key.Tab)
            assertTrue(nodes(scene, Role.Checkbox).single().config[SemanticsProperties.Focused], "Tab must leave the radio group")
        } finally { scene.close() }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun choiceboxWholeCardActsOnceAndSingleAndMultipleRemainControlled() {
        val theme = theme()
        var values by mutableStateOf(setOf<String>())
        var value by mutableStateOf<String?>("a")
        var calls = 0
        val items = listOf(LabChoiceboxItem("a", "Личный", "Описание выбора"), LabChoiceboxItem("b", "Командный"), LabChoiceboxItem("c", "Недоступный", disabled = true))
        val scene = ImageComposeScene(360, 640) { LabTheme(theme) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                LabChoicebox(values, { values = it; calls++ }, items.take(2), layout = LabChoiceboxLayout.Card)
                LabChoicebox(value, { value = it }, items, layout = LabChoiceboxLayout.Row)
            }
        } }
        try {
            settle(scene)
            assertEquals(2, nodes(scene, Role.Checkbox).size)
            assertEquals(3, nodes(scene, Role.RadioButton).size)
            val card = nodes(scene, Role.Checkbox).first()
            assertTrue(card.config[SemanticsProperties.Text].any { it.text == "Описание выбора" })
            val blank = Offset(card.positionInRoot.x + card.size.width - 20, card.positionInRoot.y + card.size.height - 12)
            scene.sendPointerEvent(PointerEventType.Press, blank)
            scene.sendPointerEvent(PointerEventType.Release, blank)
            settle(scene)
            assertEquals(setOf("a"), values)
            assertEquals(1, calls, "A card and its indicator must share one action")
            nodes(scene, Role.Checkbox).last().config[SemanticsActions.OnClick].action!!.invoke()
            settle(scene)
            assertEquals(setOf("a", "b"), values)
            nodes(scene, Role.RadioButton).first().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            press(scene, Key.DirectionDown)
            assertEquals("b", value)
            press(scene, Key.DirectionDown)
            assertEquals("a", value)
            assertTrue(nodes(scene, Role.RadioButton).last().config.contains(SemanticsProperties.Disabled))
        } finally { scene.close() }
    }

    @Test fun authoredSelectionPaintRendersAtBothThemesAndTextScales() {
        val output = File("build/selection-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) for (radio in listOf(false, true)) {
            val theme = theme(appearance)
            val ready = AtomicBoolean(false)
            val column = if (scale == 2f) 320 else 210
            val width = column * 4 + 48
            val rows = if (radio) 16 else 24
            val height = rows * ((24 * scale).toInt() + 20) + 48
            val scene = ImageComposeScene(width, height, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        for (state in listOf("default", "hover", "focus", "disabled")) for (intent in listOf(LabIntent.Accent, LabIntent.Neutral)) {
                            for (toggle in if (radio) listOf(ToggleableState.Off, ToggleableState.On) else ToggleableState.entries) {
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    for (size in LabSelectionSize.entries) {
                                        val metrics = selectionMetrics(size)
                                        SelectionLabelLayout(Modifier.width((column - 16).dp), "Label", "Label",
                                            selectionLabelStyle(metrics, state != "disabled"), metrics.labelGap.dp) {
                                            SelectionIndicator(toggle, radio, state != "disabled", intent, size, state == "hover", state == "focus")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            try {
                File(output, "${if (radio) "radio" else "check"}-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png")
                    .writeBytes(settle(scene) { ready.get() })
                val labels = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                    .filter { it.config.contains(SemanticsProperties.Text) }
                assertEquals(if (radio) 128 else 192, labels.size)
                for (node in labels) assertTrue(node.positionInRoot.x + node.size.width <= width &&
                    node.positionInRoot.y + node.size.height <= height, "Every authored variant must fit the render")
            } finally { scene.close() }
        }
    }

    @Test fun choiceboxDescriptionsAndLongLabelsReflowAtDoubleTextSizeInRtl() {
        val theme = theme(LabAppearance.Dark)
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(360, 950, Density(1f, 2f)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) { LabTheme(theme, font) {
                Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    val item = LabChoiceboxItem("a", "Рабочее пространство", "Общий доступ команды", icon = {
                        Canvas(Modifier.size(size)) { drawCircle(color) }
                    })
                    LabChoicebox("a", {}, listOf(item), layout = LabChoiceboxLayout.Card)
                    LabChoicebox(setOf("a"), {}, listOf(item), layout = LabChoiceboxLayout.Row)
                    LabCheckbox(true, {}, "Общий доступ команды", labelStart = "Рабочее пространство", size = LabSelectionSize.Large)
                }
            } }
        }
        try {
            val bytes = settle(scene) { ready.get() }
            File("build/selection-render/choicebox-dark-rtl-200.png").apply { parentFile.mkdirs(); writeBytes(bytes) }
            for (node in nodes(scene, Role.Checkbox) + nodes(scene, Role.RadioButton)) {
                assertTrue(node.positionInRoot.x >= 0 && node.positionInRoot.x + node.size.width <= 360)
                assertTrue(node.positionInRoot.y + node.size.height <= 950)
            }
            val texts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }.flatMap { node ->
                mutableListOf<TextLayoutResult>().also { node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it) }
            }
            assertEquals(6, texts.size)
            for (text in texts) for (line in 0 until text.lineCount - 1) {
                val end = text.getLineEnd(line, visibleEnd = true)
                val start = text.getLineStart(line + 1)
                assertTrue(text.layoutInput.text.text.substring(end, start).any { it.isWhitespace() },
                    "Full-width reflow must keep words intact when they fit the option")
            }
        } finally { scene.close() }
    }

    @Test fun allTwentyChoiceboxChromeVariantsRenderWithDecorativeSlots() {
        val output = File("build/selection-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) {
            val theme = theme(appearance)
            val ready = AtomicBoolean(false)
            val previews = mutableListOf<MutableInteractionSource>()
            val scene = ImageComposeScene(660, 1250) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        for (state in listOf("default", "default-hover", "active", "active-hover", "disabled")) for (multiple in listOf(false, true)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                                for (layout in LabChoiceboxLayout.entries) {
                                    val interactions = remember { MutableInteractionSource().also { if (state.endsWith("hover")) previews.add(it) } }
                                    val item = LabChoiceboxItem("sample", "Label", icon = {
                                        Canvas(Modifier.size(size)) { drawCircle(color) }
                                    })
                                    ChoiceboxOption(item, state.startsWith("active"), state != "disabled", multiple,
                                        layout, Modifier.width(LabComponents.SelectionChoiceboxPreferredWidth.dp), interactions)
                                }
                            }
                        }
                    }
                }
            }
            try {
                settle(scene) { ready.get() }
                previews.forEach { assertTrue(it.tryEmit(HoverInteraction.Enter())) }
                File(output, "choicebox-${appearance.name.lowercase()}-100.png").writeBytes(settle(scene) { ready.get() })
                val labels = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                    .filter { it.config.contains(SemanticsProperties.Text) }
                assertEquals(20, labels.size)
                for (node in labels) assertTrue(node.positionInRoot.y + node.size.height <= 1250)
            } finally { scene.close() }
        }
    }

    @Test fun neutralCheckedAndMixedGlyphsStayDistinctOnDarkSurfaces() {
        val output = File("build/selection-render").apply { mkdirs() }
        for (increased in listOf(false, true)) {
            val prefs = LabPreferences(appearance = LabAppearance.Dark, increasedContrast = increased, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val scene = ImageComposeScene(500, 150) { LabTheme(theme) {
                Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    for (mixed in listOf(false, true)) Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                        for (size in listOf(LabSelectionSize.Small, LabSelectionSize.Medium, LabSelectionSize.Large)) {
                            LabCheckbox(!mixed, {}, "Label", intent = LabIntent.Neutral, size = size, indeterminate = mixed)
                        }
                    }
                }
            } }
            try {
                File(output, "neutral-dark-${if (increased) "increased" else "standard"}-100.png").writeBytes(settle(scene))
                val controls = nodes(scene, Role.Checkbox)
                assertEquals(6, controls.size)
                scene.render().use { image ->
                    val bitmap = org.jetbrains.skia.Bitmap.makeFromImage(image)
                    try {
                        controls.forEachIndexed { index, node ->
                            val metrics = selectionMetrics(listOf(LabSelectionSize.Small, LabSelectionSize.Medium, LabSelectionSize.Large)[index % 3])
                            val left = node.positionInRoot.x.toInt()
                            val top = (node.positionInRoot.y + (node.size.height - metrics.controlSize) / 2).toInt()
                            val inset = ((metrics.controlSize - metrics.glyphSize) / 2).toInt()
                            val values = (inset until inset + metrics.glyphSize.toInt()).flatMap { y ->
                                (inset until inset + metrics.glyphSize.toInt()).map { x ->
                                    val color = bitmap.getColor(left + x, top + y)
                                    ((color shr 16 and 255) + (color shr 8 and 255) + (color and 255)) / 3
                                }
                            }
                            assertTrue(values.min() < 100 && values.max() > 180,
                                "The selected and mixed neutral glyph must contrast with its light fill in dark mode (increased=$increased)")
                        }
                    } finally { bitmap.close() }
                }
            } finally { scene.close() }
        }
    }
}
