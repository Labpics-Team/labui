package pics.lab.ui

import androidx.compose.runtime.*
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionResult
import pics.lab.motion.MotionTransition
import pics.lab.motion.MotionValue

/** The platform window remains present through exit so modality and focus agree
 * with the visible surface. Reopening interrupts the same opacity value.
 */
@Composable
internal fun rememberDialogPresence(open: Boolean): Pair<Boolean, MotionValue> {
    val motion = rememberLabMotion()
    val opacity = remember(motion) { motion.value(0f, "dialog.opacity") }
    var present by remember { mutableStateOf(open) }
    LaunchedEffect(open) {
        if (open) present = true
        if (!present) return@LaunchedEffect
        val duration = if (open) LabTokens.MotionEntranceDurationMs else LabTokens.MotionExitDurationMs
        val playback = motion.animate {
            to(opacity, if (open) 1f else 0f, MotionTransition.Tween(duration.toInt(), MotionEase.Linear))
        }
        val result = try { playback.finished.await() } finally { playback.stop() }
        if (!open && result == MotionResult.Finished) present = false
    }
    return present to opacity
}
