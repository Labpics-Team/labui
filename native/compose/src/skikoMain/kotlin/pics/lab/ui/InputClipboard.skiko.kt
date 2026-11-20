package pics.lab.ui

import androidx.compose.ui.platform.Clipboard
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.runtime.*

@Composable
internal actual fun rememberInputPasteAccess(
    onPaste: suspend (readText: suspend () -> String?) -> Unit,
): InputPasteAccess {
    val clipboard = LocalClipboard.current
    val currentPaste by rememberUpdatedState(onPaste)
    return remember(clipboard) {
        InputPasteAccess(object : Clipboard by clipboard {
            override suspend fun getClipEntry(): ClipEntry? {
                // Foundation 1.12.2 reads this only for paste; availability uses native
                // metadata. Complete our transaction and consume its subsequent insert.
                currentPaste { clipboard.getClipEntry()?.let { readInputClipboardText(it) } }
                return null
            }
        })
    }
}
