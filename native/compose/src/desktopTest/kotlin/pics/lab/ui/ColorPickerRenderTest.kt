@file:OptIn(androidx.compose.ui.InternalComposeUiApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class)
@file:Suppress("DEPRECATION")

package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.ClipboardManager
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.InterceptPlatformTextInput
import androidx.compose.ui.platform.PlatformTextInputMethodRequest
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.SetComposingTextCommand
import androidx.compose.ui.text.input.SetSelectionCommand
import androidx.compose.ui.text.input.FinishComposingTextCommand
import androidx.compose.ui.unit.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*

class ColorPickerRenderTest {
    private fun theme(appearance: LabAppearance = LabAppearance.Light) = LabPreferences(appearance = appearance, reducedMotion = true).let { LabThemeState(initialLabColors(it), it) }
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun named(scene: ImageComposeScene, name: String): SemanticsNode = nodes(scene).first { name in (it.config.getOrNull(SemanticsProperties.ContentDescription) ?: emptyList()) }
    private fun click(scene: ImageComposeScene, name: String) { assertTrue(named(scene,name).config[SemanticsActions.OnClick].action!!.invoke()) }
    private fun focus(scene: ImageComposeScene, name: String) { assertTrue(named(scene,name).config[SemanticsActions.RequestFocus].action!!.invoke()); settle(scene) }
    private fun type(scene: ImageComposeScene, name: String, text: String) { assertTrue(named(scene,name).config[SemanticsActions.SetText].action!!.invoke(AnnotatedString(text))); settle(scene) }
    private fun text(scene: ImageComposeScene, name: String) = named(scene,name).config[SemanticsProperties.EditableText].text
    private fun press(scene: ImageComposeScene, key: Key) { scene.sendKeyEvent(KeyEvent(key,KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(key,KeyEventType.KeyUp)); settle(scene) }
    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null; var equal = 0
        repeat(200) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equal = if (ready() && previous?.contentEquals(bytes) == true) equal + 1 else 0
            if (equal >= 5) return bytes
            previous = bytes; Thread.sleep(8)
        }
        error("ColorPicker did not settle")
    }
    @Composable private fun Host(state: LabThemeState, content: @Composable () -> Unit) {
        LabTheme(state) { LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(state.colors["bg-secondary"])) }) { Box(Modifier.padding(20.dp)) { content() } } }
    }

    @Test fun fifteenAuthoredViewsRenderWithActualFonts() {
        val output = File("build/color-picker-render").apply { mkdirs() }
        for (variant in LabColorPickerVariant.entries) for (model in LabColorModel.entries) {
            val ready = AtomicBoolean(false)
            val value = if (model == LabColorModel.Lch) LabColorValue(LabColorSpace.Lch,72.09,84.86,65.34) else LabColorValue.Orange
            val scene = ImageComposeScene(430,1000,Density(1f)) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                Host(theme()) { LabColorPicker(value, {}, variant = variant, model = model, pickScreenColor = null) }
            }
            try {
                val png = settle(scene) { ready.get() }
                File(output,"${variant.name.lowercase()}-${model.name.lowercase()}.png").writeBytes(png)
                val bounds = named(scene,"Colors").boundsInRoot
                assertEquals(390f,bounds.width)
                assertTrue(bounds.height <= 960,"$variant $model height ${bounds.height}")
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsActions.SetText) != null })
                if (variant == LabColorPickerVariant.Grid) assertEquals(100,nodes(scene).count { it.config.getOrNull(SemanticsProperties.Role) == Role.RadioButton } - 3)
            } finally { scene.close() }
        }
    }

    @Test fun changingViewDoesNotRewriteRawColorAndChannelEditsCommitAcceptedValues() {
        val raw = LabColorValue(LabColorSpace.Hsv,13.123456789,79.123456789,43.123456789,.5019607843137255)
        var value by mutableStateOf<LabColorValue?>(raw)
        val changes = mutableListOf<LabColorValue?>(); val endings = mutableListOf<LabColorValue?>()
        var variant by mutableStateOf(LabColorPickerVariant.Spectrum)
        var model by mutableStateOf(LabColorModel.Hex)
        var accept by mutableStateOf(true)
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(value,{ changes += it; if (accept) value = it },
            variant = variant, model = model, onValueChangeEnd = { endings += it }, pickScreenColor = null) } }
        try {
            settle(scene)
            for (next in LabColorModel.entries) { model = next; settle(scene); assertEquals(raw,value) }
            for (next in LabColorPickerVariant.entries) { variant = next; settle(scene); assertEquals(raw,value) }
            assertTrue(changes.isEmpty()); assertTrue(endings.isEmpty())
            variant = LabColorPickerVariant.Sliders; model = LabColorModel.Rgb; settle(scene)
            assertTrue(named(scene,"Red").config[SemanticsActions.SetProgress].action!!.invoke(100f)); settle(scene)
            assertEquals(100 / 255.0,value!![0]); assertEquals(raw.alpha,value!!.alpha); assertEquals(value,endings.single())
            accept = false; settle(scene)
            named(scene,"Red").config[SemanticsActions.SetProgress].action!!.invoke(200f); settle(scene)
            assertEquals(100 / 255.0,value!![0]); assertEquals(1,endings.size)
        } finally { scene.close() }
    }

    @Test fun planePointerEscapeRestoresExactStartingValue() {
        val raw = LabColorValue(LabColorSpace.Hsv,13.123456789,79.123456789,43.123456789,.5019607843137255)
        var value by mutableStateOf<LabColorValue?>(raw)
        var ended = 0
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(value,{ value = it }, onValueChangeEnd = { ended++ },pickScreenColor = null) } }
        try {
            settle(scene)
            val bounds = named(scene,"Saturation and Brightness").boundsInRoot
            val start = Offset(bounds.left + 100,bounds.top + 80)
            scene.sendPointerEvent(PointerEventType.Press,start); settle(scene)
            scene.sendPointerEvent(PointerEventType.Move,start + Offset(80f,50f)); settle(scene)
            assertNotEquals(raw,value)
            scene.sendKeyEvent(KeyEvent(Key.Escape,KeyEventType.KeyDown)); settle(scene)
            scene.sendPointerEvent(PointerEventType.Release,start + Offset(80f,50f)); settle(scene)
            assertEquals(raw,value); assertEquals(0,ended)
        } finally { scene.close() }
    }

    @Test fun readonlyDisablesMutation() {
        val raw = LabColorValue(LabColorSpace.Lch,72.09123456789,84.86123456789,65.34123456789,.5019607843137255)
        var calls = 0
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(raw,{ calls++ }, model = LabColorModel.Lch,variant = LabColorPickerVariant.Sliders,readOnly = true,pickScreenColor = null) } }
        try {
            settle(scene)
            assertNull(named(scene,"Lightness").config.getOrNull(SemanticsActions.SetProgress))
            assertNull(named(scene,"Lightness and Chroma").config.getOrNull(SemanticsActions.CustomActions))
            assertEquals(0,calls)
        } finally { scene.close() }
    }

    @Test fun textBlurRetainsRawPrecisionAndEnterReadsAcceptedOrRejectedValue() {
        val raw = LabColorValue(LabColorSpace.Lch,72.09123456789,84.86123456789,65.34123456789,.5019607843137255)
        var value by mutableStateOf<LabColorValue?>(raw)
        var accept by mutableStateOf(true)
        val changed = mutableListOf<LabColorValue?>(); val ended = mutableListOf<LabColorValue?>()
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(value,{ changed += it; if (accept) value=it },model=LabColorModel.Lch,onValueChangeEnd={ ended += it }) } }
        try {
            settle(scene); focus(scene,"LCH color"); focus(scene,"Hue value")
            assertEquals(raw,value); assertTrue(changed.isEmpty()); assertTrue(ended.isEmpty())
            focus(scene,"LCH color"); type(scene,"LCH color","lch(60.1234567890123 55.2345678901234 44.3456789012345 / .7654321098765)"); press(scene,Key.Enter)
            assertEquals(listOf(60.1234567890123,55.2345678901234,44.3456789012345),value!!.coords)
            assertEquals(.7654321098765,value!!.alpha); assertEquals(value,ended.single())
            val accepted = value
            accept=false; settle(scene); type(scene,"LCH color","lch(20 30 40)"); press(scene,Key.Enter)
            assertEquals(accepted,value); assertEquals(1,ended.size); assertEquals(colorFieldText(accepted!!,LabColorModel.Lch),text(scene,"LCH color"))
            type(scene,"LCH color","lch(10 20 30)"); press(scene,Key.Escape); focus(scene,"Hue value")
            assertEquals(2,changed.size); assertEquals(1,ended.size)
        } finally { scene.close() }
    }

    @Test fun stateResetDiscardsFocusedDraftWithoutAChangeEvent() {
        val raw = LabColorValue(LabColorSpace.Lch,72.09123456789,84.86123456789,65.34123456789,.5019607843137255)
        val state = LabColorPickerState(raw)
        var changed = 0; var ended = 0
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(state,model=LabColorModel.Lch,onValueChange={changed++},onValueChangeEnd={ended++}) } }
        try {
            settle(scene); focus(scene,"LCH color"); type(scene,"LCH color","lch(20 30 40)")
            state.reset(); settle(scene)
            assertEquals(colorFieldText(raw,LabColorModel.Lch),text(scene,"LCH color"))
            press(scene,Key.Enter); focus(scene,"Hue value")
            assertEquals(raw,state.value); assertEquals(0,changed); assertEquals(0,ended)
        } finally { scene.close() }
    }

    @Test fun stateResetCancelsAnActivePointerWithoutRestoringThePreviousEdit() {
        val initial = LabColorValue(LabColorSpace.Hsv,13.123456789,79.123456789,43.123456789,.5019607843137255)
        val state = LabColorPickerState(initial)
        var ended = 0
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(state,onValueChangeEnd={ended++}) } }
        try {
            state.value=LabColorValue.Orange; settle(scene)
            val bounds = named(scene,"Saturation and Brightness").boundsInRoot
            val position = Offset(bounds.left+100,bounds.top+100)
            scene.sendPointerEvent(PointerEventType.Press,position); settle(scene)
            assertNotEquals(initial,state.value)
            state.reset(); settle(scene)
            scene.sendPointerEvent(PointerEventType.Release,position); settle(scene)
            assertEquals(initial,state.value); assertEquals(0,ended)
        } finally { scene.close() }
    }

    @Test fun rec2020ToggleChangesThePointerAndSliderDomainWithoutRewritingRawColor() {
        val raw = LabColorValue(LabColorSpace.Lch,50.123456789,120.123456789,250.123456789,.5019607843137255)
        var value by mutableStateOf<LabColorValue?>(raw)
        var changed = 0
        val scene = ImageComposeScene(430,1000) { Host(theme()) { LabColorPicker(value,{value=it;changed++},model=LabColorModel.Lch,variant=LabColorPickerVariant.Sliders) } }
        try {
            settle(scene)
            assertEquals(145f,named(scene,"Chroma").config[SemanticsProperties.ProgressBarRangeInfo].range.endInclusive)
            val rec2020 = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Switch }.last()
            rec2020.config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(raw,value); assertEquals(0,changed)
            assertEquals(195f,named(scene,"Chroma").config[SemanticsProperties.ProgressBarRangeInfo].range.endInclusive)
            val bounds = named(scene,"Hue and Chroma").boundsInRoot
            val position = Offset(bounds.left+bounds.width*.25f,bounds.top+bounds.height*.25f)
            scene.sendPointerEvent(PointerEventType.Press,position); settle(scene)
            scene.sendPointerEvent(PointerEventType.Release,position); settle(scene)
            assertEquals(146.25,value!![1]); assertEquals(90.0,value!![2]); assertEquals(raw.alpha,value!!.alpha)
            named(scene,"Chroma").config[SemanticsActions.SetProgress].action!!.invoke(180f); settle(scene)
            assertEquals(180.0,value!![1]); assertEquals(raw.alpha,value!!.alpha)
        } finally { scene.close() }
    }

    @Test fun imeCompositionAndItsFinishingEnterDoNotCommitEarly() {
        var value by mutableStateOf<LabColorValue?>(LabColorValue.Orange)
        var input: PlatformTextInputMethodRequest? = null
        var changed = 0
        val scene = ImageComposeScene(430,1000) { Host(theme()) { InterceptPlatformTextInput({ request, _ -> input=request; awaitCancellation() }) {
            LabColorPicker(value,{value=it;changed++})
        } } }
        try {
            settle(scene); focus(scene,"HEX color")
            val ime = assertNotNull(input)
            ime.onEditCommand(listOf(SetSelectionCommand(0,7),SetComposingTextCommand("#123456",1))); settle(scene)
            press(scene,Key.Enter); assertEquals(0,changed)
            ime.onEditCommand(listOf(FinishComposingTextCommand()))
            press(scene,Key.Enter); assertEquals(0,changed)
            assertEquals("#123456",text(scene,"HEX color"))
            press(scene,Key.Enter); assertEquals(1,changed); assertEquals("#123456",ColorPickerCodec.hex(value!!))
        } finally { scene.close() }
    }

    @Test fun narrowDarkFontScale125KeepsControlsInsideThePanel() {
        val output = File("build/color-picker-render").apply { mkdirs() }
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(360,1200,Density(1f,1.25f)) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            Host(theme(LabAppearance.Dark)) { LabColorPicker(LabColorValue.Orange,{},variant=LabColorPickerVariant.Sliders,model=LabColorModel.Lch,material=LabMaterial.Acrylic) }
        }
        try {
            File(output,"sliders-lch-dark-narrow-125.png").writeBytes(settle(scene) { ready.get() })
            val panel = named(scene,"Colors").boundsInRoot
            assertEquals(320f,panel.width)
            for (node in nodes(scene).filter { it.config.getOrNull(SemanticsActions.SetText) != null }) {
                assertTrue(node.boundsInRoot.left >= panel.left && node.boundsInRoot.right <= panel.right)
            }
        } finally { scene.close() }
    }

    @Test fun suppliedPickerAndClipboardUseAcceptedValuesAndCancelOnDetach() {
        var value by mutableStateOf<LabColorValue?>(LabColorValue.Orange)
        var result = CompletableDeferred<LabColorValue?>()
        var show by mutableStateOf(true)
        var enabled by mutableStateOf(true)
        var accept by mutableStateOf(true)
        var cancellations = 0
        var ended = 0
        var copied: AnnotatedString? = null
        val clipboard = object : ClipboardManager {
            override fun getText(): AnnotatedString? = copied
            override fun setText(annotatedString: AnnotatedString) { copied = annotatedString }
        }
        val scene = ImageComposeScene(430,1000) { CompositionLocalProvider(LocalClipboardManager provides clipboard) {
            Host(theme()) { if (show) LabColorPicker(value,{if (accept) value=it}, enabled=enabled,onValueChangeEnd={ended++},pickScreenColor={ try { result.await() } finally { if (!result.isCompleted) cancellations++ } }) }
        } }
        try {
            settle(scene); click(scene,"Copy color"); settle(scene); assertEquals("#FFAA00",copied?.text)
            click(scene,"Pick a color from screen"); settle(scene)
            val next = LabColorValue(LabColorSpace.Lch,50.123456789,60.123456789,35.123456789,.4)
            value=value!!.copy(alpha=.32123456789); settle(scene)
            val accepted = next.copy(alpha = .32123456789)
            result.complete(next); settle(scene); assertEquals(accepted,value); assertEquals(1,ended)
            result = CompletableDeferred(); click(scene,"Pick a color from screen"); settle(scene); result.complete(null); settle(scene)
            assertEquals(accepted,value); assertEquals(1,ended)
            accept=false; result=CompletableDeferred(); click(scene,"Pick a color from screen"); settle(scene)
            result.complete(LabColorValue.Orange); settle(scene); assertEquals(accepted,value); assertEquals(1,ended)
            result=CompletableDeferred(); click(scene,"Pick a color from screen"); settle(scene)
            result.completeExceptionally(IllegalStateException("Provider unavailable")); settle(scene)
            assertNotNull(named(scene,"Could not pick a screen color. Try again.")); assertEquals(accepted,value)
            result=CompletableDeferred(); click(scene,"Pick a color from screen"); settle(scene); enabled=false; settle(scene)
            assertEquals(1,cancellations); enabled=true; settle(scene)
            result = CompletableDeferred(); click(scene,"Pick a color from screen"); settle(scene); show=false; settle(scene)
            assertEquals(2,cancellations)
        } finally { scene.close() }
    }
}
