package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import javax.imageio.ImageIO
import kotlin.math.ceil
import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Ellipsis must remove the suffix, never the upper accents of its unchanged prefix. */
class TextEllipsisInkRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)

    @Test fun aRealBadgeKeepsTheCompletePrefixAtEveryDensityAndTextScale() {
        val text = "ÅÉЙ ÅÉЙ ÅÉЙ ÅÉЙ"
        val output = File("build/lineboxes/ellipsis").apply { mkdirs() }
        val report = StringBuilder("density\tfontScale\tprefixPixels\tmismatches\n")
        val mismatchingCases = mutableListOf<String>()
        for (density in listOf(1f, 2f)) for (scale in listOf(1f, 1.25f, 2f)) for (calibrate in listOf(false, true)) {
            val case = "badge-${if (calibrate) "control-" else ""}d$density-s$scale"
            val ready = AtomicBoolean(false)
            val bounds = mutableMapOf<String, Rect>()
            val theme = LabThemeState(LabColorOutput(mapOf(
                "label-primary" to Color.Black, "badge-fill-blue" to Color.White,
                "badge-label-on-blue" to Color.Black, "badge-icon-on-blue" to Color.Black,
            )))
            val scene = ImageComposeScene((450 * density).roundToInt(), (150 * density).roundToInt(), Density(density, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        for ((name, width) in listOf("wide" to 400, "narrow" to if (calibrate) 400 else 110)) {
                            LabBadge(text, Modifier.width(width.dp).onGloballyPositioned { bounds[name] = it.boundsInRoot() },
                                color = LabBadgeColor.Blue)
                        }
                    }
                }
            }
            try {
                var previous: ByteArray? = null
                var settled = 0
                var png: ByteArray? = null
                for (frame in 0 until 100) {
                    val bytes = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
                    settled = if (ready.get() && previous?.contentEquals(bytes) == true) settled + 1 else 0
                    if (settled >= 3) { png = bytes; break }
                    previous = bytes
                    Thread.sleep(5)
                }
                val frame = checkNotNull(png)
                File(output, "$case.png").writeBytes(frame)
                val nodes = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                val paragraphs = nodes.flatMap { node -> mutableListOf<TextLayoutResult>().also {
                    node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it)
                } }.sortedByDescending { it.size.width }
                assertEquals(2, paragraphs.size)
                assertFalse(paragraphs[0].hasVisualOverflow, "The complete wide string calibrates the glyph oracle")
                assertEquals(!calibrate, paragraphs.last().hasVisualOverflow, "The comparison must use the intended overflow path")
                for (paragraph in paragraphs) assertEquals(text, paragraph.layoutInput.text.text)
                val labelNodes = nodes.filter { it.config.getOrNull(SemanticsProperties.Text) != null }
                assertEquals(2, labelNodes.size)
                assertTrue(labelNodes.all { it.config[SemanticsProperties.Text].single().text == text })
                val bitmap = ImageIO.read(ByteArrayInputStream(frame))
                val wide = bounds.getValue("wide")
                val narrow = bounds.getValue("narrow")
                assertEquals(wide.height, narrow.height, "Truncation must preserve the authored control height")
                val prefixWidth = ceil(paragraphs[0].getBoundingBox(2).right + LabComponents.BadgePaddingX * density).toInt()
                val comparison = recordTextPixelEvidence(output, case, bitmap, wide, narrow, prefixWidth)
                if (!calibrate) report.appendLine("$density\t$scale\t${comparison.inkPixels}\t${comparison.mismatches}")
                assertTrue(comparison.inkPixels > 30, "The prefix oracle must contain visible glyphs and accents")
                if (!comparison.preservesInk(calibrate)) mismatchingCases += "$case: ${comparison.summary()}"
            } finally { scene.close() }
        }
        File(output, "badge-prefix.tsv").writeText(report.toString())
        assertTrue(mismatchingCases.isEmpty(), "The unchanged ÅÉЙ prefix must preserve its ink: ${mismatchingCases.joinToString()}")
    }

    @Test fun restorationPreservesBrushAlphaShadowAndDecorationWithoutDoublePainting() {
        val output = File("build/lineboxes/ellipsis").apply { mkdirs() }
        val mismatchingCases = mutableListOf<String>()
        for (paint in listOf("alpha", "brush", "decoration")) for (calibrate in listOf(false, true)) {
            val case = "paint-${if (calibrate) "control-" else ""}$paint"
            val ready = AtomicBoolean(false)
            val bounds = mutableMapOf<String, Rect>()
            val layouts = mutableMapOf<String, TextLayoutResult>()
            val scene = ImageComposeScene(900, 260, Density(2f)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                val base = TextStyle(fontFamily = font, fontSize = 20.sp, lineHeight = 20.sp,
                    fontWeight = FontWeight.Medium, color = Color(0x803080B0))
                val style = when (paint) {
                    "brush" -> base.copy(brush = Brush.linearGradient(listOf(Color.Red, Color.Blue),
                        end = Offset(400f, 0f)), alpha = .6f)
                    "decoration" -> base.copy(textDecoration = TextDecoration.Underline,
                        shadow = Shadow(Color(0x80204060), Offset(2f, 2f), 1f))
                    else -> base
                }
                Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    for ((name, width) in listOf("wide" to 400, "narrow" to if (calibrate) 400 else 110)) LabText("ÅÉЙ ÅÉЙ ÅÉЙ ÅÉЙ",
                        Modifier.width(width.dp).onGloballyPositioned { bounds[name] = it.boundsInRoot() }
                            .padding(vertical = 8.dp), style, overflow = TextOverflow.Ellipsis,
                        maxLines = 1, softWrap = false, onTextLayout = { layouts[name] = it })
                }
            }
            try {
                var previous: ByteArray? = null
                var settled = 0
                var png: ByteArray? = null
                for (frame in 0 until 100) {
                    val bytes = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
                    settled = if (ready.get() && previous?.contentEquals(bytes) == true) settled + 1 else 0
                    if (settled >= 3) { png = bytes; break }
                    previous = bytes
                    Thread.sleep(5)
                }
                val frame = checkNotNull(png)
                File(output, "$case.png").writeBytes(frame)
                assertFalse(layouts.getValue("wide").hasVisualOverflow)
                assertEquals(!calibrate, layouts.getValue("narrow").hasVisualOverflow)
                val bitmap = ImageIO.read(ByteArrayInputStream(frame))
                val wide = bounds.getValue("wide")
                val prefix = ceil(layouts.getValue("wide").getBoundingBox(2).right).toInt()
                val comparison = recordTextPixelEvidence(output, case, bitmap, wide, bounds.getValue("narrow"), prefix)
                if (!comparison.preservesInk(calibrate)) mismatchingCases += "$case: ${comparison.summary()}"
            } finally { scene.close() }
        }
        assertTrue(mismatchingCases.isEmpty(), "The complete paint matrix must preserve its prefix: ${mismatchingCases.joinToString()}")
    }

    @Test fun anEllipsizedLabelKeepsNativeSelectionAndItsFullAccessibleText() {
        val text = "ÅÉЙ ÅÉЙ ÅÉЙ ÅÉЙ"
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(240, 100) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp)) {
                SelectionContainer {
                    LabText(text, Modifier.width(110.dp), TextStyle(fontFamily = font,
                        fontSize = 20.sp, lineHeight = 20.sp, color = Color.Black),
                        maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        try {
            repeat(15) { scene.render().close(); Thread.sleep(5) }
            assertTrue(ready.get())
            val before = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
            scene.sendPointerEvent(PointerEventType.Press, Offset(17f, 26f))
            scene.render().close()
            scene.sendPointerEvent(PointerEventType.Move, Offset(110f, 26f))
            scene.render().close()
            scene.sendPointerEvent(PointerEventType.Release, Offset(110f, 26f))
            val after = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
            val original = ImageIO.read(ByteArrayInputStream(before))
            val selected = ImageIO.read(ByteArrayInputStream(after))
            var colored = 0
            for (y in 10 until 40) for (x in 16 until 126) {
                val pixel = selected.getRGB(x, y)
                if ((pixel shr 16 and 255) != (pixel and 255)) colored++
                if (original.getRGB(x, y) and 0x00ffffff == 0)
                    assertEquals(0, pixel and 0x00ffffff, "Selecting must preserve opaque glyph ink")
            }
            assertTrue(colored > 100, "Native selection must remain visible inside the paragraph")
            val nodes = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
            val label = nodes.single { it.config.getOrNull(SemanticsProperties.Text) != null }
            assertEquals(text, label.config[SemanticsProperties.Text].single().text)
            File("build/lineboxes/ellipsis/selection.png").writeBytes(after)
        } finally { scene.close() }
    }
}
