package pics.lab.ui

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.platform.ClipEntry

@OptIn(ExperimentalComposeUiApi::class)
internal actual suspend fun readInputClipboardText(entry: ClipEntry): String? = entry.getPlainText()
