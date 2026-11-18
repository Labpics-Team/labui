package pics.lab.ui.sample

import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSApplicationSupportDirectory
import platform.Foundation.NSFileManager
import platform.Foundation.NSUserDomainMask

@OptIn(ExperimentalForeignApi::class)
internal val appleWorkspaceStore: WorkspaceStore by lazy {
    val directory =
        requireNotNull(
            NSFileManager.defaultManager
                .URLForDirectory(
                    directory = NSApplicationSupportDirectory,
                    inDomain = NSUserDomainMask,
                    appropriateForURL = null,
                    create = true,
                    error = null,
                )
                ?.path
        )
    createWorkspaceStore("$directory/$settingsFileName")
}
