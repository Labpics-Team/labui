package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import org.jetbrains.skia.impl.Stats
import javax.imageio.ImageIO
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TextClipRenderTest {
    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val png = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
            equal = if (ready.get() && previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal == 3) return png
            previous = png
            Thread.sleep(5)
        }
        error("Text clipping scene did not settle")
    }

    @Test fun callerHeightAndMultilineLimitsMatchTheNativeParagraph() {
        val output = File("build/lineboxes/clip").apply { mkdirs() }
        val report = StringBuilder("density\tfontScale\tcase\tnativeLines\tlabLines\n")
        for (density in listOf(1f, 2f)) for (scale in listOf(1f, 1.25f, 2f)) {
            val ready = AtomicBoolean(false)
            val layouts = mutableMapOf<Pair<Int, Int>, TextLayoutResult>()
            val scene = ImageComposeScene((420 * density).roundToInt(), (760 * density).roundToInt(), Density(density, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                val body = TextStyle(fontFamily = font, fontSize = 16.sp, lineHeight = 24.sp,
                    color = Color.Black, lineHeightStyle = LabLineHeightStyle)
                Box(Modifier.fillMaxSize().background(Color.White)) {
                    for ((row, height) in listOf(5, 12, 24, 48, 72).withIndex()) {
                        val text = if (row == 3) "Line one\nLine two\nLine three" else "Headline"
                        for (column in 0..1) {
                            val modifier = Modifier.offset((24 + column * 196).dp, (24 + row * 120).dp)
                                .width(100.dp).height(height.dp)
                            if (column == 0) BasicText(text, modifier, body, overflow = TextOverflow.Ellipsis,
                                minLines = if (row == 4) 2 else 1, maxLines = if (row >= 3) 2 else 1,
                                onTextLayout = { layouts[row to column] = it })
                            else LabText(text, modifier, body, overflow = TextOverflow.Ellipsis,
                                minLines = if (row == 4) 2 else 1, maxLines = if (row >= 3) 2 else 1,
                                onTextLayout = { layouts[row to column] = it })
                        }
                    }
                    val tight = body.copy(fontSize = 14.sp, lineHeight = 12.sp, fontWeight = FontWeight.Medium)
                    LabText("ÅÉЙ", Modifier.offset(24.dp, 624.dp).width(100.dp), tight, maxLines = 1)
                    LabText("ÅÉЙ", Modifier.offset(220.dp, 624.dp).width(100.dp).height(5.dp), tight,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            try {
                val png = settle(scene, ready)
                File(output, "height-d$density-s$scale.png").writeBytes(png)
                val bitmap = ImageIO.read(ByteArrayInputStream(png))
                for (row in 0..4) {
                    val native = layouts.getValue(row to 0)
                    val lab = layouts.getValue(row to 1)
                    assertEquals(native.lineCount, lab.lineCount)
                    for (line in 0 until native.lineCount) {
                        assertEquals(native.getLineStart(line), lab.getLineStart(line))
                        assertEquals(native.getLineEnd(line), lab.getLineEnd(line))
                        assertEquals(native.isLineEllipsized(line), lab.isLineEllipsized(line))
                    }
                    assertEquals(native.layoutInput.text, lab.layoutInput.text)
                    if (scale == 1f && row == 3) assertEquals(2, native.lineCount, "Calibrate the multiline oracle")
                    report.appendLine("$density\t$scale\t$row\t${native.lineCount}\t${lab.lineCount}")
                    for (dy in (-12 * density).roundToInt() until (96 * density).roundToInt())
                        for (dx in (-12 * density).roundToInt() until (112 * density).roundToInt()) {
                            val y = ((24 + row * 120) * density).roundToInt() + dy
                            assertEquals(bitmap.getRGB((24 * density).roundToInt() + dx, y),
                                bitmap.getRGB((220 * density).roundToInt() + dx, y),
                                "Caller clip density=$density scale=$scale row=$row pixel=$dx/$dy")
                        }
                }
                for (dy in (-8 * density).roundToInt() until (40 * density).roundToInt())
                    for (dx in 0 until (100 * density).roundToInt()) {
                        val y = (624 * density).roundToInt() + dy
                        val expected = if (dy >= 0 && dy < (5 * density).roundToInt())
                            bitmap.getRGB((24 * density).roundToInt() + dx, y) else -1
                        assertEquals(expected, bitmap.getRGB((220 * density).roundToInt() + dx, y),
                            "Tight authored text must respect the caller height density=$density scale=$scale pixel=$dx/$dy")
                    }
            } finally { scene.close() }
        }
        File(output, "height.tsv").writeText(report.toString())
    }

    @Test fun horizontalOverflowKeepsTheNativeClip() {
        File("build/lineboxes/clip").mkdirs()
        val ready = AtomicBoolean(false)
        val layouts = arrayOfNulls<TextLayoutResult>(2)
        val scene = ImageComposeScene(320, 100) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            val style = TextStyle(fontFamily = font, fontSize = 16.sp, lineHeight = 24.sp,
                color = Color.Black, lineHeightStyle = LabLineHeightStyle,
                shadow = Shadow(Color.Black, Offset(-8f, 0f), 0f))
            Box(Modifier.fillMaxSize().background(Color.White)) {
                BasicText("Headline Headline", Modifier.offset(24.dp, 24.dp).width(70.dp), style,
                    maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis, onTextLayout = { layouts[0] = it })
                LabText("Headline Headline", Modifier.offset(184.dp, 24.dp).width(70.dp), style,
                    maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis, onTextLayout = { layouts[1] = it })
            }
        }
        try {
            val png = settle(scene, ready)
            val bitmap = ImageIO.read(ByteArrayInputStream(png))
            assertTrue(layouts.all { it?.hasVisualOverflow == true })
            for (y in 12 until 60) for (x in 12 until 108)
                assertEquals(bitmap.getRGB(x, y), bitmap.getRGB(x + 160, y), "Horizontal clip pixel $x/$y")
            File("build/lineboxes/clip/horizontal.png").writeBytes(png)
        } finally { scene.close() }
    }

    @Test fun measuringPaintBoundsReleasesEveryNativeResourceImmediately() {
        File("build/lineboxes/clip").mkdirs()
        val ready = AtomicBoolean(false)
        var layout: TextLayoutResult? = null
        val scene = ImageComposeScene(160, 80) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabText("A\u0301\u0301\u0301\u0301 ÅÉЙ ÅÉЙ ÅÉЙ", Modifier.width(70.dp),
                TextStyle(fontFamily = font, fontSize = 16.sp, lineHeight = 16.sp),
                overflow = TextOverflow.Ellipsis, maxLines = 1, onTextLayout = { layout = it })
        }
        try {
            settle(scene, ready)
            val measured = checkNotNull(layout)
            val paragraph = measured.multiParagraph
            val style = measured.layoutInput.style
            val resourceNames = listOf("PictureRecorder", "RTreeFactory", "Picture")
            val previousEnabled = Stats.enabled
            Stats.enabled = true
            try {
                val before = resourceNames.associateWith { Stats.allocated[it] ?: 0 }
                // Warm the path before timing; this measurement performs no rasterization.
                repeat(20) { textPaintBounds(paragraph, style) }
                val samples = LongArray(200) {
                    val started = System.nanoTime()
                    val bounds = textPaintBounds(paragraph, style)!!
                    assertTrue(bounds.top.isFinite() && bounds.bottom.isFinite())
                    System.nanoTime() - started
                }.sorted()
                for (name in resourceNames) assertEquals(before[name], Stats.allocated[name] ?: 0,
                    "$name must be closed before measurement returns, without GC")
                File("build/lineboxes/clip/bounds-cost.tsv").writeText(
                    "samples\tp50Micros\tp95Micros\tretainedNativeResources\n" +
                        "200\t${samples[100] / 1000.0}\t${samples[190] / 1000.0}\t0\n")
            } finally { Stats.enabled = previousEnabled }
        } finally { scene.close() }
    }

    @Test fun restoredTextUnderTransformsKeepsTheFiniteWidthClip() {
        val output = File("build/lineboxes/clip").apply { mkdirs() }
        val report = StringBuilder("rotation\tscale\tinkPixels\tmaxChannelDifference\tmeanPaintBoundsDifference\n")
        for ((rotation, scale) in listOf(0f to 1f, 30f to .5f, 30f to 1.25f, 30f to 4f, 90f to 4f)) {
            val ready = AtomicBoolean(false)
            val layouts = arrayOfNulls<TextLayoutResult>(2)
            val scene = ImageComposeScene(1600, 800) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                val style = TextStyle(fontFamily = font, fontSize = 12.sp, lineHeight = 12.sp,
                    color = Color(0x803080B0), lineHeightStyle = LabLineHeightStyle,
                    shadow = Shadow(Color(0x803080B0), Offset(-8f, 2f), 1f))
                Box(Modifier.fillMaxSize().background(Color.White)) {
                    for (column in 0..1) {
                        val modifier = Modifier.offset((300 + column * 700).dp, 400.dp).width(80.dp)
                            .graphicsLayer { rotationZ = rotation; scaleX = scale; scaleY = scale }
                        if (column == 0) BasicText("ÅÉЙ ÅÉЙ ÅÉЙ ÅÉЙ", modifier.drawWithContent {
                            layouts[0]?.let {
                                // Independent reference: paint the retained paragraph once
                                // with only a width clip and ample known vertical space.
                                clipRect(0f, -200f, size.width, 200f) {
                                    it.multiParagraph.paintText(drawContext.canvas, style)
                                }
                            }
                        }, style, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
                            onTextLayout = { layouts[0] = it })
                        else LabText("ÅÉЙ ÅÉЙ ÅÉЙ ÅÉЙ", modifier, style, maxLines = 1,
                            softWrap = false, overflow = TextOverflow.Ellipsis, onTextLayout = { layouts[1] = it })
                    }
                }
            }
            try {
                val png = settle(scene, ready)
                File(output, "transform-r$rotation-s$scale.png").writeBytes(png)
                assertTrue(layouts.all { it?.hasVisualOverflow == true })
                assertEquals(layouts[0]!!.size, layouts[1]!!.size)
                val bounds = textPaintBounds(layouts[0]!!.multiParagraph, layouts[0]!!.layoutInput.style)!!
                assertTrue(bounds.top > -100f && bounds.bottom < 100f, "The reference band must not touch any paint")
                val bitmap = ImageIO.read(ByteArrayInputStream(png))
                var ink = 0
                var maximumDifference = 0
                var totalDifference = 0L
                var minX = Int.MAX_VALUE
                var minY = Int.MAX_VALUE
                var maxX = Int.MIN_VALUE
                var maxY = Int.MIN_VALUE
                for (dy in -300 until 300) for (dx in -260 until 300) {
                    val expected = bitmap.getRGB(300 + dx, 400 + dy)
                    val actual = bitmap.getRGB(1000 + dx, 400 + dy)
                    if ((expected and 255) < 245) ink++
                    if (expected != -1 || actual != -1) {
                        minX = minOf(minX, dx); maxX = maxOf(maxX, dx)
                        minY = minOf(minY, dy); maxY = maxOf(maxY, dy)
                    }
                    for (shift in listOf(0, 8, 16)) {
                        val difference = abs(((expected ushr shift) and 255) - ((actual ushr shift) and 255))
                        maximumDifference = maxOf(maximumDifference, difference)
                        totalDifference += difference
                    }
                }
                assertTrue(ink > 10, "The unclipped paragraph oracle must contain visible paint")
                val meanDifference = totalDifference.toDouble() / ((maxX - minX + 1) * (maxY - minY + 1) * 3)
                report.appendLine("$rotation\t$scale\t$ink\t$maximumDifference\t$meanDifference")
                // Foundation clips before painting shadow/foreground; the independent
                // reference composites them without that antialiased interior edge.
                // Measured differences are <=13/255, MAE<=.097/255 and invisible at 1x.
                // These limits reject missing ink or a displaced/transformed width clip.
                assertTrue(maximumDifference <= 16 && meanDifference <= .15,
                    "Text rotation=$rotation scale=$scale lost ink or clip: max=$maximumDifference mean=$meanDifference")
            } finally { scene.close() }
        }
        File(output, "transforms.tsv").writeText(report.toString())
    }
}
