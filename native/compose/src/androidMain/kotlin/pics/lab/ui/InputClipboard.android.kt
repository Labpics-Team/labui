package pics.lab.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.content.MediaType
import androidx.compose.foundation.content.TransferableContent
import androidx.compose.foundation.content.contentReceiver
import androidx.compose.foundation.content.hasMediaType
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal actual fun rememberInputPasteAccess(
    onPaste: suspend (readText: suspend () -> String?) -> Unit,
): InputPasteAccess {
    val scope = rememberCoroutineScope()
    val currentPaste by rememberUpdatedState(onPaste)
    return InputPasteAccess(LocalClipboard.current, Modifier.contentReceiver { content ->
        if (content.source != TransferableContent.Source.Clipboard || !content.hasMediaType(MediaType.Text)) content
        else {
            scope.launch(start = CoroutineStart.UNDISPATCHED) {
                currentPaste { readInputClipboardText(content.clipEntry) }
            }
            null
        }
    })
}

internal actual suspend fun readInputClipboardText(entry: ClipEntry): String? =
    entry.clipData.takeIf { it.itemCount > 0 }?.getItemAt(0)?.text?.toString()
