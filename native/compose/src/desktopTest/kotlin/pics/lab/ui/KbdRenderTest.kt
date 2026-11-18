package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** CPU offscreen evidence: real packaged Geist, no window or native solver process. */
class KbdRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)

    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean): ByteArray {
        var previous: ByteArray? = null
        var equalFrames = 0
        repeat(100) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equalFrames = if (ready.get() && previous?.contentEquals(bytes) == true) equalFrames + 1 else 0
            if (equalFrames >= 4) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("Kbd scene did not settle")
    }

    @Test fun authoredKeysKeepTypographyGeometryAndTextAtEveryScale() {
        val output = File("build/kbd-render").apply { mkdirs() }
        val keys = listOf("⌘", "⇧", "C", "V")
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val theme = LabThemeState(initialLabColors(LabPreferences(appearance = appearance)))
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(900, 240, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        for (size in LabKbdSize.entries) Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                            for (count in 1..4) LabKbd(keys.take(count), Modifier.testTag("${size.name}-$count"), size)
                            LabKbd(listOf("Ctrl", "Shift", "Enter"), Modifier.testTag("${size.name}-long"), size)
                        }
                        LabKbd("Escape", Modifier.testTag("single"))
                    }
                }
            }
            try {
                val png = settle(scene, ready)
                File(output, "kbd-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(png)
                val nodes = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
                assertTrue(nodes.none { it.config.contains(SemanticsActions.OnClick) ||
                    it.config.contains(SemanticsActions.RequestFocus) || it.config.contains(SemanticsProperties.Role) })
                for (size in LabKbdSize.entries) for (count in 1..4) {
                    val node = nodes.single { it.config.getOrNull(SemanticsProperties.TestTag) == "${size.name}-$count" }
                    assertEquals(keys.take(count), node.config[SemanticsProperties.Text].map { it.text })
                    val height = if (size == LabKbdSize.Small) 12 * scale + 4 else 24 * scale
                    assertTrue(abs(height - node.size.height) <= 1, "${size.name}: expected height $height, got ${node.size.height}")
                    if (scale == 1f) {
                        val width = (if (size == LabKbdSize.Small) 16 else 24) * count + 2 * (count - 1)
                        assertEquals(width, node.size.width, "Author width ${size.name}-$count")
                    }
                }
                val layouts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                    .flatMap { node -> mutableListOf<TextLayoutResult>().also {
                        node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it)
                    } }
                assertEquals(27, layouts.size)
                for (layout in layouts) {
                    assertEquals(FontWeight.Medium, layout.layoutInput.style.fontWeight)
                    assertEquals(theme.colors[LabComponents.KbdLabelRole], layout.layoutInput.style.color)
                    // With TextOverflow.Visible Skia retains the paragraph's available
                    // width, so didOverflowWidth compares it with the tight text box.
                    assertTrue(layout.multiParagraph.intrinsics.maxIntrinsicWidth <= layout.size.width + .01f,
                        "The complete key name must fit its measured box: ${layout.layoutInput.text}")
                    assertFalse(layout.isLineEllipsized(0))
                    assertEquals(androidx.compose.ui.text.style.TextOverflow.Visible, layout.layoutInput.overflow)
                }
                for (node in nodes.filter { it.config.contains(SemanticsProperties.TestTag) }) {
                    assertTrue(node.positionInRoot.x + node.size.width <= 900, "The entire shortcut stays visible")
                }
                File(output, "kbd-${appearance.name.lowercase()}-${(scale * 100).toInt()}.json").writeText(
                    "{\"appearance\":\"${appearance.name}\",\"fontScale\":$scale,\"keys\":[" +
                        nodes.filter { it.config.contains(SemanticsProperties.TestTag) }.joinToString(",") { node ->
                            "{\"name\":\"${node.config[SemanticsProperties.TestTag]}\",\"x\":${node.positionInRoot.x}," +
                                "\"y\":${node.positionInRoot.y},\"width\":${node.size.width},\"height\":${node.size.height}}"
                        } + "]}\n")
            } finally { scene.close() }
        }
    }

    @Test fun sourceScaleCapturesUseTheAuthoredPaintAndRealText() {
        val output = File("build/kbd-render").apply { mkdirs() }
        val neutral = Color(120 / 255f, 120 / 255f, 128 / 255f)
        val theme = LabThemeState(LabColorOutput(mapOf(
            "label-primary" to Color.Black,
            "label-secondary" to Color(60 / 255f, 60 / 255f, 67 / 255f, .72f),
            "fill-tertiary" to neutral.copy(alpha = .12f),
            "fill-quaternary" to neutral.copy(alpha = .08f),
            "fill-none" to neutral.copy(alpha = 0f),
            "border-base" to neutral.copy(alpha = .16f),
            "border-soft" to neutral.copy(alpha = .08f),
        )))
        for (size in LabKbdSize.entries) {
            val large = size == LabKbdSize.Large
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(if (large) 72 else 48, if (large) 78 else 51, Density(3f)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) { LabKbd("⌘", size = size) }
            }
            try {
                File(output, "kbd-source-${size.name.lowercase()}-3x.png").writeBytes(settle(scene, ready))
            } finally { scene.close() }
        }
    }
}
