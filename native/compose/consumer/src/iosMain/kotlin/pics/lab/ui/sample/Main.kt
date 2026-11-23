package pics.lab.ui.sample

import androidx.compose.ui.window.ComposeUIViewController
import pics.lab.ui.ColorProgramHost
import pics.lab.ui.LabSnackbarDefaults
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors

fun MainViewController(
    host: ColorProgramHost,
    snackbarDurationMillis: Long = LabSnackbarDefaults.durationMillis,
) = ComposeUIViewController {
    SettingsScreen(host, appleWorkspaceStore, snackbarDurationMillis)
}

fun FileUploadViewController() = ComposeUIViewController {
    val theme = androidx.compose.runtime.remember {
        val preferences = LabPreferences(reducedMotion = true)
        LabThemeState(initialLabColors(preferences), preferences)
    }
    FileUploadImportExample(theme)
}
