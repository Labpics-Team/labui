package pics.lab.ui

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.asAwtTransferable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.awt.datatransfer.DataFlavor
import java.awt.datatransfer.UnsupportedFlavorException
import java.io.IOException

@OptIn(ExperimentalComposeUiApi::class)
internal actual suspend fun readInputClipboardText(entry: ClipEntry): String? = withContext(Dispatchers.IO) {
    val transferable = entry.asAwtTransferable ?: return@withContext null
    if (!transferable.isDataFlavorSupported(DataFlavor.stringFlavor)) return@withContext null
    try { transferable.getTransferData(DataFlavor.stringFlavor) as? String }
    catch (_: UnsupportedFlavorException) { null }
    catch (_: IOException) { null }
}
