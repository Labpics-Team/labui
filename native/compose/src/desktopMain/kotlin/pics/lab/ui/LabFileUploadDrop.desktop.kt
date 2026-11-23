package pics.lab.ui

import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.awtTransferable
import io.github.vinceglb.filekit.PlatformFile
import java.awt.datatransfer.DataFlavor
import java.io.File

internal actual val labFileUploadSupportsDrop: Boolean = true

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal actual fun Modifier.labFileUploadDrop(
    enabled: Boolean,
    files: List<PlatformFile>,
    onDraggingChange: (Boolean) -> Unit,
    onFiles: (List<PlatformFile>) -> Unit,
): Modifier {
    val currentEnabled by rememberUpdatedState(enabled)
    val currentDraggingChange by rememberUpdatedState(onDraggingChange)
    val currentFiles by rememberUpdatedState(onFiles)
    val target = remember {
        object : DragAndDropTarget {
            override fun onEntered(event: DragAndDropEvent) {
                currentDraggingChange(currentEnabled)
            }

            override fun onExited(event: DragAndDropEvent) {
                currentDraggingChange(false)
            }

            override fun onEnded(event: DragAndDropEvent) {
                currentDraggingChange(false)
            }

            override fun onDrop(event: DragAndDropEvent): Boolean {
                currentDraggingChange(false)
                if (!currentEnabled) return false
                val dropped = runCatching {
                    val transferable = event.awtTransferable
                    if (!transferable.isDataFlavorSupported(DataFlavor.javaFileListFlavor)) {
                        emptyList()
                    } else {
                        (transferable.getTransferData(DataFlavor.javaFileListFlavor) as? List<*>)
                            .orEmpty()
                            .filterIsInstance<File>()
                            .map(::PlatformFile)
                    }
                }.getOrElse { return false }
                if (dropped.isEmpty()) return false
                currentFiles(dropped)
                return true
            }
        }
    }
    LaunchedEffect(enabled) {
        if (!enabled) currentDraggingChange(false)
    }
    DisposableEffect(target) {
        onDispose { currentDraggingChange(false) }
    }
    return dragAndDropTarget(
        shouldStartDragAndDrop = { event ->
            currentEnabled && event.awtTransferable.isDataFlavorSupported(DataFlavor.javaFileListFlavor)
        },
        target = target,
    )
}
