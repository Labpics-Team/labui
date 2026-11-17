package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.scale
import org.jetbrains.compose.resources.imageResource
import pics.lab.ui.resources.Res
import pics.lab.ui.resources.material_noise
import pics.lab.ui.resources.veil_noise

/** One repeating bitmap shader, with the authored pixel scale in dp and alpha baked into the asset. */
@Composable
internal fun Modifier.labNoise(opacity: Float = LabMaterials.noiseOpacity): Modifier {
    val strong = opacity > LabMaterials.noiseOpacity
    val bitmap = imageResource(if (strong) Res.drawable.veil_noise else Res.drawable.material_noise)
    val alpha = opacity / if (strong) LabMaterials.veilNoiseOpacity else LabMaterials.noiseOpacity
    return drawWithCache {
        val brush = ShaderBrush(ImageShader(bitmap, TileMode.Repeated, TileMode.Repeated))
        val pixelScale = LabMaterials.noisePixelSize * density
        onDrawWithContent {
            drawContent()
            scale(pixelScale, pixelScale, Offset.Zero) {
                drawRect(brush, size = Size(size.width / pixelScale, size.height / pixelScale),
                    alpha = alpha, blendMode = LabMaterials.noiseBlend)
            }
        }
    }
}
