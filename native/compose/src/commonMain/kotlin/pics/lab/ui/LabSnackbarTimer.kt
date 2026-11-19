package pics.lab.ui

import kotlin.math.ceil

/** A monotonic deadline. Only second/pose boundaries schedule work, never display frames. */
internal class LabSnackbarTimer(val durationMillis: Long, private val now: () -> Long) {
    init { require(durationMillis >= 0) }
    private var rest = durationMillis
    private var deadline: Long? = null

    fun remaining(): Long = deadline?.let { (it - now()).coerceAtLeast(0) } ?: rest

    fun running(value: Boolean) {
        if (value && deadline == null) deadline = now() + rest
        if (!value && deadline != null) {
            rest = remaining()
            deadline = null
        }
    }

    fun nextChange(): Long {
        val remaining = remaining()
        if (remaining == 0L) return 0
        val seconds = ceil(remaining / 1000.0).toLong()
        val poses = LabComponents.SnackbarTimerSweeps.size
        val pose = ceil(remaining.toDouble() / durationMillis * poses).toInt().coerceIn(1, poses)
        return minOf(remaining - (seconds - 1) * 1000,
                     remaining - ((pose - 1) * durationMillis / poses)).coerceAtLeast(1)
    }
}
