package pics.lab.ui

import androidx.compose.runtime.Composable

/** Platform focus/IME/back handling, with visual treatment supplied entirely by Lab UI. */
@Composable
internal expect fun LabModal(onDismissRequest: () -> Unit, content: @Composable () -> Unit)
