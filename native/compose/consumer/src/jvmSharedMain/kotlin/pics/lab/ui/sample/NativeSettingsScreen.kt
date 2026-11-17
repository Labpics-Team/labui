package pics.lab.ui.sample

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import pics.lab.ui.colors.LabColorsProgramHost

/** The application's composition owns the native host, independently of theme updates. */
@Composable
fun NativeSettingsScreen() {
    val host = remember { LabColorsProgramHost() }
    DisposableEffect(host) { onDispose { host.close() } }
    SettingsScreen(host)
}
