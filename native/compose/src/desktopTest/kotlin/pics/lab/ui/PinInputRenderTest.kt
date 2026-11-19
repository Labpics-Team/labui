package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.InterceptPlatformTextInput
import androidx.compose.ui.platform.PlatformTextInputMethodRequest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.FinishComposingTextCommand
import androidx.compose.ui.text.input.SetComposingTextCommand
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.awaitCancellation

/** Headless CPU rendering exercises the real native text editor and its semantics. */
class PinInputRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun editor(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        .single { it.config.getOrNull(SemanticsProperties.EditableText) != null }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 3) return png
            previous = png
            Thread.sleep(10)
        }
        error("Pin Input did not settle")
    }
    private fun theme(appearance: LabAppearance): LabThemeState {
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(prefs), prefs)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun nativeEditorAcceptsPasteRejectsInvalidAndTruncatesChangedCount() {
        val state = TextFieldState()
        var count by mutableStateOf(6)
        var readonly by mutableStateOf(false)
        val scene = ImageComposeScene(420, 110) { LabTheme(theme(LabAppearance.Light)) {
            LabPinInput(state, "Код подтверждения", count = count, readOnly = readonly)
        } }
        try {
            settle(scene)
            val editor = editor(scene)
            assertEquals(listOf("Код подтверждения"), editor.config[SemanticsProperties.ContentDescription])
            assertEquals(348f, editor.boundsInRoot.width)
            assertEquals(56f, editor.boundsInRoot.height)
            editor.config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("123456")); settle(scene)
            assertEquals("123456", state.text.toString())
            editor(scene).config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("12x")); settle(scene)
            assertEquals("123456", state.text.toString())
            editor(scene).config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
            fun press(key: Key) {
                scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
                scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene)
            }
            press(Key.DirectionLeft); press(Key.Backspace)
            assertEquals("12346", state.text.toString())
            state.setTextAndPlaceCursorAtEnd("123456"); settle(scene)
            count = 4; settle(scene); assertEquals("1234", state.text.toString())
            state.setTextAndPlaceCursorAtEnd(""); settle(scene); assertEquals("", state.text.toString())
            readonly = true; settle(scene)
            assertTrue(editor(scene).config.getOrNull(SemanticsProperties.IsEditable) == false)
        } finally { scene.close() }
    }
    @Test fun secureNativeEditorExposesPasswordSemanticsAndBlocksCopy() {
        val state = TextFieldState("12")
        val scene = ImageComposeScene(300, 110) { LabTheme(theme(LabAppearance.Light)) {
            LabPinInput(state, "PIN", mask = true)
        } }
        try {
            settle(scene)
            val node = editor(scene)
            assertTrue(node.config.contains(SemanticsProperties.Password))
            assertTrue(node.config.getOrNull(SemanticsActions.CopyText) == null)
        } finally { scene.close() }
    }
    @Test fun programmaticEditsAndReplacementStateCannotRetainAnInvisibleSuffix() {
        var state by mutableStateOf(TextFieldState("12"))
        var count by mutableStateOf(4)
        val scene = ImageComposeScene(420, 110) { LabTheme(theme(LabAppearance.Light)) {
            LabPinInput(state, "PIN", count = count)
        } }
        try {
            settle(scene)
            fun assertEditor(text: String, selection: TextRange) {
                settle(scene)
                assertEquals(text, state.text.toString())
                assertEquals(text, editor(scene).config[SemanticsProperties.EditableText].text)
                assertEquals(selection, state.selection)
            }
            state.setTextAndPlaceCursorAtEnd("123456")
            assertEditor("1234", TextRange(4))
            state.edit { replace(0, length, "987654"); selection = TextRange(3, 1) }
            assertEditor("9876", TextRange(3, 1))
            state.edit { append("54"); selection = TextRange(6, 2) }
            assertEditor("9876", TextRange(4, 2))
            state.setTextAndPlaceCursorAtEnd("")
            assertEditor("", TextRange(0))
            val detached = state
            state = TextFieldState("123456", TextRange(5, 1))
            assertEditor("1234", TextRange(4, 1))
            detached.setTextAndPlaceCursorAtEnd("654321")
            assertEditor("1234", TextRange(4, 1))
            assertEquals("654321", detached.text.toString(), "The detached state is no longer constrained")
            val bounds = editor(scene).boundsInRoot
            val firstCell = Offset(bounds.left + 24, bounds.top + 28)
            scene.sendPointerEvent(PointerEventType.Press, firstCell)
            scene.sendPointerEvent(PointerEventType.Release, firstCell)
            assertEditor("1234", TextRange(0))
            assertEquals(TextRange(6), detached.selection, "Cell taps must target the replacement state")
            state.edit { selection = TextRange(4, 1) }
            count = 2
            assertEditor("12", TextRange(2, 1))
            count = 6
            state.setTextAndPlaceCursorAtEnd("987654")
            assertEditor("987654", TextRange(6))
            assertTrue(!scene.hasInvalidations(), "The state observer must not schedule idle frames")
        } finally { scene.close() }
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun nativeSelectionPaintsForwardAndReversedRangesAndKeyboardReplacesThem() {
        val output = File("build/pin-input-evidence").apply { mkdirs() }
        for (masked in listOf(false, true)) {
            val state = TextFieldState("1234")
            val selectionColors = TextSelectionColors(Color(0xff0055cc), Color(0xffbed7fc))
            val theme = theme(LabAppearance.Light)
            val scene = ImageComposeScene(290, 104) { LabTheme(theme) {
                CompositionLocalProvider(LocalTextSelectionColors provides selectionColors) {
                    Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp)) {
                        LabPinInput(state, "PIN", mask = masked, labelHidden = true)
                    }
                }
            } }
            try {
                settle(scene)
                editor(scene).config[SemanticsActions.RequestFocus].action!!.invoke()
                fun select(range: TextRange): ByteArray {
                    assertTrue(editor(scene).config[SemanticsActions.SetSelection].action!!.invoke(range.start, range.end, false))
                    return settle(scene)
                }
                val caret = select(TextRange(4))
                assertTrue(!caret.contentEquals(select(TextRange(3))), "The caret before and after the final character must differ")
                val all = select(TextRange(0, 4))
                assertTrue(!caret.contentEquals(all), "Selected code must differ visibly from a caret")
                val partial = select(TextRange(1, 3))
                assertTrue(partial.contentEquals(select(TextRange(3, 1))), "Range direction must not change the highlighted cells")
                val image = ImageIO.read(partial.inputStream())
                for (index in 0..3) {
                    val selected = image.getRGB(48 + index * 60, 36) == selectionColors.backgroundColor.toArgb()
                    assertEquals(index == 1 || index == 2, selected, "Only the selected cells use shared selection colors")
                }
                val mode = if (masked) "masked" else "visible"
                File(output, "native-selection-$mode-caret.png").writeBytes(caret)
                File(output, "native-selection-$mode-all.png").writeBytes(all)
                File(output, "native-selection-$mode-partial.png").writeBytes(partial)
                scene.sendKeyEvent(KeyEvent(Key.Nine, KeyEventType.KeyDown, codePoint = '9'.code,
                    nativeEvent = java.awt.event.KeyEvent(java.awt.Canvas(), java.awt.event.KeyEvent.KEY_TYPED,
                        System.currentTimeMillis(), 0, java.awt.event.KeyEvent.VK_UNDEFINED, '9')))
                settle(scene)
                assertEquals("194", state.text.toString(), "The real native editor replaces the reversed selection")
                assertEquals(TextRange(2), state.selection)
                assertTrue(!scene.hasInvalidations(), "Focused decoration must not animate while idle")
            } finally { scene.close() }
        }
    }
    @OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
    @Test fun validImeCompositionSurvivesLengthObservationAndCountChanges() {
        val state = TextFieldState("12")
        var count by mutableStateOf(4)
        var request: PlatformTextInputMethodRequest? = null
        val scene = ImageComposeScene(420, 110) {
            InterceptPlatformTextInput({ input, _ -> request = input; awaitCancellation() }) {
                LabTheme(theme(LabAppearance.Light)) { LabPinInput(state, "PIN", count = count) }
            }
        }
        try {
            settle(scene)
            editor(scene).config[SemanticsActions.RequestFocus].action!!.invoke()
            settle(scene)
            val input = checkNotNull(request) { "The native input method must start" }
            input.onEditCommand(listOf(SetComposingTextCommand("3", 1)))
            settle(scene)
            assertEquals("123", state.text.toString())
            assertEquals(TextRange(2, 3), state.composition)
            count = 6
            settle(scene)
            assertEquals(TextRange(2, 3), state.composition)
            input.onEditCommand(listOf(SetComposingTextCommand("34", 1)))
            settle(scene)
            assertEquals("1234", state.text.toString())
            assertEquals(TextRange(2, 4), state.composition)
            input.onEditCommand(listOf(FinishComposingTextCommand()))
            settle(scene)
            assertEquals("1234", state.text.toString())
            assertEquals(null, state.composition)
        } finally { scene.close() }
    }
    @Test fun hoverPaintBelongsOnlyToThePointedCell() {
        val scene = ImageComposeScene(300, 110) { LabTheme(theme(LabAppearance.Light)) {
            Box(Modifier.padding(24.dp)) { LabPinInput(TextFieldState(), "PIN", mask = true, labelHidden = true) }
        } }
        try {
            settle(scene)
            scene.sendPointerEvent(PointerEventType.Move, Offset(168f, 50f))
            val image = ImageIO.read(settle(scene).inputStream())
            assertTrue(image.getRGB(168, 36) != image.getRGB(48, 36))
            assertEquals(image.getRGB(48, 36), image.getRGB(108, 36))
        } finally { scene.close() }
    }
    @Test fun authoredCellsRenderBothThemesAtThreeScalesWithoutIdleFrames() {
        System.getProperty("uiVersion")?.let { version ->
            val location = LabPinValueType::class.java.protectionDomain.codeSource.location.toString()
            assertTrue(location.endsWith(".jar") && location.contains(version), location)
        }
        val output = File("build/pin-input-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val theme = theme(appearance)
            val scene = ImageComposeScene((430 * scale).toInt(), (310 * scale).toInt(), Density(scale)) {
                LabTheme(theme) { Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    LabPinInput(TextFieldState("12"), "PIN", mask = true, labelHidden = true)
                    LabPinInput(TextFieldState("123456"), "Код подтверждения", count = 6)
                    LabPinInput(TextFieldState("12"), "Ошибка", mask = true, error = "Проверьте код")
                } }
            }
            try {
                File(output, "native-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(settle(scene))
                assertTrue(!scene.hasInvalidations(), "An idle PIN must not schedule frames")
            } finally { scene.close() }
        }
    }
}
