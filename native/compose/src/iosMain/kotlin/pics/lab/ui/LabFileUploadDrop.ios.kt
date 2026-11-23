package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import io.github.vinceglb.filekit.PlatformFile

internal actual val labFileUploadSupportsDrop: Boolean = false

/**
 * iOS file selection uses the system picker. A dropped NSItemProvider file URL can be temporary;
 * preserving it requires a managed file copy and cleanup beyond this reference-only component.
 */
@Composable
internal actual fun Modifier.labFileUploadDrop(
    enabled: Boolean,
    files: List<PlatformFile>,
    onDraggingChange: (Boolean) -> Unit,
    onFiles: (List<PlatformFile>) -> Unit,
): Modifier = this
