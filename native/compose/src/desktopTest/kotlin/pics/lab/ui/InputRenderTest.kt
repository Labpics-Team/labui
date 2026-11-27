package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.math.roundToInt

/** Real CPU text rasterization, with no platform window or accessibility client. */
class InputRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun field(scene: ImageComposeScene): SemanticsNode = scene.semanticsOwners
        .flatMap { walk(it.rootSemanticsNode) }
        .single { it.config.getOrNull(SemanticsActions.SetText) != null }

    private fun settle(scene: ImageComposeScene, ready: () -> Boolean): ByteArray {
        var previous: ByteArray? = null
        var equalFrames = 0
        repeat(100) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equalFrames = if (ready() && previous?.contentEquals(bytes) == true) equalFrames + 1 else 0
            if (equalFrames >= 4) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("Input did not settle")
    }

    @Test fun labelsRemainReadableAndFieldsKeepAuthoredGeometry() = checkLabelReflow(singleLine = true)

    @Test fun textareaUsesItsAuthoredProfileAndKeepsEveryLabelLine() = checkLabelReflow(singleLine = false)

    @Test fun textareaStatesKeepHelpersAtTheAuthoredCaptionSize() {
        val output = File("build/textarea-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) {
            val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val ready = AtomicBoolean(false)
            val states = listOf("Default", "Entered", "Active", "Danger", "Disabled", "Read only")
                .associateWith { TextFieldState(if (it == "Default") "" else "Содержимое") }
            val scene = ImageComposeScene(320, 1040) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        for ((name, state) in states) LabInput(state, name, singleLine = false,
                            enabled = name != "Disabled", readOnly = name == "Read only",
                            helper = "$name helper", error = if (name == "Danger") "$name helper" else null,
                            placeholder = "Введите описание")
                    }
                }
            }
            try {
                settle(scene) { ready.get() }
                fun nodes() = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
                val active = nodes().single {
                    it.config.getOrNull(SemanticsProperties.ContentDescription) == listOf("Active")
                }
                assertTrue(active.config[SemanticsActions.RequestFocus].action!!.invoke())
                File(output, "states-${appearance.name.lowercase()}-100.png").writeBytes(settle(scene) { ready.get() })
                for (name in states.keys) {
                    val helper = nodes().single {
                        it.config.getOrNull(SemanticsProperties.Text)?.singleOrNull()?.text == "$name helper"
                    }
                    val text = mutableListOf<TextLayoutResult>()
                    assertTrue(helper.config[SemanticsActions.GetTextLayoutResult].action!!.invoke(text))
                    assertEquals(12.sp, text.single().layoutInput.style.fontSize)
                    assertEquals(12.sp, text.single().layoutInput.style.lineHeight)
                    assertEquals(theme.colors[when (name) {
                        "Disabled" -> "label-quaternary"
                        "Danger" -> "label-danger"
                        else -> "label-secondary"
                    }], text.single().layoutInput.style.color)
                }
                assertTrue(nodes().single {
                    it.config.getOrNull(SemanticsProperties.ContentDescription) == listOf("Disabled")
                }.config.contains(SemanticsProperties.Disabled))
                assertEquals(true, nodes().single { it.id == active.id }.config[SemanticsProperties.Focused])
            } finally { scene.close() }
        }
    }

    private fun checkLabelReflow(singleLine: Boolean) {
        val output = File(if (singleLine) "build/input-render" else "build/textarea-render").apply { mkdirs() }
        for (scale in listOf(1f, 1.25f, 2f)) for (size in LabControlSize.entries)
            for (direction in LayoutDirection.entries) {
            val prefs = LabPreferences(reducedMotion = true)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val ready = AtomicBoolean(false)
            val referenceReady = AtomicBoolean(false)
            val state = TextFieldState("hello@labpics.ru")
            var label by mutableStateOf("Label")
            var componentHeight = 0
            var expectedLabel: TextLayoutResult? = null
            val sceneHeight = if (singleLine) 240 else 600
            val scene = ImageComposeScene(320, sceneHeight, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                CompositionLocalProvider(LocalLayoutDirection provides direction) { LabTheme(theme, font) {
                    Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp)) {
                        LabInput(state, label, Modifier.width(288.dp)
                            .onGloballyPositioned { componentHeight = it.size.height }, size = size, singleLine = singleLine)
                    }
                } }
            }
            // This unconstrained-height BasicText is the independent readability oracle.
            // Textarea's 14/12 profile centres the 1em native glyph box in its 12sp line.
            // The component label intentionally has no duplicate accessibility node.
            val reference = ImageComposeScene(320, sceneHeight, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); referenceReady.set(true) }
                CompositionLocalProvider(LocalLayoutDirection provides direction) { LabTheme(theme, font) {
                    Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) {
                        val trim = with(LocalDensity.current) { (if (singleLine) 0 else 1).sp.toDp() }
                        BasicText(label, Modifier.offset(y = -trim).padding(start = 36.dp, end = 32.dp, top = 16.dp),
                            style = LabType.caption().copy(color = theme.colors[if (singleLine) "label-secondary" else "label-primary"],
                                fontSize = (if (singleLine) 12 else 14).sp, lineHeight = 12.sp, fontWeight = FontWeight.Medium,
                                letterSpacing = 0.sp), onTextLayout = { expectedLabel = it })
                    }
                } }
            }
            try {
                fun checkLabel(name: String) {
                    val bytes = settle(scene) { ready.get() }
                    settle(reference) { referenceReady.get() }
                    File(output, "${size.name.lowercase()}-${(scale * 100).toInt()}-${direction.name.lowercase()}-$name.png")
                        .writeBytes(bytes)
                    val text = expectedLabel!!
                    assertTrue(!text.hasVisualOverflow)
                    scene.render().use { actualImage -> reference.render().use { referenceImage ->
                        val actual = org.jetbrains.skia.Bitmap.makeFromImage(actualImage)
                        val expected = org.jetbrains.skia.Bitmap.makeFromImage(referenceImage)
                        try {
                            val background = expected.getColor(0, 0)
                            var glyphPixels = 0
                            for (y in 16 until 16 + text.size.height) for (x in 16 until 304) {
                                val pixel = expected.getColor(x, y)
                                if (pixel != background) {
                                    glyphPixels++
                                    assertEquals(pixel, actual.getColor(x, y),
                                        "The full label must be visible at $size / $scale / $direction: ($x, $y)")
                                }
                            }
                            assertTrue(glyphPixels > 20, "The independent label renderer must contain actual glyphs")
                        } finally { actual.close(); expected.close() }
                    } }
                    assertEquals(listOf(label), field(scene).config[SemanticsProperties.ContentDescription])
                }
                checkLabel("short")
                val shortHeight = componentHeight
                val shortLabelHeight = expectedLabel!!.size.height
                if (scale == 1f) assertEquals(if (!singleLine) 120 else when (size) {
                    LabControlSize.Small -> 44
                    LabControlSize.Medium -> 56
                    LabControlSize.Large -> 64
                }, shortHeight, "Single-line geometry must preserve the authored control plus 8 dp overhang")
                val shortImage = scene.render()
                val shortBitmap = org.jetbrains.skia.Bitmap.makeFromImage(shortImage)
                try {
                    for ((name, value) in listOf(
                        "long" to "Почта для уведомлений",
                        "words" to "Адрес электронной почты для уведомлений об изменениях пространства",
                        "unbroken" to "verylongnotificationemailaddresswithoutspaces",
                        "lines" to "Почта\nдля уведомлений",
                    )) {
                        label = value
                        checkLabel(name)
                        val extraHeight = (12 * scale * (expectedLabel.lineCount - 1)).roundToInt()
                        assertEquals(shortHeight + extraHeight, componentHeight,
                            "Each extra label line must reserve its height above the editable content")
                        if (scale == 2f && name == "long") assertTrue(expectedLabel.lineCount > 1)
                        // Compare the same editor pixels before/after reflow. Merely enlarging
                        // the outline would still let the label cover the editable value.
                        scene.render().use { image ->
                            val actual = org.jetbrains.skia.Bitmap.makeFromImage(image)
                            try {
                                val foreground = theme.colors["label-primary"].toArgb()
                                var bodyPixels = 0
                                for (y in 16 + shortLabelHeight until 16 + shortHeight) for (x in 16 until 304)
                                    if (shortBitmap.getColor(x, y) == foreground) {
                                        bodyPixels++
                                        assertEquals(foreground, actual.getColor(x, y + extraHeight),
                                            "The editable value must move below the complete label at $size/$scale/$direction/$name ($x, $y)")
                                    }
                                assertTrue(bodyPixels > 20, "The body comparison must include actual editable glyphs")
                            } finally { actual.close() }
                        }
                    }
                } finally { shortBitmap.close(); shortImage.close() }
                // Keep the real editor and selection while the label reflows.
                val node = field(scene)
                assertTrue(node.config[SemanticsActions.RequestFocus].action!!.invoke())
                assertTrue(node.config[SemanticsActions.SetSelection].action!!.invoke(1, 5, false))
                settle(scene) { ready.get() }
                label = "Почта"
                settle(scene) { ready.get() }
                assertEquals(node.id, field(scene).id)
                assertEquals(true, field(scene).config[SemanticsProperties.Focused])
                assertEquals(TextRange(1, 5), state.selection)
                assertTrue(field(scene).config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("new@labpics.ru")))
                assertEquals("new@labpics.ru", state.text.toString())
            } finally { scene.close(); reference.close() }
        }
    }
}
