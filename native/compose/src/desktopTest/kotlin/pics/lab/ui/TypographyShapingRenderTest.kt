package pics.lab.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.sp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Independent browser measurements use the same pinned font and public typography roles. */
class TypographyShapingRenderTest {
    private data class Sample(val id: String, val role: String, val tracking: Float, val text: String,
        val chromium: Float, val webkit: Float)

    @Test fun nativeRolesAndTrackingOverridesMatchBrowserShaping() {
        val samples = javaClass.getResourceAsStream("/typography-shaping.tsv")!!.bufferedReader().useLines { lines ->
            lines.drop(1).map { line ->
                val fields = line.split('\t')
                Sample(fields[0], fields[1], fields[2].toFloat(), fields[3], fields[4].toFloat(), fields[5].toFloat())
            }.toList()
        }
        val report = StringBuilder()
        for (scale in listOf(1f, 2f)) {
            val ready = AtomicBoolean(false)
            val measured = mutableMapOf<String, TextLayoutResult>()
            val theme = LabThemeState(initialLabColors(LabPreferences(reducedMotion = true)))
            val scene = ImageComposeScene(1600, 900, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column {
                        for (sample in samples) {
                            val role = when (sample.role) {
                                "body" -> LabType.body()
                                "body-emphasized" -> LabType.emphasized()
                                "headline" -> LabType.title()
                                "caption-xs" -> LabType.caption()
                                else -> error("Unknown source role ${sample.role}")
                            }
                            val style = if (role.letterSpacing != sample.tracking.sp)
                                role.withTypography(letterSpacing = sample.tracking.sp) else role
                            BasicText(sample.text, style = style, softWrap = false,
                                onTextLayout = { measured[sample.id] = it })
                        }
                        // The public component must apply the same rule after selecting its panel style.
                        LabAccordion(listOf("source"), {}, listOf(LabAccordionItem("source", samples.first { it.id == "emphasized" }.text))) {
                            LabAccordionText(samples.first().text)
                        }
                    }
                }
            }
            try {
                var previous: ByteArray? = null
                var settled = 0
                for (frameIndex in 0 until 100) {
                    val frame = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
                    settled = if (ready.get() && previous?.contentEquals(frame) == true) settled + 1 else 0
                    previous = frame
                    if (settled >= 3) break
                    Thread.sleep(5)
                }
                assertTrue(settled >= 3, "The font and actual paragraph must settle")
                assertEquals(samples.size, measured.size)
                for (sample in samples) {
                    val paragraph = measured.getValue(sample.id)
                    val cssWidth = paragraph.getLineRight(0) / scale
                    assertTrue(abs(cssWidth - sample.chromium) < 0.06f && abs(cssWidth - sample.webkit) < 0.06f,
                        "${sample.id} at $scale: native=$cssWidth, Chromium=${sample.chromium}, WebKit=${sample.webkit}")
                    report.appendLine("${sample.id}\tscale=$scale\tnativeCssWidth=$cssWidth\tChromium=${sample.chromium}\tWebKit=${sample.webkit}\tbaseline=${paragraph.firstBaseline / scale}\tparagraphHeight=${paragraph.size.height / scale}")
                }
                val texts = scene.semanticsOwners.flatMap { owner -> collect(owner.unmergedRootSemanticsNode) }
                val panel = texts.last { it.layoutInput.text.text == samples.first().text }
                assertTrue(abs(panel.getLineRight(0) / scale - samples.first().chromium) < 0.06f,
                    "The public Accordion panel must use resolved shaping")
                report.appendLine("accordion-panel\tscale=$scale\tbaselineInParagraph=${panel.firstBaseline / scale}\tparagraphHeight=${panel.size.height / scale}\tauthoredLineHeight=${panel.layoutInput.style.lineHeight}")
                val emphasized = samples.first { it.id == "emphasized" }
                val heading = texts.last { it.layoutInput.text.text == emphasized.text }
                assertTrue(abs(heading.getLineRight(0) / scale - emphasized.chromium) < 0.06f,
                    "The public Accordion heading must restore the normal ligatures of zero tracking")
            } finally { scene.close() }
        }
        File("build/typography-render").mkdirs()
        File("build/typography-render/shaping.txt").writeText(report.toString())
    }

    private fun collect(node: androidx.compose.ui.semantics.SemanticsNode): List<TextLayoutResult> {
        val result = mutableListOf<TextLayoutResult>()
        if (node.config.contains(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult))
            node.config[androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult].action?.invoke(result)
        return result + node.children.flatMap(::collect)
    }
}
