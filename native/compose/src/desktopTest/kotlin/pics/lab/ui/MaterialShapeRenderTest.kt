package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.ByteArrayInputStream
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/** The material effect and its content share a shape; outside decoration does not. */
class MaterialShapeRenderTest {
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
        error("Material scene did not settle")
    }

    private fun render(appearance: LabAppearance, density: Int, material: LabMaterial?): ByteArray {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val scene = ImageComposeScene(320 * density, 256 * density, Density(density.toFloat())) {
            LabTheme(theme) {
                LabScene(Modifier.fillMaxSize(), background = {
                    Canvas(Modifier.fillMaxSize()) {
                        val stripe = 16.dp.toPx()
                        val palette = listOf(Color.White, Color.Black, Color.Blue, Color.Red)
                        for (index in 0..20) drawRect(palette[index % palette.size],
                            Offset(index * stripe, 0f), Size(stripe, size.height))
                    }
                }) {
                    if (material != null) Box(Modifier.padding(64.dp)) {
                        LabSurface(LabMaterials.elevated, Modifier.size(160.dp, 120.dp), material,
                            RoundedCornerShape(32.dp)) {}
                    }
                }
            }
        }
        return try { settle(scene) } finally { scene.close() }
    }

    @Test fun materialCannotPaintOutsideAnyRoundedCorner() {
        val output = File("build/material-shape-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (density in listOf(1, 2)) {
            val backdrop = ImageIO.read(ByteArrayInputStream(render(appearance, density, null)))
            for (material in LabMaterial.entries) {
                val png = render(appearance, density, material)
                output.resolve("${appearance.name}-${material.name}-${density}x.png").writeBytes(png)
                val surface = ImageIO.read(ByteArrayInputStream(png))
                val radius = 32 * density
                for (dy in 0 until radius) for (dx in 0 until radius) {
                    val xDistance = radius - dx - .5
                    val yDistance = radius - dy - .5
                    // Leave two physical pixels around the antialiased outline.
                    if (xDistance * xDistance + yDistance * yDistance <= (radius + 2.0) * (radius + 2.0)) continue
                    for (x in listOf(64 * density + dx, 224 * density - 1 - dx)) {
                        for (y in listOf(64 * density + dy, 184 * density - 1 - dy)) {
                            assertEquals(backdrop.getRGB(x, y), surface.getRGB(x, y),
                                "$material $appearance ${density}x painted outside its shape at $x,$y")
                        }
                    }
                }
            }
        }
    }

    @Test fun clippingTheMaterialKeepsItsOutsideStrokeAndShadow() {
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val scene = ImageComposeScene(320, 256) {
            LabTheme(theme) {
                LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(Color.White)) }) {
                    Box(Modifier.padding(64.dp)) {
                        LabSurface(LabMaterials.elevated, Modifier.size(160.dp, 120.dp), LabMaterial.Acrylic,
                            RoundedCornerShape(32.dp),
                            shadows = listOf(LabShadowLayer(0f, 0f, 16f, 0f, "label-primary", .8f)),
                            strokeWidth = 4.dp, strokeColor = Color.Red) {}
                    }
                }
            }
        }
        try {
            val png = settle(scene)
            File("build/material-shape-evidence/outside-decoration.png").apply { parentFile.mkdirs() }.writeBytes(png)
            val surface = ImageIO.read(ByteArrayInputStream(png))
            assertEquals(0xffff0000.toInt(), surface.getRGB(144, 62), "The stroke stays outside the original outline")
            assertNotEquals(0xffffffff.toInt(), surface.getRGB(144, 192), "The shadow stays outside the shape clip")
        } finally { scene.close() }
    }
}
