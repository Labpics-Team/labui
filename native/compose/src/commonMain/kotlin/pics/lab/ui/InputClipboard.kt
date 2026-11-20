package pics.lab.ui

import androidx.compose.ui.platform.Clipboard
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Local to Tags Input's one state-based editor. Android supplies a public content receiver;
 * Skiko uses the pinned Foundation paste read boundary. Neither leaves a read marker behind.
 */
internal data class InputPasteAccess(val clipboard: Clipboard, val modifier: Modifier = Modifier)

@Composable
internal expect fun rememberInputPasteAccess(
    onPaste: suspend (readText: suspend () -> String?) -> Unit,
): InputPasteAccess

internal expect suspend fun readInputClipboardText(entry: ClipEntry): String?
