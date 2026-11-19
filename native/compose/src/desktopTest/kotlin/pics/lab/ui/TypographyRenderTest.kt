package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Actual Choicebox content and bundled Geist, rendered without a window. */
class TypographyRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)

    @Test fun authoredRolesPreserveWholeStringMetricsAndChoiceboxWrapping() {
        val description = "Shared access to original materials and project history for every member of the workspace."
        val output = File("build/typography-render").apply { mkdirs() }
        val report = StringBuilder()
        for (scale in listOf(1f, 2f)) {
            val ready = AtomicBoolean(false)
            val theme = LabThemeState(initialLabColors(LabPreferences(reducedMotion = true)))
            val scene = ImageComposeScene(820, (370 * scale).toInt(), Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        BasicText("Authored typography", style = LabType.title())
                        LabChoicebox("shared", {}, listOf(LabChoiceboxItem("shared", "Shared workspace", description)),
                            layout = LabChoiceboxLayout.Row)
                        // Independent reference: saved source Text/M-Common 2008:12580.
                        BasicText(description, style = TextStyle(fontFamily = font, fontSize = 16.sp,
                            fontWeight = FontWeight.Normal, lineHeight = 24.sp, letterSpacing = (-0.25).sp))
                        BasicText("Caption", style = LabType.caption())
                    }
                }
            }
            try {
                var previous: ByteArray? = null
                var equal = 0
                var png: ByteArray? = null
                for (frame in 0 until 150) {
                    val current = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
                    equal = if (ready.get() && previous?.contentEquals(current) == true) equal + 1 else 0
                    if (equal >= 3) { png = current; break }
                    previous = current
                    Thread.sleep(10)
                }
                assertTrue(png != null, "Fonts and scene must settle")
                File(output, "choicebox-${(scale * 100).toInt()}.png").writeBytes(png)
                val layouts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }.flatMap { node ->
                    mutableListOf<TextLayoutResult>().also { node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it) }
                }
                val descriptions = layouts.filter { it.layoutInput.text.text == description }
                assertEquals(2, descriptions.size)
                val consumer = descriptions[0]
                val reference = descriptions[1]
                val actual = consumer.multiParagraph.intrinsics.maxIntrinsicWidth
                val expected = reference.multiParagraph.intrinsics.maxIntrinsicWidth
                assertTrue(abs(actual - expected) < 0.02f,
                    "Whole-string width must match authored Regular, scale=$scale: actual=$actual, reference=$expected")
                assertEquals((-0.25).sp, consumer.layoutInput.style.letterSpacing)
                assertEquals(FontWeight.Normal, consumer.layoutInput.style.fontWeight)
                assertEquals(24.sp, consumer.layoutInput.style.lineHeight)
                val label = layouts.single { it.layoutInput.text.text == "Shared workspace" }
                assertEquals(0.sp, label.layoutInput.style.letterSpacing)
                assertEquals(FontWeight.Medium, label.layoutInput.style.fontWeight)
                val headline = layouts.single { it.layoutInput.text.text == "Authored typography" }.layoutInput.style
                assertEquals(20.sp, headline.fontSize)
                assertEquals(20.sp, headline.lineHeight)
                assertEquals(FontWeight.Medium, headline.fontWeight)
                assertEquals((-0.33).sp, headline.letterSpacing)
                for (text in layouts) for (line in 0 until text.lineCount) {
                    assertTrue(text.getLineLeft(line) >= -1 && text.getLineRight(line) <= text.size.width + 1,
                        "Every rendered line must fit: ${text.layoutInput.text}")
                }
                report.appendLine("scale=$scale bodyWidth=$actual sourceWidth=$expected lines=${consumer.lineCount}")
            } finally { scene.close() }
        }
        File(output, "metrics.txt").writeText(report.toString())
    }
}
