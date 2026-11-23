package pics.lab.ui

import androidx.compose.ui.geometry.Offset
import kotlin.math.max

/** One center mapping for paint and pointer hit testing. */
internal fun colorTrackCenter(fraction: Double, width: Float, inset: Float): Float =
    inset + (width - 2 * inset).coerceAtLeast(0f) * fraction.coerceIn(0.0, 1.0).toFloat()
internal fun colorTrackFraction(position: Float, width: Float, inset: Float): Double =
    ((position - inset) / (width - 2 * inset).coerceAtLeast(1f)).toDouble()

/** The graph keeps its full coordinate domain; the inset marker is a drag handle. */
internal fun colorPlaneMarker(x: Double, y: Double, width: Float, height: Float, radius: Float): Offset = Offset(
    (x.coerceIn(0.0, 1.0).toFloat() * width).coerceIn(radius, max(radius, width - radius)),
    ((1 - y).coerceIn(0.0, 1.0).toFloat() * height).coerceIn(radius, max(radius, height - radius)),
)
