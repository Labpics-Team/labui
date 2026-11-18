package pics.lab.ui.sample

import java.io.File

internal fun desktopWorkspaceStore(): WorkspaceStore {
    val directory =
        System.getenv("LABUI_DATA_DIR")?.let(::File)
            ?: run {
                val userHome = File(System.getProperty("user.home"))
                val os = System.getProperty("os.name").lowercase()
                when {
                    os.startsWith("windows") ->
                        File(
                            System.getenv("APPDATA") ?: File(userHome, "AppData/Roaming").path,
                            "Labpics/LabUI",
                        )
                    os.startsWith("mac") -> File(userHome, "Library/Application Support/LabUI")
                    else ->
                        File(
                            System.getenv("XDG_CONFIG_HOME") ?: File(userHome, ".config").path,
                            "labui",
                        )
                }
            }
    return createWorkspaceStore(File(directory, settingsFileName).absolutePath)
}
