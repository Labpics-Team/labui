package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeInput
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.blur.HazeBlurStyle
import dev.chrisbanes.haze.blur.hazeBlur
import dev.chrisbanes.haze.glass.GlassOptics
import dev.chrisbanes.haze.glass.GlassStyle
import dev.chrisbanes.haze.glass.OpticalSizeValue
import dev.chrisbanes.haze.glass.RefractionProfile
import dev.chrisbanes.haze.glass.SurfaceProfile
import dev.chrisbanes.haze.glass.hazeGlass
import dev.chrisbanes.haze.hazeSource
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

public enum class LabMaterial {
    Solid,
    Acrylic,
    Glass,
}

/** Renderer-neutral material channels. Shape and theme are independent axes. */
@Immutable
public data class LabMaterialRecipe(
    val solidRole: String,
    val normalRole: String,
    val blendRole: String,
    val backdropRadius: Float,
    val frost: Float,
    val depth: Float,
    val refraction: Float,
    val dispersion: Float,
    val lightAngle: Float,
    val lightIntensity: Float,
)

internal val LocalLabCapture =
    staticCompositionLocalOf<HazeState> { error("Wrap surfaces in LabScene") }

/** The retained source belongs to this scene and is disposed with it. */
@Composable
public fun LabScene(
    modifier: Modifier = Modifier,
    background: @Composable BoxScope.() -> Unit,
    content: @Composable BoxScope.() -> Unit,
) {
    val capture = remember { HazeState() }
    CompositionLocalProvider(LocalLabCapture provides capture) {
        Box(modifier) {
            Box(Modifier.matchParentSize().hazeSource(capture), content = background)
            content()
        }
    }
}

@Composable
public fun LabCard(
    recipe: LabMaterialRecipe,
    modifier: Modifier = Modifier,
    material: LabMaterial = LabMaterial.Solid,
    padding: PaddingValues = PaddingValues(LabComponents.CardPadding.dp),
    content: @Composable BoxScope.() -> Unit,
) {
    LabSurface(
        recipe,
        modifier,
        material,
        RoundedCornerShape(LabComponents.CardRadius.dp),
        LabShadows.resting,
    ) {
        Box(Modifier.padding(padding), content = content)
    }
}

@Composable
internal fun LabSurface(
    recipe: LabMaterialRecipe,
    modifier: Modifier,
    material: LabMaterial,
    shape: RoundedCornerShape,
    shadows: List<LabShadowLayer> = emptyList(),
    strokeWidth: Dp = 0.dp,
    strokeColor: Color = Color.Unspecified,
    content: @Composable BoxScope.() -> Unit,
) {
    val theme = LocalLabTheme.current
    val capture = LocalLabCapture.current
    val colors = theme.colors
    val solid = colors[recipe.solidRole]
    val tint = colors[recipe.normalRole]
    val blend = colors[recipe.blendRole]
    val blendMode =
        if (theme.preferences.appearance == LabAppearance.Light) LabMaterials.lightPaintBlend
        else LabMaterials.darkPaintBlend
    val density = LocalDensity.current.density
    val reduced = theme.preferences.reducedTransparency
    val input = remember(capture) { HazeInput.Sources(capture) }
    val glass =
        remember(recipe, shape, density) {
            GlassStyle {
                shape(shape)
                backgroundColor(Color.Transparent)
                tint(Color.Transparent)
                optics(
                    GlassOptics(
                        refractionStrength = recipe.refraction,
                        refractionHeightFraction = 1f,
                        refractionDisplacement = recipe.depth.dp,
                        depth = OpticalSizeValue.Fixed(1f),
                        blurRadius = OpticalSizeValue.Fixed(hazeRadius(recipe.frost, density).dp),
                        refractionFoldStrength = 0f,
                        refractionDetailIntensity = 0f,
                        refractionProfile = RefractionProfile.Surface,
                    )
                )
                surfaceProfile(SurfaceProfile.Squircle)
                specularIntensity(recipe.lightIntensity)
                ambientResponse(0f)
                edgeShadow(Color.Transparent)
                edgeSoftness(0.dp)
                chromaticAberrationStrength(recipe.dispersion)
                lightPosition(
                    BiasAlignment(
                        cos(recipe.lightAngle * PI / 180).toFloat(),
                        sin(recipe.lightAngle * PI / 180).toFloat(),
                    )
                )
                contrast(0f)
                whitePoint(0f)
                chromaMultiplier(1f)
                contentNormalBlend(0f)
                // No Haze interaction blocks: Lab Motion exclusively executes interaction effects.
            }
        }
    val acrylic =
        remember(recipe, density) {
            HazeBlurStyle {
                blurRadius(hazeRadius(recipe.backdropRadius, density).dp)
                noiseFactor(0f)
                backgroundColor(Color.Transparent)
            }
        }
    val shadowed =
        modifier.labShadow(shape, shadows).labOutsideStroke(shape, strokeWidth, strokeColor)
    // Solid and Glass paint their own shape. Blur paints a rectangle, so its clip
    // must wrap the effect. Outside decoration stays outside every material clip.
    val painted =
        when {
            reduced || material == LabMaterial.Solid -> shadowed.background(solid, shape).clip(shape)
            material == LabMaterial.Glass -> shadowed.hazeGlass(input, glass).clip(shape)
            else -> shadowed.clip(shape).hazeBlur(input, acrylic)
        }
    val paints =
        if (reduced || material == LabMaterial.Solid) painted
        else
            painted.drawWithContent {
                drawRect(tint)
                drawRect(blend, blendMode = blendMode)
                drawContent()
            }
    Box(paints) {
        if (!reduced && material != LabMaterial.Solid) Box(Modifier.matchParentSize().labNoise())
        content()
    }
}

/** Figma radius is twice sigma; Haze 2.1 converts its physical radius to Skia sigma. */
internal fun hazeRadius(figmaRadius: Float, density: Float): Float {
    val sigma = figmaRadius * .5f * density
    return (if (sigma <= 1.07735f) sigma / 1.07735f else (sigma - .5f) / .57735f) / density
}
