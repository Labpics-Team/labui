package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.*
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.FinishComposingTextCommand
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.SetComposingTextCommand
import androidx.compose.ui.unit.*
import kotlinx.coroutines.awaitCancellation
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*

/** The actual Foundation editor/IME and Skia layout, with no window or AT client. */
@OptIn(androidx.compose.ui.InternalComposeUiApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class)
class NumberInputRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun field(scene: ImageComposeScene, label: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true
    }
    private fun button(scene: ImageComposeScene, label: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true &&
            it.config.getOrNull(SemanticsProperties.Role) == Role.Button
    }
    private data class Fixture(val scene: ImageComposeScene, val ready: AtomicBoolean)
    private fun fixture(scale: Float = 1f, appearance: LabAppearance = LabAppearance.Light,
        height: Int = 600, content: @Composable () -> Unit): Fixture {
        val ready = AtomicBoolean(false)
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        val theme = LabThemeState(initialLabColors(prefs), prefs)
        return Fixture(ImageComposeScene(390, height, Density(1f, scale)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) {
                LabScene(Modifier.fillMaxSize(), background = {
                    Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]))
                }) {
                    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) { content() }
                }
            }
        }, ready)
    }
    private fun Fixture.settle(): ByteArray {
        var previous: ByteArray? = null
        var stable = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            stable = if (ready.get() && previous?.contentEquals(png) == true) stable + 1 else 0
            if (stable >= 4) return png
            previous = png
            Thread.sleep(10)
        }
        error("Number Input did not settle")
    }
    private fun Fixture.focus(label: String) {
        assertTrue(field(scene, label).config[SemanticsActions.RequestFocus].action!!.invoke())
        settle()
    }
    private fun Fixture.type(text: String, label: String = "Number") {
        assertTrue(field(scene, label).config[SemanticsActions.SetText].action!!.invoke(AnnotatedString(text)))
        settle()
    }
    private fun Fixture.press(key: Key, shift: Boolean = false) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown, isShiftPressed = shift))
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp, isShiftPressed = shift))
        settle()
    }
    private fun Fixture.click(label: String) {
        button(scene, label).config[SemanticsActions.OnClick].action!!.invoke()
        settle()
    }

    @Test fun keyboardAndButtonsStepExactlyAndCommitOnlyOnEnterOrBlur() {
        val state = TextFieldState("0.1")
        val f = fixture {
            LabNumberInput(state, "Number", min = -2.0, max = 2.0, step = 0.1)
            LabInput(remember { TextFieldState() }, "Next")
        }
        try {
            f.settle(); f.focus("Number"); f.press(Key.DirectionUp)
            assertEquals("0.2", state.text.toString())
            f.press(Key.PageUp); assertEquals("1.2", state.text.toString())
            f.click("Уменьшить значение"); assertEquals("1.1", state.text.toString())
            assertTrue(field(f.scene, "Number").config[SemanticsProperties.Focused])
            f.press(Key.PageDown); assertEquals("0.1", state.text.toString())
            f.type("9.50"); assertEquals("9.50", state.text.toString())
            f.press(Key.Enter); assertEquals("2", state.text.toString())
            assertTrue(button(f.scene, "Увеличить значение").config.contains(SemanticsProperties.Disabled))
            f.type("-9.50"); f.press(Key.Tab)
            assertEquals("-2", state.text.toString())
            assertTrue(field(f.scene, "Next").config[SemanticsProperties.Focused], "Accessory buttons do not add Tab stops")
            f.focus("Number"); f.type(""); f.press(Key.Enter)
            assertEquals("", state.text.toString())
            f.click("Увеличить значение"); assertEquals("0", state.text.toString())
        } finally { f.scene.close() }
    }

    @Test fun invalidDraftsAndFormErrorsRemainVisibleUntilTheApplicationClearsThem() {
        val state = TextFieldState()
        var externalError by mutableStateOf<String?>("Число не подтверждено")
        val f = fixture { LabNumberInput(state, "Number", step = 0.1, helper = "Подсказка", error = externalError) }
        try {
            f.settle(); f.focus("Number"); f.type("-"); f.press(Key.Enter)
            assertEquals("-", state.text.toString())
            assertEquals("Число не подтверждено", field(f.scene, "Number").config[SemanticsProperties.Error])
            f.click("Увеличить значение"); assertEquals("-", state.text.toString())
            externalError = null; f.settle()
            assertEquals("Введите конечное число", field(f.scene, "Number").config[SemanticsProperties.Error])
            f.type(".5")
            assertFalse(field(f.scene, "Number").config.contains(SemanticsProperties.Error))
            f.press(Key.Enter); assertEquals("0.5", state.text.toString())
            externalError = "Сервер отклонил число"; f.settle(); f.press(Key.DirectionUp)
            assertEquals("0.6", state.text.toString())
            assertEquals("Сервер отклонил число", field(f.scene, "Number").config[SemanticsProperties.Error])
        } finally { f.scene.close() }
    }

    @Test fun compositionAndItsEnterKeepTheDraftAndSelectionAcrossRecomposition() {
        val state = TextFieldState()
        var size by mutableStateOf(LabControlSize.Small)
        var input: PlatformTextInputMethodRequest? = null
        val f = fixture {
            InterceptPlatformTextInput({ request, _ -> input = request; awaitCancellation() }) {
                LabNumberInput(state, "Number", max = 2.0, size = size)
                LabInput(remember { TextFieldState() }, "Next")
            }
        }
        try {
            f.settle(); f.focus("Number")
            val ime = checkNotNull(input)
            ime.onEditCommand(listOf(SetComposingTextCommand("9.50", 1))); f.settle()
            val composition = assertNotNull(state.composition)
            f.press(Key.DirectionUp)
            assertEquals("9.50", state.text.toString()); assertEquals(composition, state.composition)
            val selection = state.selection
            size = LabControlSize.Large; f.settle()
            assertEquals(composition, state.composition); assertEquals(selection, state.selection)
            ime.onEditCommand(listOf(FinishComposingTextCommand()))
            f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyDown))
            f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyUp)); f.settle()
            assertEquals("9.50", state.text.toString(), "The Enter that completes IME composition is not a numeric commit")
            assertNull(state.composition)
            assertFalse(button(f.scene, "Уменьшить значение").config.contains(SemanticsProperties.Disabled),
                "Buttons become usable after the finishing composition frame")
            f.press(Key.Enter); assertEquals("2", state.text.toString())
        } finally { f.scene.close() }
    }

    @Test fun blurCommitsAfterCompositionHasFinishedWithoutDiscardingItsDraft() {
        val state = TextFieldState()
        var input: PlatformTextInputMethodRequest? = null
        val f = fixture {
            InterceptPlatformTextInput({ request, _ -> input = request; awaitCancellation() }) {
                LabNumberInput(state, "Number", max = 2.0)
                LabInput(remember { TextFieldState() }, "Next")
            }
        }
        try {
            f.settle(); f.focus("Number")
            val ime = checkNotNull(input)
            ime.onEditCommand(listOf(SetComposingTextCommand("9.50", 1))); f.settle()
            f.focus("Next")
            if (state.composition != null) {
                assertEquals("9.50", state.text.toString(), "Active composition cannot be rewritten on blur")
                ime.onEditCommand(listOf(FinishComposingTextCommand())); f.settle()
            }
            assertEquals("2", state.text.toString())
            assertTrue(field(f.scene, "Next").config[SemanticsProperties.Focused])
        } finally { f.scene.close() }
    }

    @Test fun softwareKeyboardDoneCommitsThroughTheRealPlatformRequest() {
        val state = TextFieldState("9.50")
        var input: PlatformTextInputMethodRequest? = null
        val f = fixture {
            InterceptPlatformTextInput({ request, _ -> input = request; awaitCancellation() }) {
                LabNumberInput(state, "Number", max = 2.0)
            }
        }
        try {
            f.settle(); f.focus("Number")
            checkNotNull(checkNotNull(input).onImeAction).invoke(ImeAction.Done); f.settle()
            assertEquals("2", state.text.toString())
        } finally { f.scene.close() }
    }

    @Test fun externalStateReplacementAndEditsRemainAuthoritative() {
        var state by mutableStateOf(TextFieldState("1.2"))
        val f = fixture { LabNumberInput(state, "Number", step = 0.1) }
        try {
            f.settle(); f.focus("Number")
            state.edit { selection = TextRange(0, 1) }; f.settle()
            assertEquals(TextRange(0, 1), state.selection)
            state.setTextAndPlaceCursorAtEnd("7.5"); f.settle()
            f.press(Key.DirectionUp); assertEquals("7.6", state.text.toString())
            state = TextFieldState("2.5"); f.settle()
            f.focus("Number"); f.click("Увеличить значение")
            assertEquals("2.6", state.text.toString())
            f.press(Key.DirectionUp, shift = true)
            assertEquals("2.6", state.text.toString(), "Selection shortcuts are left to the editor")
        } finally { f.scene.close() }
    }

    @Test fun readOnlyDisabledAndUnrepresentableStepsNeverMutateTheValue() {
        for (disabled in listOf(false, true)) {
            val state = TextFieldState("9.50")
            val f = fixture { LabNumberInput(state, "Number", enabled = !disabled, readOnly = !disabled, max = 2.0) }
            try {
                f.settle()
                for (label in listOf("Уменьшить значение", "Увеличить значение")) {
                    assertTrue(button(f.scene, label).config.contains(SemanticsProperties.Disabled))
                    f.click(label)
                }
                if (!disabled) { f.focus("Number"); f.press(Key.Enter); f.press(Key.DirectionUp) }
                assertEquals("9.50", state.text.toString())
                assertTrue(field(f.scene, "Number").config.getOrNull(SemanticsActions.CustomActions).isNullOrEmpty())
            } finally { f.scene.close() }
        }
        val state = TextFieldState("1e20")
        val f = fixture { LabNumberInput(state, "Number", step = 0.1) }
        try {
            f.settle(); f.focus("Number"); f.press(Key.DirectionUp)
            assertEquals("1e20", state.text.toString())
            assertTrue(button(f.scene, "Увеличить значение").config.contains(SemanticsProperties.Disabled))
        } finally { f.scene.close() }
    }

    @Test fun authoredGeometryAndFormStatesRenderAtBothThemesAndTextScales() {
        val output = File("build/number-input-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val numberHeights = mutableMapOf<LabControlSize, Int>()
            val inputHeights = mutableMapOf<LabControlSize, Int>()
            val f = fixture(scale, appearance, height = 1250) {
                for (size in LabControlSize.entries) {
                    val label = "Сумма ${size.name}"
                    LabNumberInput(remember { TextFieldState("1250.5") }, label,
                        Modifier.onGloballyPositioned { numberHeights[size] = it.size.height }, size = size, step = 0.1)
                    LabInput(remember { TextFieldState("1250.5") }, label,
                        Modifier.onGloballyPositioned { inputHeights[size] = it.size.height }, size = size)
                }
                LabNumberInput(remember { TextFieldState("-") }, "Количество участников пространства",
                    error = "Введите число от 1 до 20", min = 1.0, max = 20.0)
                LabNumberInput(remember { TextFieldState("10") }, "Только чтение", readOnly = true)
                LabNumberInput(remember { TextFieldState("10") }, "Недоступно", enabled = false)
            }
            try {
                output.resolve("fields-${appearance.name}-$scale.png").writeBytes(f.settle())
                assertEquals(inputHeights, numberHeights, "Step buttons preserve the complete Input S/M/L geometry at $scale")
                if (scale == 1f) assertEquals(mapOf(LabControlSize.Small to 44, LabControlSize.Medium to 56,
                    LabControlSize.Large to 64), numberHeights)
            } finally { f.scene.close() }
        }
    }
}
