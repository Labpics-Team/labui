package pics.lab.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.DragAndDropPermissions
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import androidx.compose.ui.platform.LocalContext
import io.github.vinceglb.filekit.AndroidFile
import io.github.vinceglb.filekit.PlatformFile

internal actual val labFileUploadSupportsDrop: Boolean = true

private data class FileDropPermission(
    val permission: DragAndDropPermissions,
    val uris: Set<String>,
    val revision: Int,
)

@Composable
internal actual fun Modifier.labFileUploadDrop(
    enabled: Boolean,
    files: List<PlatformFile>,
    onDraggingChange: (Boolean) -> Unit,
    onFiles: (List<PlatformFile>) -> Unit,
): Modifier {
    val context = LocalContext.current
    val activity = remember(context) { context.fileDropActivity() }
    val permissions = remember(activity) { mutableListOf<FileDropPermission>() }
    var permissionRevision by remember(activity) { mutableIntStateOf(0) }
    val currentEnabled by rememberUpdatedState(enabled)
    val currentDraggingChange by rememberUpdatedState(onDraggingChange)
    val currentFiles by rememberUpdatedState(onFiles)
    val target = remember(activity) {
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
                if (!currentEnabled || activity == null) return false
                val nativeEvent = event.toAndroidDragEvent()
                val data = nativeEvent.clipData ?: return false
                val uris = (0 until data.itemCount).mapNotNull { index ->
                    data.getItemAt(index).uri?.takeIf { it.scheme == "content" || it.scheme == "file" }
                }
                if (uris.isEmpty()) return false
                val nextRevision = permissionRevision + 1
                val permission = activity.requestDragAndDropPermissions(nativeEvent)?.let {
                    FileDropPermission(it, uris.mapTo(mutableSetOf()) { uri -> uri.toString() }, nextRevision)
                }
                permission?.let(permissions::add)
                permissionRevision = nextRevision
                try {
                    currentFiles(uris.map(::PlatformFile))
                } catch (error: Throwable) {
                    if (permission != null) {
                        permissions.remove(permission)
                        permission.permission.release()
                    }
                    throw error
                }
                return true
            }
        }
    }
    val appliedRevision = permissionRevision
    LaunchedEffect(activity, files, appliedRevision) {
        val retainedUris = files.mapNotNullTo(mutableSetOf()) {
            (it.androidFile as? AndroidFile.UriWrapper)?.uri?.toString()
        }
        val iterator = permissions.iterator()
        while (iterator.hasNext()) {
            val drop = iterator.next()
            // An effect from an earlier composition must not release a newer drop whose pending
            // references have not yet been committed by Compose.
            if (drop.revision <= appliedRevision && drop.uris.none(retainedUris::contains)) {
                drop.permission.release()
                iterator.remove()
            }
        }
    }
    LaunchedEffect(enabled) {
        if (!enabled) currentDraggingChange(false)
    }
    DisposableEffect(activity) {
        onDispose {
            permissions.forEach { it.permission.release() }
            permissions.clear()
            currentDraggingChange(false)
        }
    }
    return dragAndDropTarget(
        // Android only exposes ClipData items at drop time. A text/plain description may also
        // represent a real .txt file, so inspect URI items in onDrop rather than reject by MIME.
        shouldStartDragAndDrop = { event ->
            currentEnabled && activity != null && event.toAndroidDragEvent().clipDescription != null
        },
        target = target,
    )
}

private fun Context.fileDropActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.takeUnless { it === this }?.fileDropActivity()
    else -> null
}
