package pics.lab.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeInput
import dev.chrisbanes.haze.HazeProgressive
import dev.chrisbanes.haze.HazeSourceSelection
import dev.chrisbanes.haze.blur.HazeBlurStyle
import dev.chrisbanes.haze.blur.hazeBlur

@Immutable
public data class LabVeilPass(val startRadius: Float, val radius: Float, val noiseOpacity: Float)

/** A progressive overlay samples only content behind the modal, never the modal or itself. */
@Composable
internal fun LabModalVeil(modifier: Modifier = Modifier) {
    val capture = LocalLabCapture.current
    val theme = LocalLabTheme.current
    val input = remember(capture) { HazeInput.Sources(capture, HazeSourceSelection.Behind.where { it.zIndex < 2f }) }
    Box(modifier) {
        if (!theme.preferences.reducedTransparency) {
            VeilLayers(LabVeils.overlayGhost, LabVeils.overlayGhost.lastIndex, input)
        }
        Box(Modifier.fillMaxSize().background(theme.colors["bg-overlay-ghost"]))
    }
}

@Composable
private fun VeilLayers(passes: List<LabVeilPass>, index: Int, source: HazeInput) {
    val pass = passes[index]
    val density = LocalDensity.current.density
    var dimensions by remember { mutableStateOf(IntSize.Zero) }
    val style = remember(pass, density, dimensions) {
        HazeBlurStyle {
            blurRadius(hazeRadius(pass.radius, density).dp)
            noiseFactor(0f)
            backgroundColor(Color.Transparent)
            progressive(HazeProgressive.LinearGradient(
                easing = LinearEasing,
                start = Offset(dimensions.width * LabVeils.startX, dimensions.height * LabVeils.startY),
                end = Offset(dimensions.width * LabVeils.endX, dimensions.height * LabVeils.endY),
                startIntensity = if (pass.radius == 0f) 0f else pass.startRadius / pass.radius,
                endIntensity = 1f,
            ))
        }
    }
    Box(Modifier.fillMaxSize().onSizeChanged { dimensions = it }.labNoise(pass.noiseOpacity)
        .hazeBlur(if (index == 0) source else HazeInput.Content, style)) {
        if (index > 0) VeilLayers(passes, index - 1, source)
    }
}
