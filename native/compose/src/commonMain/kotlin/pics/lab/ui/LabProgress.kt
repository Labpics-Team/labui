package pics.lab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import kotlin.math.roundToInt
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition
import pics.lab.motion.MotionValue

public enum class LabProgressVariant { Linear, Circular }

/** A finite measured value, or honestly unknown progress. Bounds are never inferred from a percentage. */
internal data class LabProgressState(val value: Float?, val min: Float, val max: Float, val fraction: Float) {
    val text: String get() = if (value == null) "" else "${(fraction * 100).roundToInt()}%"
    val rangeInfo: ProgressBarRangeInfo get() = if (value == null) ProgressBarRangeInfo.Indeterminate
        else ProgressBarRangeInfo(value, min..max)
}

internal fun labProgressState(value: Float?, min: Float, max: Float): LabProgressState {
    val validRange = min.isFinite() && max.isFinite() && max > min
    if (!validRange || value == null || !value.isFinite())
        return LabProgressState(null, if (validRange) min else 0f, if (validRange) max else 100f, 0f)
    val clamped = value.coerceIn(min, max)
    // Double retains the full span even when finite Float bounds straddle ±Float.MAX_VALUE.
    val fraction = ((clamped.toDouble() - min) / (max.toDouble() - min)).toFloat()
    return LabProgressState(clamped, min, max, fraction)
}

internal fun Modifier.labProgressSemantics(state: LabProgressState, label: String): Modifier = semantics(mergeDescendants = true) {
    contentDescription = label
    progressBarRangeInfo = state.rangeInfo
    if (state.value != null) stateDescription = state.text
}

internal class LabProgressMotion(val fraction: MotionValue, val phase: MotionValue, val running: Boolean)

/** Draw-phase reads keep animated poses out of composition. Both tracks use the shared Lab Motion lifecycle. */
@Composable
internal fun rememberLabProgressMotion(state: LabProgressState, periodMillis: Int): LabProgressMotion {
    val reduced = LocalLabTheme.current.preferences.reducedMotion
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val running = !reduced && lifecycle == Lifecycle.State.RESUMED
    val valueMotion = rememberLabMotion()
    val busyMotion = rememberLabMotion()
    val fraction = remember(valueMotion) { valueMotion.value(state.fraction, "progress.value") }
    val phase = remember(busyMotion) { busyMotion.value(0f, "progress.waiting") }
    LaunchedEffect(state.value, state.fraction, running) {
        if (state.value != null) {
            val playback = valueMotion.animate {
                to(fraction, state.fraction, MotionTransition.Tween(LabTokens.MotionTransitionDurationMs.toInt(),
                    MotionEase.Bezier(LabTokens.MotionTransitionEase0, LabTokens.MotionTransitionEase1,
                        LabTokens.MotionTransitionEase2, LabTokens.MotionTransitionEase3)))
            }
            if (!running) playback.finish()
            try { playback.finished.await() } finally { playback.stop() }
        }
    }
    LaunchedEffect(state.value == null, running, periodMillis) {
        if (state.value == null && running) {
            while (true) {
                busyMotion.animate { to(phase, 0f, MotionTransition.Tween(0)) }.finish()
                val playback = busyMotion.animate { to(phase, 1f, MotionTransition.Tween(periodMillis, MotionEase.Linear)) }
                try { playback.finished.await() } finally { playback.stop() }
            }
        }
    }
    return remember(fraction, phase, running) { LabProgressMotion(fraction, phase, running) }
}

/**
 * Authored linear/circular progress. Null, non-finite values and invalid bounds remain indeterminate;
 * finite values clamp to the range. [showValueText] only controls the visible percentage.
 */
@Composable
public fun LabProgress(
    value: Float? = null,
    modifier: Modifier = Modifier,
    min: Float = 0f,
    max: Float = 100f,
    label: String = "",
    size: LabControlSize = LabControlSize.Medium,
    variant: LabProgressVariant = LabProgressVariant.Linear,
    showValueText: Boolean = false,
) {
    val state = labProgressState(value, min, max)
    val motion = rememberLabProgressMotion(state, LabComponents.ProgressUnknownPeriodMs.toInt())
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.ProgressS
        LabControlSize.Medium -> LabComponents.ProgressM
        LabControlSize.Large -> LabComponents.ProgressL
    }
    val colors = LocalLabTheme.current.colors
    val active = colors[LabComponents.ProgressActiveRole]
    val track = colors[LabComponents.ProgressTrackRole]
    val textStyle = LabType.body().copy(color = colors[LabComponents.ProgressCircularLabelRole],
        fontSize = LabComponents.ProgressCircularFontSize.sp, lineHeight = LabComponents.ProgressCircularLineHeight.sp,
        fontWeight = FontWeight(LabComponents.ProgressCircularFontWeight.toInt()),
        letterSpacing = LabComponents.ProgressCircularLetterSpacing.sp)
    val showText = showValueText && state.value != null
    val circular = variant == LabProgressVariant.Circular
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val fontScale = LocalDensity.current.fontScale
    val outer = modifier.labProgressSemantics(state, label.ifBlank { "Ход выполнения" })
        .then(if (circular) Modifier else Modifier.fillMaxWidth())
    Column(outer, horizontalAlignment = if (circular) Alignment.CenterHorizontally else Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(LabTokens.Space2.dp)) {
        if (label.isNotBlank() || (!circular && showText)) {
            Row(if (circular) Modifier else Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(LabTokens.Space2.dp), verticalAlignment = Alignment.CenterVertically) {
                if (label.isNotBlank()) BasicText(label,
                    (if (circular) Modifier else Modifier.weight(1f)).clearAndSetSemantics {}, style = textStyle)
                else if (!circular) Box(Modifier.weight(1f))
                if (!circular && showText) BasicText(state.text, Modifier.clearAndSetSemantics {}, style = textStyle)
            }
        }
        if (circular) {
            val diameter = metrics.circularDiameter * if (showText) maxOf(1f, fontScale) else 1f
            Box(Modifier.size(diameter.dp).drawWithCache {
                val strokeWidth = metrics.circularStroke.dp.toPx()
                val radius = (this.size.minDimension - strokeWidth) / 2
                val stroke = Stroke(strokeWidth, cap = if (LabComponents.ProgressCircularCap == "round") StrokeCap.Round else StrokeCap.Butt)
                val bounds = Size(radius * 2, radius * 2)
                val origin = Offset(this.size.width / 2 - radius, this.size.height / 2 - radius)
                onDrawBehind {
                    drawCircle(track, radius, style = stroke)
                    val fraction = if (state.value == null) LabComponents.ProgressUnknownFraction else motion.fraction.value
                    if (fraction >= 1f) drawCircle(active, radius, style = stroke)
                    else if (fraction > 0f) drawArc(active,
                        startAngle = -90f + if (state.value == null && motion.running) motion.phase.value * 360f else 0f,
                        sweepAngle = fraction * 360f, useCenter = false, topLeft = origin, size = bounds, style = stroke)
                }
            }, contentAlignment = Alignment.Center) {
                if (showText) BasicText(state.text, Modifier.clearAndSetSemantics {}, style = textStyle)
            }
        } else Box(Modifier.fillMaxWidth().height(metrics.thickness.dp).drawWithCache {
            val radius = CornerRadius(LabComponents.ProgressRadius.dp.toPx())
            val clip = Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, this@drawWithCache.size.width,
                this@drawWithCache.size.height, radius)) }
            onDrawBehind {
                drawRoundRect(track, cornerRadius = radius)
                val width = this.size.width
                val part = if (state.value == null) LabComponents.ProgressUnknownFraction else motion.fraction.value
                val length = width * part
                if (length > 0f) clipPath(clip) {
                    val offset = if (state.value == null) -length + (width + length) * if (motion.running) motion.phase.value else .5f
                        else 0f
                    drawRoundRect(active, topLeft = Offset(if (rtl) width - length - offset else offset, 0f),
                        size = Size(length, this.size.height), cornerRadius = radius)
                }
            }
        })
    }
}
