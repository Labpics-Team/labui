package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.remember
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.unit.dp
import java.io.ByteArrayInputStream
import java.io.File
import javax.imageio.ImageIO
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Actual DialogSurface and a separate static LabSurface at the same current
 * bounds. Changing the bounds legitimately changes blur/refraction sampling;
 * opacity isolation or clipping the capture is never an acceptable substitute. */
class DialogMotionRenderTest {
    @Test fun onlyTheRevealedContentAcceptsPointerInput() {
        for (side in 0..3) for (progress in listOf(0f, .5f, 1f)) {
            var clicks = 0
            val preferences = LabPreferences(reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val scene = ImageComposeScene(320, 320) {
                LabTheme(theme) {
                    val motion = rememberLabMotion()
                    val reveal = remember { motion.value(progress) }
                    Box(Modifier.offset(60.dp, 60.dp).size(200.dp).dialogReveal(reveal) { side }) {
                        Box(Modifier.fillMaxSize().clickable { clicks++ })
                    }
                }
            }
            try {
                settle(scene)
                fun click(point: Offset) {
                    scene.sendPointerEvent(PointerEventType.Press, point)
                    scene.sendPointerEvent(PointerEventType.Release, point)
                    settle(scene)
                }
                val visible = when (side) {
                    0 -> Offset(160f, 210f)
                    1 -> Offset(110f, 160f)
                    2 -> Offset(160f, 110f)
                    else -> Offset(210f, 160f)
                }
                val hidden = Offset(320f - visible.x, 320f - visible.y)
                click(hidden)
                assertEquals(if (progress == 1f) 1 else 0, clicks,
                    "Unrevealed content must not receive clicks: side=$side p=$progress")
                click(visible)
                assertEquals(if (progress == 1f) 2 else if (progress > 0f) 1 else 0, clicks,
                    "The visible area remains interactive: side=$side p=$progress")
            } finally { scene.close() }
        }
    }

    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null
        var stable = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            stable = if (previous?.contentEquals(png) == true) stable + 1 else 0
            if (stable >= 4) return png
            previous = png
            Thread.sleep(10)
        }
        error("Dialog motion scene did not settle")
    }

    private fun render(appearance: LabAppearance, material: LabMaterial, progress: Float,
        reference: Boolean, changed: Boolean = false): ByteArray {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val scene = ImageComposeScene(800, 600) {
            LabTheme(theme) {
                val motion = rememberLabMotion()
                val reveal = remember { motion.value(progress) }
                LabScene(Modifier.fillMaxSize(), background = {
                    Canvas(Modifier.fillMaxSize()) {
                        val palette = if (changed) listOf(Color(0xff020408), Color(0xff091218))
                            else listOf(Color(0xff101010), Color(0xffeeeeee))
                        for (index in 0..100) drawRect(palette[index % 2],
                            Offset(index * 8f, 0f), Size(8f, size.height))
                    }
                }) {
                    if (reference) {
                        if (progress > 0) LabSurface(LabComponents.DialogMaterial,
                            Modifier.offset(160.dp, 170.dp).size(480.dp, (260 * progress).dp),
                            material, RoundedCornerShape(LabComponents.DialogRadius.dp),
                            strokeWidth = LabComponents.DialogStrokeWidth.dp,
                            strokeColor = theme.colors[LabComponents.DialogRolesBorder]) {}
                    } else DialogSurface("Are you absolutely sure?",
                        "This action cannot be undone. This will permanently delete your account and remove your data from our servers.",
                        material, Modifier.offset(160.dp, 170.dp).size(480.dp, 260.dp),
                        LabComponents.DialogPadding.dp, false, "Close", {}, null, null, reveal)
                }
            }
        }
        return try { settle(scene) } finally { scene.close() }
    }

    @Test fun intermediateMaterialsMatchTheirStaticShapeAndKeepTheSceneLive() {
        val output = File("build/dialog-motion-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (material in LabMaterial.entries) {
            var previous: Int? = null
            for (changed in listOf(false, true)) for (progress in listOf(0f, .25f, .5f, .75f, 1f)) {
                val actualBytes = render(appearance, material, progress, false, changed)
                val actual = ImageIO.read(ByteArrayInputStream(actualBytes))
                val expected = ImageIO.read(ByteArrayInputStream(render(appearance, material, progress, true, changed)))
                output.resolve("${appearance.name}-${material.name}-$progress-$changed.png").writeBytes(actualBytes)
                for (y in 188..199) {
                    val a = actual.getRGB(176, y); val e = expected.getRGB(176, y)
                    for (shift in listOf(0, 8, 16)) assertTrue(abs((a shr shift and 255) - (e shr shift and 255)) <= 2,
                        "$appearance $material p=$progress changed=$changed at176,$y: actual=$a reference=$e")
                }
                assertEquals(expected.getRGB(400, 160), actual.getRGB(400, 160), "No painting outside the panel")
                if (progress == .5f && material != LabMaterial.Solid) {
                    if (changed) assertTrue(previous != actual.getRGB(176, 194), "Material sees the changed scene")
                    else previous = actual.getRGB(176, 194)
                }
            }
        }
    }
}
