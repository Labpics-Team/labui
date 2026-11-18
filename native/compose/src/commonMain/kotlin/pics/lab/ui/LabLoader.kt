package pics.lab.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.dp
import kotlin.math.floor

/** Compact feedback: eight waiting spokes, a medium sector, or a large measured ring. */
@Composable
public fun LabLoader(
    value: Float? = null,
    modifier: Modifier = Modifier,
    min: Float = 0f,
    max: Float = 100f,
    label: String = "Загрузка",
    size: LabControlSize = LabControlSize.Medium,
) {
    val state = labProgressState(value, min, max)
    val motion = rememberLabProgressMotion(state, LabComponents.LoaderPeriodMs.toInt())
    val spokePose by remember(motion.phase) {
        derivedStateOf { floor(motion.phase.value * LabComponents.LoaderSpokeOpacity.size) }
    }
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.LoaderS
        LabControlSize.Medium -> LabComponents.LoaderM
        LabControlSize.Large -> LabComponents.LoaderL
    }
    val colors = LocalLabTheme.current.colors
    val primary = colors[LabComponents.LoaderColorRole]
    val secondary = colors[LabComponents.LoaderDeterminateMediumSecondaryRole]
    val track = colors[LabComponents.LoaderDeterminateLargeTrackRole]
    Box(modifier.size(metrics.diameter.dp).labProgressSemantics(state, label).drawWithCache {
        val unit = this.size.minDimension / LabComponents.LoaderViewBox
        val center = Offset(this.size.width / 2, this.size.height / 2)
        val segmentOrigin = Offset(LabComponents.LoaderSegmentX * unit, LabComponents.LoaderSegmentY * unit)
        val segmentSize = Size(LabComponents.LoaderSegmentWidth * unit, LabComponents.LoaderSegmentHeight * unit)
        val corner = CornerRadius(LabComponents.LoaderSegmentRadius * unit)
        val spokeColors = LabComponents.LoaderSpokeOpacity.map { primary.copy(alpha = primary.alpha * it) }
        val step = 360f / spokeColors.size
        val large = size == LabControlSize.Large
        val radius = (if (large) LabComponents.LoaderDeterminateLargeRingRadius else LabComponents.LoaderDeterminateMediumRingRadius) * unit
        val stroke = Stroke((if (large) LabComponents.LoaderDeterminateLargeStroke else LabComponents.LoaderDeterminateMediumStroke) * unit,
            cap = if (large && LabComponents.LoaderDeterminateLargeCap == "round") StrokeCap.Round else StrokeCap.Butt)
        val ringOrigin = center - Offset(radius, radius)
        val ringSize = Size(radius * 2, radius * 2)
        val sectorRadius = LabComponents.LoaderDeterminateMediumSectorRadius * unit
        val sectorOrigin = center - Offset(sectorRadius, sectorRadius)
        val sectorSize = Size(sectorRadius * 2, sectorRadius * 2)
        val sectorBrush = Brush.sweepGradient(0f to secondary,
            LabComponents.LoaderDeterminateMediumGradientPrimaryStop to primary,
            LabComponents.LoaderDeterminateMediumGradientSecondaryStop to secondary, center = center)
        val gradientRotation = LabComponents.LoaderDeterminateMediumGradientFromDegrees - 90f
        onDrawBehind {
            if (state.value == null) {
                val turn = if (motion.running) spokePose * step else 0f
                rotate(turn) {
                    for (index in spokeColors.indices) rotate(index * step) {
                        drawRoundRect(spokeColors[index], segmentOrigin, segmentSize, corner)
                    }
                }
            } else {
                val fraction = motion.fraction.value
                drawCircle(if (large) track else primary, radius, style = stroke)
                if (large) {
                    if (fraction >= 1f) drawCircle(primary, radius, style = stroke)
                    else if (fraction > 0f) drawArc(primary, -90f, fraction * 360f, false, ringOrigin, ringSize, style = stroke)
                } else if (fraction > 0f) rotate(gradientRotation) {
                    if (fraction >= 1f) drawCircle(sectorBrush, sectorRadius)
                    else drawArc(sectorBrush, -90f - gradientRotation, fraction * 360f, true, sectorOrigin, sectorSize)
                }
            }
        }
    })
}
