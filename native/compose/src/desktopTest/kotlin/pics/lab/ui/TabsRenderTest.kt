package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** CPU scenes only: no platform window or screen reader. */
class TabsRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene): List<SemanticsNode> =
        scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
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
        error("Tabs did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light, reduced: Boolean = true): LabThemeState {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = reduced)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    private fun tabs(scene: ImageComposeScene) = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Tab }
    private fun name(node: SemanticsNode) = node.config.getOrNull(SemanticsProperties.Text)?.singleOrNull()?.text
        ?: node.config.getOrNull(SemanticsProperties.ContentDescription)?.singleOrNull().orEmpty()

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    private fun press(scene: ImageComposeScene, key: Key) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp))
        settle(scene)
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun rovingFocusSkipsDisabledAndKeepsRejectedSelectionAcrossAxesAndDirections() {
        for (vertical in listOf(false, true)) for (rtl in listOf(false, true)) for (automatic in listOf(false, true)) {
            val requests = mutableListOf<String>()
            var selected by mutableStateOf("a")
            var accept by mutableStateOf(false)
            val entries = listOf(LabTabItem("a", "a"), LabTabItem("b", "b", disabled = true), LabTabItem("c", "c"))
            val scene = ImageComposeScene(400, 300) { LabTheme(theme()) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    LabTabs(selected, {
                        requests.add(it)
                        if (accept) selected = it
                    }, entries, orientation = if (vertical) LabTabsOrientation.Vertical else LabTabsOrientation.Horizontal,
                        automatic = automatic) { BasicText("Panel $it") }
                }
            } }
            fun tabs() = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Tab }
            fun name(node: SemanticsNode) = node.config[SemanticsProperties.Text].single().text
            fun focused() = name(tabs().single { it.config.getOrNull(SemanticsProperties.Focused) == true })
            try {
                settle(scene)
                tabs().first().config[SemanticsActions.RequestFocus].action!!.invoke()
                settle(scene)
                press(scene, if (vertical) Key.DirectionDown else if (rtl) Key.DirectionLeft else Key.DirectionRight)
                assertEquals("c", focused())
                assertEquals("a", selected)
                assertEquals(if (automatic) listOf("c") else emptyList(), requests)
                assertEquals("a", name(tabs().single { it.config.getOrNull(SemanticsProperties.Selected) == true }))
                if (!automatic) {
                    press(scene, Key.Spacebar)
                    assertEquals(listOf("c"), requests)
                    assertEquals("a", selected)
                }
                accept = true
                settle(scene)
                press(scene, Key.Enter)
                assertEquals("c", selected)
                press(scene, Key.MoveHome)
                assertEquals("a", focused())
                press(scene, Key.MoveEnd)
                assertEquals("c", focused())
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun retainedPanelsKeepPlainRememberAndExcludeHiddenFocusAndSemantics() {
        var selected by mutableStateOf("a")
        val disposed = mutableListOf<String>()
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val scene = ImageComposeScene(400, 300) { LabTheme(theme) {
            Column {
                LabTabs(selected, { selected = it }, listOf(LabTabItem("a", "a"), LabTabItem("b", "b"))) { value ->
                    var draft by remember { mutableStateOf("Initial $value") }
                    DisposableEffect(value) { onDispose { disposed.add(value) } }
                    BasicTextField(draft, { draft = it }, singleLine = true)
                }
                LabButton("Outside", {})
            }
        } }
        fun editor(): SemanticsNode = nodes(scene).single { it.config.contains(SemanticsProperties.EditableText) }
        try {
            settle(scene)
            assertTrue(editor().config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("Draft a")))
            assertTrue(editor().config[SemanticsActions.RequestFocus].action!!.invoke())
            settle(scene)
            assertEquals("Draft a", editor().config[SemanticsProperties.EditableText].text)
            selected = "b"
            settle(scene)
            assertEquals("Initial b", editor().config[SemanticsProperties.EditableText].text)
            assertTrue(nodes(scene).none { it.config.getOrNull(SemanticsProperties.Focused) == true },
                "A field in a hidden panel must not keep keyboard focus")
            assertTrue(editor().config[SemanticsActions.RequestFocus].action!!.invoke())
            settle(scene)
            scene.sendKeyEvent(KeyEvent(Key.Tab, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Tab, KeyEventType.KeyUp))
            settle(scene)
            assertTrue(nodes(scene).single { it.config.getOrNull(SemanticsProperties.Focused) == true }
                .config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Outside" } == true,
                "Tab must skip the retained, hidden panel: ${nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Focused) == true }.map { it.config }}")
            selected = "a"
            settle(scene)
            assertEquals("Draft a", editor().config[SemanticsProperties.EditableText].text)
            assertTrue(disposed.isEmpty(), "Switching panels must not dispose their composition")
        } finally { scene.close() }
        assertEquals(setOf("a", "b"), disposed.toSet())
    }

    @Test fun authorDimensionsAndBothThemesAt100125And200Percent() {
        val output = File("build/tabs-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (fontScale in listOf(1f, 1.25f, 2f)) {
            val currentTheme = theme(appearance)
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(1160, 1600, Density(1f, fontScale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(currentTheme, font) {
                    Column(Modifier.fillMaxSize().background(currentTheme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        for (variant in LabTabsVariant.entries) for (edge in LabTabsEdge.entries) {
                            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                                for (orientation in LabTabsOrientation.entries) {
                                    val items = listOf(LabTabItem("a", "Tab label"), LabTabItem("b", "Tab label"),
                                        LabTabItem("c", "Tab label"), LabTabItem("d", "Disabled", disabled = true))
                                    LabTabs("a", {}, items, Modifier.width(532.dp), variant, orientation, edge) {
                                        BoxWithConstraints(Modifier.fillMaxWidth().background(currentTheme.colors["fill-quaternary"]).padding(8.dp)) {
                                            BasicText("Panel $it", style = LabType.body().copy(color = currentTheme.colors["label-primary"]))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            try {
                val png = settle(scene) { ready.get() }
                assertEquals(32, tabs(scene).size)
                val expectedHeight = 24 * fontScale + 24
                tabs(scene).forEach { assertEquals(expectedHeight.toInt(), it.size.height, "Authored control height at $fontScale") }
                val textLayouts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }.flatMap { node ->
                    mutableListOf<TextLayoutResult>().also { node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it) }
                }
                val overflow = textLayouts.filter { it.layoutInput.text.text in listOf("Tab label", "Disabled") }
                    .filter { it.lineCount != 1 || it.didOverflowHeight || it.getLineRight(0) - it.getLineLeft(0) > it.size.width + 1 }
                assertTrue(overflow.isEmpty(), "$fontScale overflow: ${overflow.map { "${it.layoutInput.text}: size=${it.size}, width=${it.didOverflowWidth}, height=${it.didOverflowHeight}, constraints=${it.layoutInput.constraints}" }}")
                File(output, "tabs-${appearance.name.lowercase()}-${(fontScale * 100).toInt()}.png").writeBytes(png)
            } finally { scene.close() }
        }
    }

    @Test fun iconOnlyNamesAndAuthorBottomExceptionRemainConsistent() {
        for (variant in LabTabsVariant.entries) for (orientation in LabTabsOrientation.entries) for (edge in LabTabsEdge.entries) {
            val scene = ImageComposeScene(300, 200) { LabTheme(theme()) {
                LabTabs("a", {}, listOf(LabTabItem("a", "Settings", iconOnly = true,
                    icon = { BasicText("+") })), variant = variant, orientation = orientation, edge = edge) {}
            } }
            try {
                settle(scene)
                val tab = tabs(scene).single()
                assertEquals("Settings", name(tab))
                assertTrue(tab.config.getOrNull(SemanticsProperties.Text).isNullOrEmpty())
                assertEquals(if (variant == LabTabsVariant.Underlined && orientation == LabTabsOrientation.Horizontal && edge == LabTabsEdge.End) 44 else 48,
                    tab.size.height)
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun narrowHorizontalListScrollsFocusedLongLabelIntoViewWithoutWrapping() {
        for (direction in LayoutDirection.entries) {
            val scene = ImageComposeScene(320, 420, Density(1f, 2f)) { LabTheme(theme()) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    LabTabs("a", {}, listOf(LabTabItem("a", "Обзор проекта"), LabTabItem("b", "Редактирование"),
                        LabTabItem("c", "История изменений")), variant = LabTabsVariant.Tinted) { BasicText("Panel $it") }
                }
            } }
            try {
                settle(scene)
                tabs(scene).first().config[SemanticsActions.RequestFocus].action!!.invoke()
                settle(scene)
                press(scene, Key.MoveEnd)
                settle(scene) { tabs(scene).last().boundsInRoot.width > 200 }
                val focused = tabs(scene).single { it.config.getOrNull(SemanticsProperties.Focused) == true }
                assertEquals("История изменений", name(focused))
                assertTrue(focused.boundsInRoot.width > 200, "Focused overflow trigger must be scrolled into the viewport: $direction ${focused.boundsInRoot} position=${focused.positionInRoot} size=${focused.size}")
                assertEquals(72, focused.size.height)
            } finally { scene.close() }
        }
    }

    @Test fun verticalReflowKeepsTheSameEditorAndNeverQueriesPanelIntrinsics() {
        var width by mutableStateOf(700)
        var starts = 0
        var ends = 0
        val scene = ImageComposeScene(720, 640, Density(1f, 2f)) { LabTheme(theme()) {
            LabTabs("a", {}, listOf(LabTabItem("a", "Настройки проекта"), LabTabItem("b", "История")),
                Modifier.width(width.dp), orientation = LabTabsOrientation.Vertical) {
                BoxWithConstraints(Modifier.testTag("panel")) {
                    var draft by remember { mutableStateOf("Draft") }
                    DisposableEffect(Unit) { starts++; onDispose { ends++ } }
                    BasicTextField(draft, { draft = it })
                }
            }
        } }
        fun panel() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "panel" }
        fun editor() = nodes(scene).single { it.config.contains(SemanticsProperties.EditableText) }
        try {
            settle(scene)
            assertTrue(panel().positionInRoot.x > 300)
            editor().config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("Retained draft"))
            editor().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            width = 320
            settle(scene)
            assertEquals(0f, panel().positionInRoot.x)
            assertTrue(panel().positionInRoot.y > tabs(scene).last().positionInRoot.y)
            assertEquals("Retained draft", editor().config[SemanticsProperties.EditableText].text)
            assertEquals(true, editor().config.getOrNull(SemanticsProperties.Focused))
            assertEquals(1, starts)
            assertEquals(0, ends)
        } finally { scene.close() }
    }

    @Test fun selectionPaintUsesSharedMotionAndReducedMotionStopsIntermediateFrames() {
        for (variant in LabTabsVariant.entries) for (reduced in listOf(false, true)) {
            var selected by mutableStateOf("a")
            val scene = ImageComposeScene(320, 100) { LabTheme(theme(reduced = reduced)) {
                LabTabs(selected, { selected = it }, listOf(LabTabItem("a", "One"), LabTabItem("b", "Two")), variant = variant) {}
            } }
            fun frame(millis: Long) = scene.render(millis * 1_000_000).use { it.encodeToData()!!.use { it.bytes.contentHashCode() } }
            try {
                frame(0); frame(16); frame(32)
                selected = "b"
                frame(48)
                assertEquals("Two", name(tabs(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }))
                val poses = (4L..20L).map { frame(it * 16) }.distinct()
                assertTrue(if (reduced) poses.size <= 2 else poses.size > 2, "$variant reduced=$reduced: ${poses.size} poses")
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun disabledPointerAndDynamicEntriesKeepTheSelectedPanelHonest() {
        var items by mutableStateOf(listOf(LabTabItem("a", "A"), LabTabItem("b", "B"), LabTabItem("c", "C", disabled = true)))
        var selected by mutableStateOf<String?>("a")
        val requested = mutableListOf<String>()
        val scene = ImageComposeScene(360, 240) { LabTheme(theme()) {
            LabTabs(selected, { requested.add(it); selected = it }, items, automatic = false) { BasicText("Panel $it") }
        } }
        try {
            settle(scene)
            val disabled = tabs(scene).last().boundsInRoot.center
            scene.sendPointerEvent(PointerEventType.Press, disabled)
            scene.sendPointerEvent(PointerEventType.Release, disabled)
            settle(scene)
            assertTrue(requested.isEmpty())
            tabs(scene).first().config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            press(scene, Key.DirectionRight)
            assertEquals("B", name(tabs(scene).single { it.config.getOrNull(SemanticsProperties.Focused) == true }))
            items = items.filter { it.value != "b" }
            settle(scene)
            assertEquals("A", name(tabs(scene).single { it.config.getOrNull(SemanticsProperties.Focused) == true }))
            items = items.map { if (it.value == "c") it.copy(disabled = false) else it }
            settle(scene)
            press(scene, Key.MoveEnd)
            press(scene, Key.Spacebar)
            assertEquals("c", selected)
            items = items.filter { it.value != "c" }
            settle(scene)
            assertEquals("c", selected, "Removing an item must not write a new controlled value")
            assertTrue(tabs(scene).none { it.config.getOrNull(SemanticsProperties.Selected) == true })
            assertTrue(nodes(scene).none { name(it).startsWith("Panel ") })
        } finally { scene.close() }
    }

    @Test fun sourceComparisonMasters() {
        val output = File("build/tabs-render").apply { mkdirs() }
        for (variant in LabTabsVariant.entries) {
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(1556, if (variant == LabTabsVariant.Tinted) 112 else 96, Density(2f)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme(), font) {
                    Box(Modifier.fillMaxSize().background(Color.White)) {
                        LabTabs("a", {}, listOf(LabTabItem("a", "Label 1"), LabTabItem("b", "Label 2")), variant = variant) {}
                    }
                }
            }
            try { File(output, "source-${variant.name.lowercase()}-native-2x.png").writeBytes(settle(scene) { ready.get() }) }
            finally { scene.close() }
        }
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(412, 110, Density(2f)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme(), font) {
                Box(Modifier.fillMaxSize().background(Color.White).padding(start = 2.dp, top = 1.dp)) {
                    LabTabControl(LabTabItem("a", "Label"), true, LabTabsVariant.Underlined, false,
                        LabTabsEdge.End, LabComponents.TabsM, false, Modifier.width(202.dp)) {}
                }
            }
        }
        try { File(output, "source-underlined-control-native-2x.png").writeBytes(settle(scene) { ready.get() }) }
        finally { scene.close() }
    }

    @Test fun hoveringAnEnabledTabUsesTheAuthoredPrimaryLabelRole() {
        for (variant in LabTabsVariant.entries) {
            val state = theme()
            val scene = ImageComposeScene(400, 120) { LabTheme(state) {
                LabTabs("a", {}, listOf(LabTabItem("a", "Selected"), LabTabItem("b", "Hover")), variant = variant) {}
            } }
            fun labelColor(): Color {
                val text = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Text)?.singleOrNull()?.text == "Hover" }
                val layouts = mutableListOf<TextLayoutResult>()
                text.config[SemanticsActions.GetTextLayoutResult].action!!.invoke(layouts)
                return layouts.single().layoutInput.style.color
            }
            try {
                settle(scene)
                assertEquals(state.colors[LabComponents.TabsRolesInactiveLabel], labelColor())
                val target = tabs(scene).last()
                scene.sendPointerEvent(PointerEventType.Move, target.boundsInRoot.center)
                settle(scene)
                assertEquals(state.colors[LabComponents.TabsRolesLabel], labelColor())
                scene.sendPointerEvent(PointerEventType.Move, Offset(399f, 119f))
                settle(scene)
                assertEquals(state.colors[LabComponents.TabsRolesInactiveLabel], labelColor())
            } finally { scene.close() }
        }
    }

    @Test fun densitySizesAndFourSegmentInsetComeFromTheSharedProfile() {
        for (size in LabControlSize.entries) for (fontScale in listOf(1f, 2f)) for (count in listOf(2, 4, 5)) {
            val scene = ImageComposeScene(640, 180, Density(1f, fontScale)) { LabTheme(theme()) {
                LabTabs("0", {}, List(count) { LabTabItem("$it", "Tab") }, variant = LabTabsVariant.Tinted, size = size) {}
            } }
            try {
                settle(scene)
                val metrics = when (size) { LabControlSize.Small -> LabComponents.TabsS; LabControlSize.Medium -> LabComponents.TabsM; LabControlSize.Large -> LabComponents.TabsL }
                val controls = tabs(scene)
                assertEquals((metrics.lineHeight * fontScale + metrics.padding * 2).toInt(), controls.first().size.height)
                assertTrue(controls.map { it.size.width }.distinct().size <= 2)
                assertEquals(if (count == 4) LabComponents.TabsListFourHorizontalPadding else LabComponents.TabsListPadding,
                    controls.first().positionInRoot.x)
            } finally { scene.close() }
        }
    }
}
