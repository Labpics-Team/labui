package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import io.github.vinceglb.filekit.PlatformFile

/** Whether this platform can retain native dropped files without copying their contents. */
internal expect val labFileUploadSupportsDrop: Boolean

/**
 * Receives native file references without reading their contents.
 *
 * [files] includes the controlled selection and files awaiting validation. [onFiles] must publish
 * pending references synchronously, before starting asynchronous work, so Android can retain the
 * URI permissions until every file associated with a drop has left the selection.
 */
@Composable
internal expect fun Modifier.labFileUploadDrop(
    enabled: Boolean,
    files: List<PlatformFile>,
    onDraggingChange: (Boolean) -> Unit,
    onFiles: (List<PlatformFile>) -> Unit,
): Modifier
