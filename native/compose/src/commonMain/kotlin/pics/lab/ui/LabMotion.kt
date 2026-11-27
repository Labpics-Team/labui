package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import pics.lab.motion.MotionController

@Composable
internal fun rememberLabMotion(): MotionController {
    val scope = rememberCoroutineScope()
    val reduced = LocalLabTheme.current.preferences.reducedMotion
    val controller = remember(scope) { MotionController(scope, reduced) }
    SideEffect { controller.reducedMotion = reduced }
    DisposableEffect(controller) { onDispose { controller.dispose() } }
    return controller
}
