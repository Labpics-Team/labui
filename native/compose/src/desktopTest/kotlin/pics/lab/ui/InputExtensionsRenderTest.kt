package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerButtons
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.FinishComposingTextCommand
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.SetComposingTextCommand
import androidx.compose.ui.unit.*
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.CompletableDeferred
import java.awt.datatransfer.StringSelection
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*

/** Real editor, popup, clipboard and IME paths without a platform window. */
@OptIn(androidx.compose.ui.InternalComposeUiApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class,
    androidx.compose.foundation.ExperimentalFoundationApi::class)
class InputExtensionsRenderTest {
    private val items = listOf(LabSelectItem("alpha", "Alpha"), LabSelectItem("beta", "Beta", disabled = true),
        LabSelectItem("gamma", "Gamma"), LabSelectItem("delta", "Delta"))
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun field(scene: ImageComposeScene, label: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true &&
            it.config.contains(SemanticsActions.SetText)
    }
    private fun action(scene: ImageComposeScene, label: String) = nodes(scene).single {
        (it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true ||
            it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == label } == true) &&
            it.config.getOrNull(SemanticsActions.OnClick)?.action != null
    }
    private fun isShown(scene: ImageComposeScene, label: String) = nodes(scene).any {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true ||
            it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == label } == true
    }
    private data class Fixture(val scene: ImageComposeScene, val ready: AtomicBoolean)
    private class MemoryClipboard(text: String = "first,second") : Clipboard {
        val native = java.awt.datatransfer.Clipboard("input-extensions-test").apply { setContents(StringSelection(text), null) }
        var reads = 0
        var read: suspend () -> ClipEntry? = { native.getContents(null)?.let(::ClipEntry) }
        @Suppress("DEPRECATION")
        override val nativeClipboard: Any get() = native
        override suspend fun getClipEntry(): ClipEntry? { reads++; return read() }
        override suspend fun setClipEntry(clipEntry: ClipEntry?) { native.setContents(clipEntry?.asAwtTransferable, null) }
    }
    private fun fixture(width: Int = 480, height: Int = 600, scale: Float = 1f,
        appearance: LabAppearance = LabAppearance.Light, content: @Composable () -> Unit): Fixture {
        val ready = AtomicBoolean(false)
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        val theme = LabThemeState(initialLabColors(prefs), prefs)
        val scene = ImageComposeScene(width, height, Density(1f, scale)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) {
                LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) }) {
                    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) { content() }
                }
            }
        }
        return Fixture(scene, ready)
    }
    private fun Fixture.settle(): ByteArray {
        var last: ByteArray? = null
        var stable = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            stable = if (ready.get() && last?.contentEquals(png) == true) stable + 1 else 0
            if (stable >= 4) return png
            last = png; Thread.sleep(10)
        }
        error("Input extensions did not settle")
    }
    private fun Fixture.press(key: Key) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp))
        settle()
    }
    private fun Fixture.pasteKey() {
        scene.sendKeyEvent(KeyEvent(Key.V, KeyEventType.KeyDown, isCtrlPressed = true))
        scene.sendKeyEvent(KeyEvent(Key.V, KeyEventType.KeyUp, isCtrlPressed = true))
        settle()
    }
    private fun Fixture.focus(label: String) {
        assertTrue(field(scene, label).config[SemanticsActions.RequestFocus].action!!.invoke())
        settle()
    }
    private fun Fixture.type(label: String, text: String) {
        assertTrue(field(scene, label).config[SemanticsActions.SetText].action!!.invoke(AnnotatedString(text)))
        settle()
    }

    @Test fun comboboxFiltersOnlyQueryAndKeepsEditorFocusDuringAcceptedAndRejectedRequests() {
        var value by mutableStateOf(emptyList<String>())
        var accept by mutableStateOf(true)
        val requests = mutableListOf<List<String>>()
        val state = TextFieldState()
        val f = fixture { LabCombobox(value, { requests.add(it); if (accept) value = it }, items, "Choice", state = state) }
        try {
            f.settle(); f.focus("Choice"); f.press(Key.DirectionDown)
            assertTrue(nodes(f.scene).any { it.config.getOrNull(SemanticsProperties.Role) == Role.DropdownList })
            assertTrue(field(f.scene, "Choice").config[SemanticsProperties.Focused])
            f.press(Key.DirectionDown); f.press(Key.Enter)
            assertEquals(listOf("gamma"), value, "Disabled Beta is skipped")
            assertEquals("Gamma", state.text.toString())
            action(f.scene, "Показать варианты").config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertTrue(isShown(f.scene, "Alpha"), "Opening does not filter by the selected label")
            f.type("Choice", "Al")
            assertTrue(isShown(f.scene, "Alpha")); assertFalse(isShown(f.scene, "Delta"))
            accept = false; f.settle(); f.press(Key.Enter)
            assertEquals(listOf("alpha"), requests.last())
            assertEquals(listOf("gamma"), value)
            assertEquals("Al", state.text.toString(), "Rejected selection retains the draft")
            assertTrue(field(f.scene, "Choice").config[SemanticsProperties.Focused])
        } finally { f.scene.close() }
    }

    @Test fun tagsUseOnlyAcceptedValuesAndKeepRejectedOrInvalidDraftsEditable() {
        var value by mutableStateOf(listOf("alpha", "beta"))
        var accept by mutableStateOf(true)
        val requests = mutableListOf<List<String>>()
        val state = TextFieldState()
        val f = fixture { LabTagsInput(value, { requests.add(it); if (accept) value = it }, "Tags", state = state, max = 3) }
        try {
            f.settle(); f.focus("Tags"); f.type("Tags", "gamma"); f.press(Key.Enter)
            assertEquals(listOf("alpha", "beta", "gamma"), value); assertEquals("", state.text.toString())
            f.type("Tags", "overflow"); f.press(Key.Enter)
            assertEquals(1, requests.size); assertEquals("overflow", state.text.toString())
            f.type("Tags", ""); f.press(Key.Backspace)
            assertEquals(3, value.size, "First Backspace selects the last chip")
            f.press(Key.Backspace); assertEquals(listOf("alpha", "beta"), value)
            f.press(Key.Enter)
            assertEquals("beta", state.text.toString())
            f.type("Tags", "renamed"); f.press(Key.Enter)
            assertEquals(listOf("alpha", "renamed"), value); assertEquals("", state.text.toString())
            accept = false; f.settle(); f.type("Tags", "rejected"); f.press(Key.Enter)
            assertEquals(listOf("alpha", "renamed"), value); assertEquals("rejected", state.text.toString())
            assertFalse(isShown(f.scene, "Удалить rejected"))
            accept = true; f.settle(); f.type("Tags", "alpha"); f.press(Key.Enter)
            assertEquals(listOf("alpha", "renamed"), value)
            assertTrue(isShown(f.scene, "Такая метка уже добавлена"))
        } finally { f.scene.close() }
    }

    @Test fun pasteConsumesOnlyCompletedEditorTransactionsAndKeepsUndo() {
        var value by mutableStateOf(emptyList<String>())
        var addOnPaste by mutableStateOf(false)
        val state = TextFieldState()
        val clipboard = MemoryClipboard()
        val f = fixture {
            CompositionLocalProvider(LocalClipboard provides clipboard) {
                LabTagsInput(value, { value = it }, "Tags", state = state, addOnPaste = addOnPaste)
            }
        }
        try {
            f.settle(); f.focus("Tags")
            assertTrue(field(f.scene, "Tags").config[SemanticsActions.PasteText].action!!.invoke()); f.settle()
            assertEquals(emptyList(), value); assertEquals("first,second", state.text.toString())
            state.undoState.undo(); f.settle(); assertEquals("", state.text.toString())
            state.undoState.redo(); f.settle(); assertEquals("first,second", state.text.toString())
            f.type("Tags", ""); addOnPaste = true; f.settle()
            f.pasteKey()
            assertEquals(listOf("first", "second"), value); assertEquals("", state.text.toString())
            assertEquals(2, clipboard.reads, "One native read and one insertion per paste")
            value = emptyList()
            state.edit { replace(0, length, "first,second"); selection = TextRange(0, length) }
            f.settle(); f.pasteKey()
            assertEquals(listOf("first", "second"), value, "Same-text replacement still has an explicit paste result")
            assertEquals("", state.text.toString()); assertEquals(3, clipboard.reads)
        } finally { f.scene.close() }
    }

    @Test fun openingTheNativeContextMenuDoesNotReadOrInsertClipboardContent() {
        val state = TextFieldState("draft")
        val clipboard = MemoryClipboard("pasted")
        val f = fixture {
            CompositionLocalProvider(LocalClipboard provides clipboard) { LabTagsInput(emptyList(), {}, "Tags", state = state) }
        }
        try {
            f.settle(); f.focus("Tags")
            val location = field(f.scene, "Tags").boundsInRoot.center
            f.scene.sendPointerEvent(PointerEventType.Press, location, buttons = PointerButtons(isSecondaryPressed = true))
            f.scene.sendPointerEvent(PointerEventType.Release, location, buttons = PointerButtons()); f.settle()
            assertEquals(0, clipboard.reads)
            assertEquals("draft", state.text.toString())
            val paste = nodes(f.scene).single { node ->
                node.config.getOrNull(SemanticsProperties.Text)?.any { it.text in listOf("Paste", "Вставить") } == true &&
                    node.config.getOrNull(SemanticsActions.OnClick)?.action != null
            }
            paste.config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertEquals(1, clipboard.reads)
            assertTrue(state.text.toString().contains("pasted"))
        } finally { f.scene.close() }
    }

    @Test fun pendingPasteCannotOutliveItsFocusSelectionDraftOrComponent() {
        for (change in listOf("focus", "selection", "text", "disabled", "dispose", "cancel", "error", "empty", "mime")) {
            val state = TextFieldState("draft")
            var shown by mutableStateOf(true)
            var enabled by mutableStateOf(true)
            val changes = mutableListOf<List<String>>()
            val pending = CompletableDeferred<ClipEntry?>()
            val clipboard = MemoryClipboard().apply { read = { pending.await() } }
            val f = fixture {
                CompositionLocalProvider(LocalClipboard provides clipboard) {
                    if (shown) LabTagsInput(emptyList(), { changes.add(it) }, "Tags", state = state, enabled = enabled, addOnPaste = true)
                    LabInput(remember { TextFieldState() }, "Other")
                }
            }
            try {
                f.settle(); f.focus("Tags")
                assertTrue(field(f.scene, "Tags").config[SemanticsActions.PasteText].action!!.invoke()); f.settle()
                assertEquals(1, clipboard.reads)
                when (change) {
                    "focus" -> { f.focus("Other"); f.focus("Tags") }
                    "selection" -> { state.edit { selection = TextRange(0, 1) }; f.settle() }
                    "text" -> f.type("Tags", "new draft")
                    "disabled" -> { enabled = false; f.settle(); enabled = true; f.settle(); f.focus("Tags") }
                    "dispose" -> { shown = false; f.settle() }
                }
                val expected = state.text.toString()
                when (change) {
                    "cancel" -> pending.cancel()
                    "error" -> pending.completeExceptionally(java.io.IOException("unavailable"))
                    "empty" -> pending.complete(null)
                    "mime" -> pending.complete(ClipEntry(object : java.awt.datatransfer.Transferable {
                        override fun getTransferDataFlavors() = emptyArray<java.awt.datatransfer.DataFlavor>()
                        override fun isDataFlavorSupported(flavor: java.awt.datatransfer.DataFlavor?) = false
                        override fun getTransferData(flavor: java.awt.datatransfer.DataFlavor?): Any = error("Not text")
                    }))
                    else -> pending.complete(ClipEntry(StringSelection("first,second")))
                }
                f.settle()
                assertEquals(expected, state.text.toString(), change)
                assertTrue(changes.isEmpty(), change)
                if (shown) { f.type("Tags", "ordinary"); assertTrue(changes.isEmpty(), "No stale paste receipt after $change") }
            } finally { f.scene.close() }
        }
    }

    @Test fun overlappingPasteRequestsApplyOnlyTheLatestAndReplaceTheCapturedSelection() {
        val state = TextFieldState("prefix suffix")
        val first = CompletableDeferred<ClipEntry?>()
        val second = CompletableDeferred<ClipEntry?>()
        val clipboard = MemoryClipboard().apply { read = { if (reads == 1) first.await() else second.await() } }
        val f = fixture {
            CompositionLocalProvider(LocalClipboard provides clipboard) { LabTagsInput(emptyList(), {}, "Tags", state = state) }
        }
        try {
            f.settle(); f.focus("Tags"); state.edit { selection = TextRange(7, 13) }; f.settle()
            repeat(2) { field(f.scene, "Tags").config[SemanticsActions.PasteText].action!!.invoke(); f.settle() }
            second.complete(ClipEntry(StringSelection("new"))); f.settle()
            first.complete(ClipEntry(StringSelection("old"))); f.settle()
            assertEquals("prefix new", state.text.toString()); assertEquals(TextRange(10), state.selection)
            state.undoState.undo(); f.settle()
            assertEquals("prefix suffix", state.text.toString()); assertEquals(TextRange(7, 13), state.selection)
            state.undoState.redo(); f.settle(); assertEquals("prefix new", state.text.toString())
        } finally { f.scene.close() }
    }

    @Test fun compositionSurvivesRecompositionAndItsCommitDoesNotSelectOrCreateValues() {
        for (tags in listOf(false, true)) {
            val state = TextFieldState()
            var size by mutableStateOf(LabControlSize.Small)
            var input: PlatformTextInputMethodRequest? = null
            val changes = mutableListOf<List<String>>()
            val f = fixture {
                InterceptPlatformTextInput({ request, _ -> input = request; awaitCancellation() }) {
                    if (tags) LabTagsInput(emptyList(), { changes.add(it) }, "Field", state = state, size = size, addOnPaste = true)
                    else LabCombobox(emptyList(), { changes.add(it) }, items, "Field", state = state, size = size)
                }
            }
            try {
                f.settle(); f.focus("Field")
                val ime = checkNotNull(input)
                ime.onEditCommand(listOf(SetComposingTextCommand(if (tags) "東京," else "Ga", 1))); f.settle()
                val composing = state.composition
                assertNotNull(composing)
                size = LabControlSize.Large; f.settle()
                assertEquals(composing, state.composition)
                ime.onEditCommand(listOf(FinishComposingTextCommand()))
                f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyDown))
                f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyUp)); f.settle()
                assertTrue(changes.isEmpty(), "IME completion must not commit a choice or a tag")
                assertEquals(if (tags) "東京," else "Ga", state.text.toString())
                assertEquals(null, state.composition)
                checkNotNull(ime.onImeAction).invoke(ImeAction.Done); f.settle()
                assertEquals(listOf(if (tags) listOf("東京,") else listOf("gamma")), changes,
                    "A later explicit soft keyboard action commits the current draft")
            } finally { f.scene.close() }
        }
    }

    @Test fun multipleComboboxKeepsSelectionControlledAndScrollsActiveOptionInsideViewport() {
        val many = (1..30).map { LabSelectItem("item$it", "Option $it", disabled = it == 29) }
        var value by mutableStateOf(listOf("item1"))
        var accept by mutableStateOf(false)
        val requests = mutableListOf<List<String>>()
        val f = fixture(width = 320, height = 300) {
            LabCombobox(value, { requests.add(it); if (accept) value = it }, many, "Many", multiple = true)
        }
        try {
            f.settle(); f.focus("Many"); f.press(Key.DirectionDown); f.press(Key.MoveEnd)
            val last = action(f.scene, "Option 30")
            assertTrue(last.boundsInWindow.top >= 0 && last.boundsInWindow.bottom <= 300,
                "Keyboard active option is scrolled into the available viewport")
            File("build/input-extension-evidence").apply { mkdirs() }.resolve("combobox-open-scrolled.png").writeBytes(f.settle())
            f.press(Key.Enter)
            assertEquals(listOf("item1", "item30"), requests.last()); assertEquals(listOf("item1"), value)
            accept = true; f.settle(); f.press(Key.Enter)
            assertEquals(listOf("item1", "item30"), value)
            f.press(Key.Escape)
            action(f.scene, "Удалить Option 1").config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertEquals(listOf("item30"), value)
            assertTrue(field(f.scene, "Many").config[SemanticsProperties.Focused])
        } finally { f.scene.close() }
    }

    @Test fun tagEditingCannotOverwriteAnExternallyReplacedItemAndRtlNavigationIsLogical() {
        var value by mutableStateOf(listOf("first", "second"))
        val changes = mutableListOf<List<String>>()
        val state = TextFieldState()
        val f = fixture {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                LabTagsInput(value, { changes.add(it); value = it }, "Tags", state = state)
            }
        }
        try {
            f.settle(); f.focus("Tags"); f.press(Key.DirectionRight); f.press(Key.Enter)
            assertEquals("second", state.text.toString())
            value = listOf("first", "replacement"); f.settle()
            f.type("Tags", "changed"); f.press(Key.Enter)
            assertEquals(emptyList(), changes)
            assertEquals(listOf("first", "replacement"), value)
            assertEquals("changed", state.text.toString())
            f.press(Key.Escape); f.type("Tags", "third,")
            assertEquals(listOf("first", "replacement", "third"), value)
            assertEquals("", state.text.toString())
        } finally { f.scene.close() }
    }

    @Test fun disabledAndReadOnlyControlsCannotChangeValuesThroughTheirActions() {
        for (disabled in listOf(false, true)) {
            val changes = mutableListOf<List<String>>()
            val combo = TextFieldState()
            val tags = TextFieldState()
            val f = fixture {
                LabCombobox(listOf("alpha"), { changes.add(it) }, items, "Choice", state = combo,
                    enabled = !disabled, readOnly = !disabled, multiple = true)
                LabTagsInput(listOf("existing"), { changes.add(it) }, "Tags", state = tags,
                    enabled = !disabled, readOnly = !disabled)
            }
            try {
                f.settle()
                val labels = if (disabled) listOf("Показать варианты", "Удалить Alpha", "Удалить existing") else listOf("Показать варианты")
                for (label in labels)
                    action(f.scene, label).config[SemanticsActions.OnClick].action!!.invoke()
                if (!disabled) {
                    for (label in listOf("Alpha", "existing")) {
                        val chip = nodes(f.scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true }
                        assertNotEquals(Role.Button, chip.config.getOrNull(SemanticsProperties.Role),
                            "Read-only tags merge into the readable editor without a removal button")
                        assertFalse(chip.config.contains(SemanticsProperties.Disabled))
                    }
                }
                f.settle()
                assertTrue(changes.isEmpty())
                assertFalse(nodes(f.scene).any { it.config.getOrNull(SemanticsProperties.Role) == Role.DropdownList })
            } finally { f.scene.close() }
        }
    }

    @Test fun authoredFieldsAndGrowingChipsRenderAtBothThemesAndTextScales() {
        val output = File("build/input-extension-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val f = fixture(width = 390, height = 950, scale = scale, appearance = appearance) {
                LabCombobox(listOf("alpha"), {}, items, "Выбор пространства", size = LabControlSize.Small, helper = "Можно искать по названию")
                LabCombobox(listOf("alpha", "gamma"), {}, items, "Участники", multiple = true, size = LabControlSize.Medium)
                LabTagsInput(listOf("Дизайн", "Исследования", "Длинная метка проекта"), {}, "Метки пространства",
                    size = LabControlSize.Large, helper = "Enter добавляет метку")
                LabTagsInput(listOf("Только чтение"), {}, "Архив", readOnly = true)
            }
            try { output.resolve("fields-${appearance.name}-$scale.png").writeBytes(f.settle()) }
            finally { f.scene.close() }
        }
    }
}
