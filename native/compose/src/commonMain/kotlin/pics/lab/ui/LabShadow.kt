package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

@Immutable
public data class LabShadowLayer(
    val x: Float, val y: Float, val blur: Float, val spread: Float,
    val colorRole: String, val opacity: Float,
)

/** The shared stack is ordered from the nearest ply to the farthest, as in CSS box-shadow. */
@Composable
internal fun Modifier.labShadow(shape: Shape, layers: List<LabShadowLayer>): Modifier {
    val theme = LocalLabTheme.current
    val density = LocalDensity.current.density
    val dark = if (theme.preferences.appearance == LabAppearance.Dark) LabShadows.darkAlphaMultiplier else 1f
    val radians = LabShadows.lightAngle * PI / 180
    return layers.asReversed().fold(this) { modifier, layer ->
        // Compose's mask filter maps positive radius to sigma = .57735 * radius + .5.
        val sigma = layer.blur * density / 2f
        val radius = if (sigma <= 0f) 0f else ((sigma - .5f) / .57735f).coerceAtLeast(.0001f) / density
        modifier.dropShadow(shape, Shadow(
            radius = radius.dp,
            color = theme.colors[layer.colorRole],
            alpha = (layer.opacity * dark).coerceIn(0f, 1f),
            spread = layer.spread.dp,
            offset = DpOffset((layer.x + sin(radians).toFloat() * layer.y).dp, (cos(radians).toFloat() * layer.y).dp),
        ))
    }
}
