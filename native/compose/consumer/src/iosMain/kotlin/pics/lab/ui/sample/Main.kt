package pics.lab.ui.sample

import androidx.compose.ui.window.ComposeUIViewController
import pics.lab.ui.ColorProgramHost

fun MainViewController(host: ColorProgramHost) = ComposeUIViewController {
    SettingsScreen(host, appleWorkspaceStore)
}
