package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import javax.imageio.ImageIO
import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Real paint, native semantics and layout; no platform window or accessibility client. */
class TextLineBoxRenderTest {
    private val roles = listOf(16 to 24, 20 to 20, 12 to 12, 14 to 12)
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)

    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val frame = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
            equal = if (ready.get() && previous?.contentEquals(frame) == true) equal + 1 else 0
            if (equal == 3) return frame
            previous = frame
            Thread.sleep(5)
        }
        error("Bundled font and text scene did not settle")
    }

    @Test fun authoredLineBoxesAndPaintStepsSurviveDensityScalingSelectionAndEditing() {
        val output = File("build/lineboxes").apply { mkdirs() }
        val report = StringBuilder("density\tfontScale\tfontSize/lineHeight\tconsumer\tinkBands\n")
        for (density in listOf(1f, 2f)) for (scale in listOf(1f, 2f)) {
            val ready = AtomicBoolean(false)
            val heights = mutableMapOf<Pair<Int, Int>, Int>()
            val paragraphs = mutableMapOf<Int, TextLayoutResult>()
            var edited = ""
            val scene = ImageComposeScene((620 * density).toInt(), (650 * scale * density).toInt(), Density(density, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                Box(Modifier.fillMaxSize().background(Color.White)) {
                    for ((row, pair) in roles.withIndex()) {
                        val (size, lineHeight) = pair
                        val style = TextStyle(fontFamily = font, fontSize = size.sp, lineHeight = lineHeight.sp,
                            fontWeight = if (row == 0) FontWeight.Normal else FontWeight.Medium,
                            lineHeightStyle = LabLineHeightStyle, color = Color.Black)
                        for (column in 0..2) {
                            val modifier = Modifier.offset((24 + column * 190).dp, ((24 + row * 150) * scale).dp)
                                .width(160.dp).onGloballyPositioned { heights[row to column] = it.size.height }
                            when (column) {
                                0 -> LabText("H\nH\nH", modifier, style, onTextLayout = { paragraphs[row] = it })
                                1 -> SelectionContainer { LabText("H\nH\nH", modifier, style) }
                                2 -> BasicTextField("H\nH\nH", { edited = it }, modifier, textStyle = style)
                            }
                        }
                    }
                }
            }
            try {
                val png = settle(scene, ready)
                File(output, "authored-d${density.toInt()}-s${scale.toInt()}.png").writeBytes(png)
                val bitmap = ImageIO.read(ByteArrayInputStream(png))
                for ((row, pair) in roles.withIndex()) {
                    val (size, height) = pair
                    for (column in 0..2) {
                        val x = ((24 + column * 190) * density).roundToInt()
                        val y = ((24 + row * 150) * scale * density).roundToInt()
                        val bands = mutableListOf<IntRange>()
                        for (dy in 0 until (110 * scale * density).roundToInt()) {
                            val painted = (x until x + (45 * scale * density).roundToInt()).any { px ->
                                bitmap.getRGB(px, y + dy) and 0x00ffffff < 0x808080
                            }
                            if (painted) {
                                if (bands.isEmpty() || bands.last().last != dy - 1) bands += dy..dy
                                else bands[bands.lastIndex] = bands.last().first..dy
                            }
                        }
                        assertEquals(3, bands.size, "$density/$scale/$pair/$column must paint three complete H glyphs")
                        val step = (height * scale * density).roundToInt()
                        assertEquals(step, bands[1].last - bands[0].last, "First paint step $density/$scale/$pair/$column")
                        assertEquals(step, bands[2].last - bands[1].last, "Second paint step $density/$scale/$pair/$column")
                        assertEquals(bands[0].last - bands[0].first, bands[2].last - bands[2].first, "No clipped first/last glyph")
                        if (column < 2) assertEquals(3 * step, heights.getValue(row to column), "Authored outer height")
                        report.appendLine("$density\t$scale\t$size/$height\t$column\t${bands.joinToString()}")
                    }
                }
                val nodes = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                val field = nodes.first { it.config.getOrNull(SemanticsActions.SetText) != null }
                assertTrue(field.config[SemanticsActions.SetText].action!!.invoke(AnnotatedString("Edited Йgj")))
                assertEquals("Edited Йgj", edited)
                assertEquals(4, paragraphs.size)
            } finally { scene.close() }
        }
        File(output, "paint-steps.tsv").writeText(report.toString())
    }

    @Test fun customFamiliesKeepNativeLayoutAndAccentsStayVisible() {
        val ready = AtomicBoolean(false)
        val heights = mutableMapOf<String, Int>()
        val scene = ImageComposeScene(720, 400, Density(2f)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            Box(Modifier.fillMaxSize().background(Color.White)) {
                val style = TextStyle(fontFamily = FontFamily.Serif, fontSize = 20.sp, lineHeight = 12.sp,
                    color = Color.Black)
                BasicText("Йgj\nÁÉj", Modifier.offset(20.dp, 20.dp).onGloballyPositioned { heights["native"] = it.size.height }, style)
                LabText("Йgj\nÁÉj", Modifier.offset(130.dp, 20.dp).onGloballyPositioned { heights["lab"] = it.size.height }, style)
                LabText("Йgj\nÁÉj", Modifier.offset(240.dp, 20.dp),
                    TextStyle(fontFamily = font, fontSize = 20.sp, lineHeight = 20.sp, color = Color.Black))
                val fallback = TextStyle(fontFamily = font, fontSize = 12.sp, lineHeight = 12.sp,
                    lineHeightStyle = LabLineHeightStyle, color = Color.Black)
                BasicText("東京🙂\n東京🙂", Modifier.offset(20.dp, 100.dp).onGloballyPositioned { heights["fallback-native"] = it.size.height }, fallback)
                LabText("東京🙂\n東京🙂", Modifier.offset(130.dp, 100.dp).onGloballyPositioned { heights["fallback-lab"] = it.size.height }, fallback)
            }
        }
        try {
            val png = settle(scene, ready)
            assertEquals(heights["native"], heights["lab"], "Custom metrics must not be shortened around overflowing paint")
            assertEquals(heights["fallback-native"], heights["fallback-lab"], "Fallback glyph metrics must not be shortened")
            val bitmap = ImageIO.read(ByteArrayInputStream(png))
            for (y in 20 until 180) for (x in 40 until 180)
                assertEquals(bitmap.getRGB(x, y), bitmap.getRGB(x + 220, y), "Custom font paint must stay native")
            File("build/lineboxes/custom-and-accents.png").writeBytes(png)
        } finally { scene.close() }
    }

    @Test fun selectableTextKeepsNativeDragHitTesting() {
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(300, 150) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            Box(Modifier.fillMaxSize().background(Color.White)) {
                SelectionContainer {
                    LabText("Hello\nWorld", Modifier.offset(24.dp, 24.dp), TextStyle(fontFamily = font,
                        fontSize = 16.sp, lineHeight = 24.sp, color = Color.Black))
                }
            }
        }
        try {
            val before = settle(scene, ready)
            scene.sendPointerEvent(PointerEventType.Press, Offset(25f, 36f))
            scene.render().close()
            scene.sendPointerEvent(PointerEventType.Move, Offset(67f, 60f))
            scene.render().close()
            scene.sendPointerEvent(PointerEventType.Release, Offset(67f, 60f))
            val after = settle(scene, ready)
            val bitmap = ImageIO.read(ByteArrayInputStream(after))
            val colored = (24 until 72).sumOf { y -> (24 until 85).count { x ->
                val color = bitmap.getRGB(x, y)
                val red = color shr 16 and 255
                val green = color shr 8 and 255
                val blue = color and 255
                red != green || red != blue
            } }
            assertTrue(!before.contentEquals(after) && colored > 100, "Dragging over both lines must paint the native selection")
            File("build/lineboxes/selection.png").writeBytes(after)
        } finally { scene.close() }
    }

    @Test fun aHeightConstraintStillEllipsizesLikeNativeText() {
        val ready = AtomicBoolean(false)
        val layouts = mutableMapOf<String, TextLayoutResult>()
        val scene = ImageComposeScene(300, 120) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            val style = TextStyle(fontFamily = font, fontSize = 16.sp, lineHeight = 24.sp,
                lineHeightStyle = LabLineHeightStyle)
            Box {
                BasicText("First Second Third Fourth Fifth", Modifier.width(100.dp).height(24.dp), style,
                    overflow = TextOverflow.Ellipsis, onTextLayout = { layouts["native"] = it })
                LabText("First Second Third Fourth Fifth", Modifier.offset(130.dp).width(100.dp).height(24.dp), style,
                    overflow = TextOverflow.Ellipsis, onTextLayout = { layouts["lab"] = it })
            }
        }
        try {
            val png = settle(scene, ready)
            assertEquals(1, layouts.getValue("native").lineCount, "Calibrate the native constraint oracle")
            assertEquals(1, layouts.getValue("lab").lineCount)
            assertEquals(layouts.getValue("native").isLineEllipsized(0), layouts.getValue("lab").isLineEllipsized(0))
            val bitmap = ImageIO.read(ByteArrayInputStream(png))
            for (y in 0 until 24) for (x in 0 until 100)
                assertEquals(bitmap.getRGB(x, y), bitmap.getRGB(x + 130, y), "The constrained text must paint like native BasicText")
            File("build/lineboxes/height-overflow.png").writeBytes(png)
        } finally { scene.close() }
    }
}
