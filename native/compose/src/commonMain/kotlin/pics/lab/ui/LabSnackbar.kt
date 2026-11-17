package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import kotlinx.coroutines.delay
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition
import kotlin.math.ceil
import kotlin.time.TimeSource

/** Authored feedback with hoisted visibility. A notification key restarts identical messages. */
@Composable
public fun LabSnackbar(
    message: String,
    modifier: Modifier = Modifier,
    open: Boolean = true,
    onDismiss: () -> Unit = {},
    durationMillis: Long = LabComponents.SnackbarDurationMs.toLong(),
    notificationKey: Any? = message,
    material: LabMaterial = LabMaterial.Solid,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    dismissOnAction: Boolean = true,
    actionPending: Boolean = false,
    restoreFocus: FocusRequester? = null,
) {
    require(durationMillis >= 0) { "Snackbar duration must be nonnegative" }
    if (!open) return
    val colors = LocalLabTheme.current.colors
    val accessibility = LocalAccessibilityManager.current
    val recommended = if (durationMillis == 0L) 0L else
        accessibility?.calculateRecommendedTimeoutMillis(durationMillis, containsText = true,
            containsControls = actionLabel != null) ?: durationMillis
    val duration = if (recommended == Long.MAX_VALUE) 0L else recommended
    val mark = remember { TimeSource.Monotonic.markNow() }
    val timer = remember(message, notificationKey, duration) {
        LabSnackbarTimer(duration) { mark.elapsedNow().inWholeMilliseconds }
    }
    var remaining by remember(timer) { mutableLongStateOf(duration) }
    val interactions = remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    var focused by remember { mutableStateOf(false) }
    val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val paused = hovered || focused || actionPending || lifecycle != Lifecycle.State.RESUMED
    val dismiss by rememberUpdatedState(onDismiss)
    LaunchedEffect(timer, paused) {
        timer.running(!paused)
        remaining = timer.remaining()
        if (duration == 0L || paused) return@LaunchedEffect
        try {
            while (remaining > 0) {
                delay(timer.nextChange())
                remaining = timer.remaining()
            }
            dismiss()
        } finally { timer.running(false) }
    }
    val motion = rememberLabMotion()
    val y = remember(motion) { motion.value(8f, "snackbar.entrance") }
    LaunchedEffect(motion) {
        motion.animate { to(y, 0f, MotionTransition.Tween(LabTokens.MotionEntranceDurationMs.toInt(),
            MotionEase.Bezier(LabTokens.MotionEntranceEase0, LabTokens.MotionEntranceEase1,
                LabTokens.MotionEntranceEase2, LabTokens.MotionEntranceEase3))) }
    }
    val textStyle = LabType.body().copy(
        fontSize = LabComponents.SnackbarFontSize.sp,
        lineHeight = LabComponents.SnackbarLineHeight.sp,
        fontWeight = FontWeight(LabComponents.SnackbarFontWeight.toInt()),
        letterSpacing = 0.sp,
    )
    val fontScale = LocalDensity.current.fontScale
    val timerSize = LabComponents.SnackbarTimerSize.dp * fontScale.coerceAtLeast(1f)
    val button = LabComponents.ButtonS
    val actionHeight = if (actionLabel == null) 0f else maxOf(button.height,
        maxOf(button.icon, button.lineHeight * fontScale) + button.paddingY * 2)
    // Preserve the one-line capsule's corners when text wraps. A radius of half
    // the entire multiline height would clip the content into an enormous oval.
    val rowHeight = maxOf(LabComponents.SnackbarLineHeight * fontScale, actionHeight,
        if (duration == 0L) 0f else timerSize.value)
    val radius = minOf(LabComponents.SnackbarRadius, rowHeight / 2 + LabComponents.SnackbarPaddingY)
    LabSurface(
        LabComponents.SnackbarMaterial,
        modifier.graphicsLayer { translationY = y.value * density }
            .hoverable(interactions).onFocusChanged { focused = it.hasFocus },
        material,
        RoundedCornerShape(radius.dp),
        strokeWidth = LabComponents.SnackbarStrokeWidth.dp,
        strokeColor = colors["border-base"],
    ) {
        Layout(
            modifier = Modifier.padding(start = LabComponents.SnackbarPaddingStart.dp,
                end = LabComponents.SnackbarPaddingEnd.dp,
                top = LabComponents.SnackbarPaddingY.dp, bottom = LabComponents.SnackbarPaddingY.dp),
            content = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(LabComponents.SnackbarLabelGap.dp),
                verticalAlignment = Alignment.CenterVertically) {
                if (duration != 0L) {
                    val seconds = ceil(remaining / 1000.0).toInt()
                    val poses = LabComponents.SnackbarTimerSweeps
                    val pose = ceil(remaining.toDouble() / duration * poses.size).toInt().coerceIn(1, poses.size)
                    val color = colors[if (seconds <= LabComponents.SnackbarTimerWarningSeconds)
                        "label-danger" else "label-accent"]
                    Box(Modifier.size(timerSize).clearAndSetSemantics {},
                        contentAlignment = Alignment.Center) {
                        Canvas(Modifier.matchParentSize()) {
                            val stroke = LabComponents.SnackbarTimerStrokeWidth.dp.toPx()
                            drawArc(color, -90f, -poses[poses.size - pose], false,
                                Offset(stroke / 2, stroke / 2), Size(size.width - stroke, size.height - stroke),
                                style = Stroke(stroke, cap = StrokeCap.Round))
                        }
                        BasicText(seconds.toString(), style = textStyle.copy(color = color))
                    }
                }
                key(notificationKey) {
                    BasicText(message, Modifier.weight(1f, fill = false)
                        .semantics { liveRegion = LiveRegionMode.Polite }, style = textStyle)
                }
            }
            if (actionLabel != null) LabButton(actionLabel, {
                onAction?.invoke()
                if (dismissOnAction) {
                    if (focused) restoreFocus?.requestFocus()
                    onDismiss()
                }
            }, kind = LabButtonKind.Ghost, intent = LabIntent.Accent,
                size = LabControlSize.Small, loading = actionPending)
            },
        ) { measurables, constraints ->
            val loose = constraints.copy(minWidth = 0, minHeight = 0)
            val action = measurables.getOrNull(1)?.measure(loose)
            val gap = if (action == null) 0 else LabComponents.SnackbarActionGap.dp.roundToPx()
            val naturalLabelWidth = measurables[0].maxIntrinsicWidth(Constraints.Infinity)
            val stacked = action != null && naturalLabelWidth.toLong() + gap + action.width > constraints.maxWidth
            val label = measurables[0].measure(loose.copy(maxWidth =
                if (stacked) constraints.maxWidth else (constraints.maxWidth - gap - (action?.width ?: 0)).coerceAtLeast(0)))
            val width = constraints.constrainWidth(if (stacked) constraints.maxWidth
                else label.width + gap + (action?.width ?: 0))
            val height = constraints.constrainHeight(if (stacked) label.height + gap + action.height
                else maxOf(label.height, action?.height ?: 0))
            layout(width, height) {
                label.placeRelative(0, if (stacked) 0 else (height - label.height) / 2)
                action?.placeRelative(width - action.width,
                    if (stacked) label.height + gap else (height - action.height) / 2)
            }
        }
    }
}
