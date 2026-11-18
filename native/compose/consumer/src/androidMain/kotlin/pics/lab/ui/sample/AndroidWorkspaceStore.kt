package pics.lab.ui.sample

import android.content.Context

private var applicationStore: WorkspaceStore? = null

/** Activities share the one application DataStore, including after recreation. */
@Synchronized
fun androidWorkspaceStore(context: Context): WorkspaceStore =
    applicationStore
        ?: createWorkspaceStore(
                context.applicationContext.filesDir.resolve(settingsFileName).absolutePath
            )
            .also { applicationStore = it }
