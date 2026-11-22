package pics.lab.ui

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionResult
import pics.lab.motion.MotionTransition
import pics.lab.motion.MotionValue
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

/** The platform window remains present through exit so modality and focus agree
 * with the visible surface. Reopening retargets the same reveal value.
 */
@Composable
internal fun rememberDialogPresence(open: Boolean): Pair<Boolean, MotionValue> {
    val motion = rememberLabMotion()
    val reveal = remember(motion) { motion.value(0f, "dialog.reveal") }
    val reduced = LocalLabTheme.current.preferences.reducedMotion
    var present by remember { mutableStateOf(open) }
    LaunchedEffect(open, reduced) {
        if (open) present = true
        if (!present) return@LaunchedEffect
        val target = if (open) 1f else 0f
        val duration = (if (open) LabTokens.MotionEntranceDurationMs else LabTokens.MotionExitDurationMs) * abs(target - reveal.value)
        val ease = if (open) MotionEase.Bezier(LabTokens.MotionEntranceEase0, LabTokens.MotionEntranceEase1,
            LabTokens.MotionEntranceEase2, LabTokens.MotionEntranceEase3)
            else MotionEase.Bezier(LabTokens.MotionExitEase0, LabTokens.MotionExitEase1,
                LabTokens.MotionExitEase2, LabTokens.MotionExitEase3)
        val playback = motion.animate {
            to(reveal, target, MotionTransition.Tween(if (reduced) 0 else duration.toInt(), ease))
        }
        val result = try { playback.finished.await() } finally { playback.stop() }
        if (!open && result == MotionResult.Finished) present = false
    }
    return present to reveal
}

private fun revealBounds(width: Float, height: Float, progress: Float, direction: Int): Rect {
    val horizontal = direction == 1 || direction == 3
    val visibleWidth = width * if (horizontal) progress else 1f
    val visibleHeight = height * if (horizontal) 1f else progress
    val left = if (direction == 3) width - visibleWidth else 0f
    val top = if (direction == 0) height - visibleHeight else 0f
    return Rect(left, top, left + visibleWidth, top + visibleHeight)
}

/** Geometric reveal keeps text at its final size while the material opens.
 * The direction is the resolved popup side: top/right/bottom/left. A Dialog
 * unfolds downwards from its heading, which becomes readable first.
 * At rest clipping is released, preserving consumer shadows and focus outlines. */
internal fun Modifier.dialogReveal(reveal: MotionValue, side: () -> Int): Modifier = graphicsLayer {
    val progress = reveal.value.coerceIn(0f, 1f)
    // A layer shape also clips pointer hit-testing. Draw-only clipping would
    // leave unseen actions clickable while the material is opening or closing.
    clip = progress < 1f
    shape = DialogRevealShape(progress, side())
}

private data class DialogRevealShape(val progress: Float, val side: Int) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val bounds = revealBounds(size.width, size.height, progress, side)
        val radius = with(density) { LabComponents.DialogRadius.dp.toPx() }
        return Outline.Rounded(RoundRect(bounds,
            CornerRadius(min(radius, min(bounds.width, bounds.height) / 2))))
    }
}

/** The material is a sibling of the content clip and paints its current bounds.
 * It therefore captures the scene normally instead of filtering a clipped group. */
internal fun Modifier.dialogMaterialBounds(reveal: MotionValue, side: () -> Int): Modifier = drawWithContent {
    if (reveal.value > 0f) drawContent()
}.layout { measurable, constraints ->
    val progress = reveal.value.coerceIn(0f, 1f)
    val bounds = revealBounds(constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat(), progress, side())
    val width = bounds.width.roundToInt()
    val height = bounds.height.roundToInt()
    val child = measurable.measure(Constraints.fixed(width, height))
    layout(constraints.maxWidth, constraints.maxHeight) { child.place(bounds.left.roundToInt(), bounds.top.roundToInt()) }
}
