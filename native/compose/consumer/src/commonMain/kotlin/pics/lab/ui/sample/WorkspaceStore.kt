package pics.lab.ui.sample

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import okio.Path.Companion.toPath
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabMaterial
import pics.lab.ui.LabPreferences

data class Workspace(
    val name: String = "Лаборатория",
    val email: String = "hello@labpics.ru",
    val description: String = "Дизайн и разработка цифровых продуктов",
    val notifications: Boolean = true,
)

data class DisplaySettings(
    val preferences: LabPreferences = LabPreferences(),
    val material: LabMaterial = LabMaterial.Glass,
)

data class WorkspaceSettings(
    val workspace: Workspace = Workspace(),
    val display: DisplaySettings = DisplaySettings(),
)

/** One atomic record per settings operation. Drafts never enter persistent storage. */
class WorkspaceStore internal constructor(private val dataStore: DataStore<Preferences>) {
    val data: Flow<WorkspaceSettings> = dataStore.data.map { it.settings() }

    suspend fun save(workspace: Workspace) {
        require(workspace.name.isNotBlank())
        dataStore.edit {
            it[name] = workspace.name.trim()
            it[email] = workspace.email.trim()
            it[description] = workspace.description.trim()
            it[notifications] = workspace.notifications
        }
    }

    suspend fun updateDisplay(change: (DisplaySettings) -> DisplaySettings) {
        dataStore.edit {
            val next = change(it.settings().display)
            it[appearance] = next.preferences.appearance.name
            it[contrast] = next.preferences.increasedContrast
            it[motion] = next.preferences.reducedMotion
            it[transparency] = next.preferences.reducedTransparency
            it[material] = next.material.name
        }
    }

    private fun Preferences.settings() =
        WorkspaceSettings(
            workspace =
                Workspace(
                    name = this[name] ?: defaults.name,
                    email = this[email] ?: defaults.email,
                    description = this[description] ?: defaults.description,
                    notifications = this[notifications] ?: defaults.notifications,
                ),
            display =
                DisplaySettings(
                    preferences =
                        LabPreferences(
                            appearance =
                                LabAppearance.entries.find { it.name == this[appearance] }
                                    ?: LabAppearance.Light,
                            increasedContrast = this[contrast] ?: false,
                            reducedMotion = this[motion] ?: false,
                            reducedTransparency = this[transparency] ?: false,
                        ),
                    material =
                        LabMaterial.entries.find { it.name == this[material] } ?: LabMaterial.Glass,
                ),
        )

    private companion object {
        val defaults = Workspace()
        val name = stringPreferencesKey("workspace.name")
        val email = stringPreferencesKey("workspace.email")
        val description = stringPreferencesKey("workspace.description")
        val notifications = booleanPreferencesKey("workspace.notifications")
        val appearance = stringPreferencesKey("display.appearance")
        val contrast = booleanPreferencesKey("display.increasedContrast")
        val motion = booleanPreferencesKey("display.reducedMotion")
        val transparency = booleanPreferencesKey("display.reducedTransparency")
        val material = stringPreferencesKey("display.material")
    }
}

internal fun createWorkspaceStore(
    path: String,
    scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
): WorkspaceStore =
    WorkspaceStore(PreferenceDataStoreFactory.createWithPath(scope = scope) { path.toPath() })

internal const val settingsFileName = "workspace.preferences_pb"
