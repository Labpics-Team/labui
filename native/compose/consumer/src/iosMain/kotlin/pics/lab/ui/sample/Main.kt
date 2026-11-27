package pics.lab.ui.sample

import androidx.compose.ui.window.ComposeUIViewController
import pics.lab.ui.ColorProgramHost
import pics.lab.ui.LabSnackbarDefaults

fun MainViewController(
    host: ColorProgramHost,
    snackbarDurationMillis: Long = LabSnackbarDefaults.durationMillis,
) = ComposeUIViewController {
    SettingsScreen(host, appleWorkspaceStore, snackbarDurationMillis)
}
