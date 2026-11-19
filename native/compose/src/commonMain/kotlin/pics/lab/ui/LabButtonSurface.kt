package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp

/** Button and Drag Button share the authored gradient and inner edge. */
internal fun Modifier.labButtonSurface(shape: Shape, fill: Color, colors: LabColorOutput,
    decorated: Boolean, pressed: Boolean, hovered: Boolean): Modifier {
    val gradient = when {
        pressed -> colors["bg-static-dark"].copy(alpha = LabComponents.ButtonFillPressedShade)
        hovered -> colors["bg-static-light"].copy(alpha = LabComponents.ButtonFillHoverHighlight)
        else -> colors["bg-static-light"].copy(alpha = LabComponents.ButtonFillHighlight)
    }
    return clip(shape).background(fill).then(if (decorated) Modifier
        .background(Brush.verticalGradient(listOf(gradient, gradient.copy(alpha = 0f))))
        .innerShadow(shape, Shadow(radius = LabComponents.ButtonInnerShadowBlur.dp,
            color = colors["fx-control-inner"], offset = DpOffset(LabComponents.ButtonInnerShadowX.dp,
                (if (pressed) -LabComponents.ButtonInnerShadowY else LabComponents.ButtonInnerShadowY).dp)))
        else Modifier)
}
