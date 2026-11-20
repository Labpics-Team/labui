package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerButtons
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import pics.lab.icons.symbols.pencil
import pics.lab.icons.symbols.component
import pics.lab.icons.symbols.bin
import pics.lab.icons.symbols.duplicate
import pics.lab.icons.symbols.plusCircle
import pics.lab.icons.symbols.earth
import pics.lab.icons.symbols.arrowRedo
import pics.lab.icons.symbols.print
import pics.lab.icons.IconVariant

/** Real Foundation popup, semantics, pointer and keyboard paths, without a native window. */
class MenuRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun named(scene: ImageComposeScene, text: String) = nodes(scene).first {
        it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == text } == true ||
            it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(text) == true
    }
    private fun name(node: SemanticsNode) = node.config.getOrNull(SemanticsProperties.Text)?.firstOrNull()?.text
        ?: node.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull().orEmpty()
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 5) return png
            previous = png; Thread.sleep(10)
        }
        error("Menu did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    private fun press(scene: ImageComposeScene, key: Key) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene)
    }
    private fun items() = listOf(
        LabMenuItem.Action("edit", "Edit", icon = pencil, shortcut = listOf("Ctrl", "E"), tone = LabMenuTone.Accent),
        LabMenuItem.Action("disabled", "Disabled", disabled = true, shortcut = listOf("Ctrl", "D")),
        LabMenuItem.Check("check", "Show guides", closeOnSelect = false),
        LabMenuItem.Radio("small", "Small", "size", closeOnSelect = false),
        LabMenuItem.Radio("large", "Large", "size", closeOnSelect = false),
        LabMenuItem.Separator("separator"),
        LabMenuItem.Submenu("more", "More", listOf(LabMenuItem.Action("duplicate", "Duplicate"), LabMenuItem.Action("remove", "Remove", tone = LabMenuTone.Danger))),
    )

    @Test fun controlledOpenAndSelectionRequestsCannotChangeRejectedValues() {
        var open by mutableStateOf(true)
        val selections = mutableListOf<List<String>>()
        val opens = mutableListOf<Boolean>()
        val actions = mutableListOf<String>()
        val scene = ImageComposeScene(600, 500) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            LabMenu(items(), "Actions", open = open, onOpenChange = { opens.add(it) },
                checkedValues = listOf("small"), onCheckedValuesChange = { selections.add(it) }, onSelect = { actions.add(it) })
        } } }
        try {
            settle(scene)
            named(scene, "Show guides").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf(listOf("small", "check")), selections)
            assertEquals(ToggleableState.Off, named(scene, "Show guides").config[SemanticsProperties.ToggleableState])
            named(scene, "Large").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf("large"), selections.last())
            assertTrue(named(scene, "Small").config[SemanticsProperties.Selected])
            named(scene, "Edit").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf(false), opens); assertTrue(nodes(scene).any { name(it) == "Edit" })
            assertEquals(listOf("check", "large", "edit"), actions)
            open = false; settle(scene); assertFalse(nodes(scene).any { name(it) == "Edit" })
        } finally { scene.close() }
    }

    @Test fun keyboardSkipsDisabledOpensNestedAndRestoresEveryLevelInBothDirections() {
        for (direction in LayoutDirection.entries) {
            val actions = mutableListOf<String>()
            val scene = ImageComposeScene(800, 600) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    LabMenu(items(), "Actions", onSelect = { actions.add(it) }, modifier = Modifier.padding(120.dp))
                }
            } } }
            try {
                settle(scene)
                named(scene, "Actions").config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
                press(scene, Key.DirectionDown)
                assertEquals("Edit", name(nodes(scene).last { it.config.getOrNull(SemanticsProperties.Focused) == true }))
                press(scene, Key.DirectionDown)
                assertEquals("Show guides", name(nodes(scene).last { it.config.getOrNull(SemanticsProperties.Focused) == true }))
                press(scene, Key.MoveEnd)
                press(scene, if (direction == LayoutDirection.Rtl) Key.DirectionLeft else Key.DirectionRight)
                assertTrue(nodes(scene).any { name(it) == "Duplicate" })
                assertEquals("Duplicate", name(nodes(scene).last { it.config.getOrNull(SemanticsProperties.Focused) == true }))
                press(scene, Key.Escape)
                assertFalse(nodes(scene).any { name(it) == "Duplicate" })
                assertEquals("More", name(nodes(scene).last { it.config.getOrNull(SemanticsProperties.Focused) == true }))
                press(scene, if (direction == LayoutDirection.Rtl) Key.DirectionLeft else Key.DirectionRight)
                press(scene, Key.Enter)
                assertEquals(listOf("duplicate"), actions)
                assertFalse(nodes(scene).any { name(it) == "Edit" })
                assertTrue(named(scene, "Actions").config[SemanticsProperties.Focused])
            } finally { scene.close() }
        }
    }

    @Test fun contextAccessibleLongPressAndMenuKeyUseTheSamePopup() {
        val scene = ImageComposeScene(600, 500) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            LabContextMenu(items(), "Object actions") { control -> LabText("Context target", control.padding(40.dp)) }
        } } }
        try {
            settle(scene)
            named(scene, "Context target").config[SemanticsActions.OnLongClick].action!!.invoke(); settle(scene)
            assertTrue(nodes(scene).any { name(it) == "Edit" })
            press(scene, Key.Escape)
            assertTrue(named(scene, "Context target").config[SemanticsProperties.Focused])
            press(scene, Key.Menu)
            assertTrue(nodes(scene).any { name(it) == "Edit" })
        } finally { scene.close() }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun secondaryPointerInvocationAndNestedPointerSelectionFollowRealPositions() {
        val actions = mutableListOf<String>()
        val scene = ImageComposeScene(900, 600) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            LabContextMenu(items(), "Object actions", onSelect = { actions.add(it) }) { control ->
                Box(control.size(800.dp, 500.dp)) { LabText("Context target") }
            }
        } } }
        try {
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Press, Offset(200f, 100f), buttons = PointerButtons(isSecondaryPressed = true))
            scene.sendPointerEvent(PointerEventType.Release, Offset(200f, 100f), buttons = PointerButtons())
            settle(scene)
            assertTrue(nodes(scene).any { name(it) == "Edit" })
            val more = named(scene, "More").boundsInRoot.center
            scene.sendPointerEvent(PointerEventType.Press, more); scene.sendPointerEvent(PointerEventType.Release, more); settle(scene)
            assertTrue(nodes(scene).any { name(it) == "Duplicate" })
            val duplicate = named(scene, "Duplicate").boundsInRoot.center
            scene.sendPointerEvent(PointerEventType.Press, duplicate); scene.sendPointerEvent(PointerEventType.Release, duplicate); settle(scene)
            assertEquals(listOf("duplicate"), actions)
            assertFalse(nodes(scene).any { name(it) == "Edit" })
        } finally { scene.close() }
    }

    @Test fun menubarRovesSkipsDisabledAndSwitchesOpenRootsInBothDirections() {
        val menus = listOf(LabMenubarItem("file", "File", listOf(LabMenuItem.Action("new", "New"))),
            LabMenubarItem("disabled", "Disabled root", emptyList(), disabled = true),
            LabMenubarItem("edit", "Edit", listOf(LabMenuItem.Action("copy", "Copy"))))
        for (direction in LayoutDirection.entries) {
            var value by mutableStateOf<String?>(null)
            val scene = ImageComposeScene(640, 480) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) { LabMenubar(menus, value, { value = it }) }
            } } }
            try {
                settle(scene)
                named(scene, "File").config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
                press(scene, if (direction == LayoutDirection.Rtl) Key.DirectionLeft else Key.DirectionRight)
                assertTrue(named(scene, "Edit").config[SemanticsProperties.Focused])
                press(scene, Key.DirectionDown)
                assertEquals("edit", value); assertTrue(nodes(scene).any { name(it) == "Copy" })
                press(scene, if (direction == LayoutDirection.Rtl) Key.DirectionLeft else Key.DirectionRight)
                assertEquals("file", value); assertTrue(nodes(scene).any { name(it) == "New" })
                press(scene, Key.Escape)
                assertEquals(null, value); assertTrue(named(scene, "File").config[SemanticsProperties.Focused])
            } finally { scene.close() }
        }
    }

    @Test fun authoredFamiliesRenderBothThemesAndGrowingText() {
        val output = File("build/menu-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) for (family in listOf("menu", "context", "menubar")) {
            val state = theme(appearance)
            val scene = ImageComposeScene(760, 860, Density(1f, scale)) { LabTheme(state) {
                LabScene(Modifier.fillMaxSize(), { Box(Modifier.fillMaxSize().background(state.colors["bg-primary"])) }) {
                    Box(Modifier.padding(40.dp)) {
                        when (family) {
                            "menu" -> LabMenu(items(), "Actions", defaultOpen = true, heading = "Project", defaultCheckedValues = listOf("check", "small"))
                            "context" -> LabContextMenu(items(), "Object actions", defaultOpen = true, defaultCheckedValues = listOf("check", "large")) { LabText("Context target", it.padding(16.dp)) }
                            else -> LabMenubar(listOf(LabMenubarItem("file", "File", items()), LabMenubarItem("edit", "Edit", emptyList()), LabMenubarItem("disabled", "Disabled", emptyList(), disabled = true)), defaultValue = "file", defaultCheckedValues = listOf("check", "small"))
                        }
                    }
                }
            } }
            try {
                output.resolve("$family-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(settle(scene))
                assertTrue(nodes(scene).any { name(it) == "Show guides" })
                val edit = named(scene, "Edit")
                assertTrue(edit.size.height >= (24 * scale + 16).toInt(), "Rows grow with system type: $family $scale ${edit.size}")
                assertTrue(nodes(scene).none { name(it) == "D" }, "Disabled accessories stay hidden")
            } finally { scene.close() }
        }
    }

    @Test fun positionFlipsNestedPanelsAndMirrorsLogicalStart() {
        val anchor = IntRect(260, 80, 300, 120); val window = IntSize(400, 300); val panel = IntSize(120, 160)
        assertEquals(IntOffset(136, 80), MenuPosition(LabMenuPlacement.BottomStart, 4, nested = true).calculatePosition(anchor, window, LayoutDirection.Rtl, panel))
        assertEquals(IntOffset(136, 80), MenuPosition(LabMenuPlacement.BottomStart, 4, nested = true).calculatePosition(anchor, window, LayoutDirection.Ltr, panel))
        assertEquals(180, MenuPosition(LabMenuPlacement.BottomStart, 4).calculatePosition(anchor, window, LayoutDirection.Rtl, panel).x)
        assertEquals(IntOffset(276, 136), MenuPosition(LabMenuPlacement.BottomStart, 4, IntOffset(30, 70)).calculatePosition(anchor, window, LayoutDirection.Ltr, panel))
    }

    @Test fun tabLeavesTheMenuAndDynamicDisabledItemsDoNotKeepFocus() {
        var entries by mutableStateOf(listOf(LabMenuItem.Action("one", "One"), LabMenuItem.Action("two", "Two")))
        val scene = ImageComposeScene(600, 500) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            Column {
                LabMenu(entries, "Actions")
                LabButton("After menu", {})
            }
        } } }
        try {
            settle(scene)
            named(scene, "Actions").config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
            press(scene, Key.DirectionDown)
            entries = listOf(LabMenuItem.Action("one", "One", disabled = true), LabMenuItem.Action("two", "Two"))
            settle(scene)
            assertTrue(named(scene, "Two").config[SemanticsProperties.Focused])
            press(scene, Key.Tab)
            assertFalse(nodes(scene).any { name(it) == "One" })
            assertTrue(named(scene, "After menu").config[SemanticsProperties.Focused])
        } finally { scene.close() }
    }

    @Test fun nestedOptionsWithIconsShareRadioGroupsAndDefaultsAcrossTheTree() {
        val items = listOf(LabMenuItem.Radio("root", "Root size", "size", closeOnSelect = false),
            LabMenuItem.Submenu("options", "Options", listOf(
                LabMenuItem.Check("nested-check", "Nested check", icon = pencil, closeOnSelect = false),
                LabMenuItem.Radio("nested-radio", "Nested size", "size", icon = pencil, closeOnSelect = false),
                LabMenuItem.Check("locked", "Locked", disabled = true, icon = pencil, shortcut = listOf("X"), closeOnSelect = false),
            )))
        val changes = mutableListOf<List<String>>()
        val scene = ImageComposeScene(900, 600) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            LabMenu(items, "Actions", defaultOpen = true, defaultCheckedValues = listOf("root"), onCheckedValuesChange = { changes.add(it) })
        } } }
        fun click(label: String) { named(scene, label).config[SemanticsActions.OnClick].action!!.invoke(); settle(scene) }
        try {
            settle(scene); click("Options"); click("Nested check")
            assertEquals(ToggleableState.On, named(scene, "Nested check").config[SemanticsProperties.ToggleableState])
            click("Nested size")
            assertEquals(listOf("nested-check", "nested-radio"), changes.last())
            assertTrue(named(scene, "Nested size").config[SemanticsProperties.Selected])
            val locked = named(scene, "Locked").boundsInRoot.center
            scene.sendPointerEvent(PointerEventType.Press, locked); scene.sendPointerEvent(PointerEventType.Release, locked); settle(scene)
            assertEquals(2, changes.size)
            assertTrue(nodes(scene).none { name(it) == "X" })
            press(scene, Key.Escape)
            assertFalse(named(scene, "Root size").config[SemanticsProperties.Selected])
        } finally { scene.close() }
    }

    @Test fun pointerCanReturnFromSubmenuToAnActionInItsParent() {
        val actions = mutableListOf<String>()
        val scene = ImageComposeScene(900, 600) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            LabMenu(items(), "Actions", defaultOpen = true, onSelect = { actions.add(it) })
        } } }
        try {
            settle(scene)
            named(scene, "More").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            val edit = named(scene, "Edit").boundsInRoot.center
            scene.sendPointerEvent(PointerEventType.Press, edit); scene.sendPointerEvent(PointerEventType.Release, edit); settle(scene)
            assertEquals(listOf("edit"), actions)
        } finally { scene.close() }
    }

    @Test fun pointerSwitchesMenubarRootsAndOutsidePressDismissesTheWholeCascade() {
        var value by mutableStateOf<String?>(null)
        val menus = listOf(LabMenubarItem("file", "File", listOf(LabMenuItem.Action("new", "New"))),
            LabMenubarItem("edit", "Edit", listOf(LabMenuItem.Action("copy", "Copy"))))
        val scene = ImageComposeScene(900, 600) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            LabMenubar(menus, value, { value = it })
        } } }
        try {
            settle(scene)
            named(scene, "File").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            val edit = named(scene, "Edit").boundsInRoot.center
            scene.sendPointerEvent(PointerEventType.Move, edit); settle(scene)
            assertEquals("edit", value)
            assertTrue(nodes(scene).any { name(it) == "Copy" })
            scene.sendPointerEvent(PointerEventType.Press, Offset(850f, 550f))
            scene.sendPointerEvent(PointerEventType.Release, Offset(850f, 550f)); settle(scene)
            assertEquals(null, value)
        } finally { scene.close() }
    }

    @Test fun sourceCompositionsKeepTheAuthoredDimensionsAndStates() {
        val output = File("build/menu-evidence").apply { mkdirs() }
        val dropdown = buildList {
            val shortcuts = mapOf(1 to listOf("⌘", "⇧", "H"), 2 to listOf("⌘", "G"), 3 to listOf("⌘", "F"), 4 to listOf("⌘", "D"), 6 to listOf("⇧", "Z"), 8 to listOf("⌘", "⇧", "Q"))
            for (number in 1..8) {
                add(LabMenuItem.Action("item-$number", "Label", disabled = number == 7,
                    tone = when (number) { 1 -> LabMenuTone.Accent; 8 -> LabMenuTone.Danger; else -> LabMenuTone.Neutral },
                    icon = component, iconVariant = IconVariant.Filled, shortcut = shortcuts[number] ?: emptyList()))
                if (number in listOf(3, 5, 7)) add(LabMenuItem.Separator("separator-$number"))
            }
        }
        val context = listOf(
            LabMenuItem.Action("back", "Back", shortcut = listOf("⌘", "[")),
            LabMenuItem.Action("forward", "Forward", disabled = true),
            LabMenuItem.Action("reload", "Reload", shortcut = listOf("⌘", "R")), LabMenuItem.Separator("s1"),
            LabMenuItem.Check("o1", "1st option", shortcut = listOf("⌘", "⇧", "A")),
            LabMenuItem.Check("o2", "2nd option", shortcut = listOf("⌘", "⇧", "B")),
            LabMenuItem.Check("o3", "3rd option", shortcut = listOf("⌘", "⇧", "C")), LabMenuItem.Separator("s2"),
            LabMenuItem.Submenu("team", "Team", listOf(LabMenuItem.Action("member", "Member"))), LabMenuItem.Separator("s3"),
            LabMenuItem.Radio("r1", "1st option", "radio", shortcut = listOf("⌘", "A")),
            LabMenuItem.Radio("r2", "2nd option", "radio", shortcut = listOf("⌘", "B")), LabMenuItem.Separator("s4"),
            LabMenuItem.Action("delete", "Delete", icon = bin, tone = LabMenuTone.Danger),
        )
        val file = listOf(LabMenuItem.Action("tab", "New Tab", icon = duplicate, shortcut = listOf("⌘", "T")),
            LabMenuItem.Action("window", "New Window", icon = plusCircle, shortcut = listOf("⌘", "N")),
            LabMenuItem.Action("incognito", "New Incognito Window", icon = earth, disabled = true), LabMenuItem.Separator("s1"),
            LabMenuItem.Submenu("share", "Share", listOf(LabMenuItem.Action("copy", "Copy link")), icon = arrowRedo),
            LabMenuItem.Action("print", "Print", icon = print, shortcut = listOf("⌘", "P")))
        for (appearance in LabAppearance.entries) for (family in listOf("dropdown", "context", "menubar")) {
            val state = theme(appearance)
            val scene = ImageComposeScene(760, 680) { LabTheme(state) { LabScene(Modifier.fillMaxSize(), {
                Box(Modifier.fillMaxSize().background(state.colors["bg-primary"]))
            }) {
                Box(Modifier.padding(32.dp)) {
                    when (family) {
                        "dropdown" -> LabMenu(dropdown, "Dropdown", heading = "Headline", defaultOpen = true)
                        "context" -> LabContextMenu(context, "Context", defaultOpen = true, defaultCheckedValues = listOf("o1", "o2", "r1")) { LabText("Context target", it) }
                        else -> LabMenubar(listOf(LabMenubarItem("file", "File", file), LabMenubarItem("edit", "Edit", emptyList()),
                            LabMenubarItem("view", "View", emptyList()), LabMenubarItem("profiles", "Profiles", emptyList())), defaultValue = "file")
                    }
                }
            } } }
            try {
                settle(scene)
                if (family == "context") { named(scene, "Team").config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene) }
                val panel = nodes(scene).single { it.config.getOrNull(SemanticsProperties.PaneTitle) == if (family == "dropdown") "Dropdown" else if (family == "context") "Context" else "File" }
                if (family == "dropdown") assertEquals(IntSize(256, 386), panel.size)
                if (family == "menubar") {
                    val bar = named(scene, "Menu bar").boundsInRoot
                    assertEquals(bar.left, panel.boundsInRoot.left)
                    assertEquals(bar.bottom + 4, panel.boundsInRoot.top)
                }
                output.resolve("source-$family-${appearance.name.lowercase()}.png").writeBytes(settle(scene))
            } finally { scene.close() }
        }
    }
    @Test fun closedMenubarPaintsKeyboardFocus() {
        val scene = ImageComposeScene(500, 180) { LabTheme(theme()) { LabScene(Modifier.fillMaxSize(), {}) {
            Box(Modifier.padding(24.dp)) { LabMenubar(listOf(LabMenubarItem("file", "File", emptyList()), LabMenubarItem("edit", "Edit", emptyList()))) }
        } } }
        try {
            val before = settle(scene)
            named(scene, "File").config[SemanticsActions.RequestFocus].action!!.invoke()
            val focused = settle(scene)
            assertTrue(named(scene, "File").config[SemanticsProperties.Focused])
            assertFalse(before.contentEquals(focused), "Keyboard focus must change the rendered closed control")
            File("build/menu-evidence/menubar-keyboard-focus.png").writeBytes(focused)
        } finally { scene.close() }
    }
}
