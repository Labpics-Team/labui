package pics.lab.ui.sample

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabMaterial

class WorkspaceStoreTest {
    @Test
    fun undoRestoresCommittedDataButKeepsANewerWrite() = runBlocking {
        val directory = Files.createTempDirectory("labui-settings-undo").toFile()
        val path = directory.resolve(settingsFileName).absolutePath
        val job = SupervisorJob()
        val reopenJob = SupervisorJob()
        try {
            val store = createWorkspaceStore(path, CoroutineScope(job + Dispatchers.IO))
            val first = store.save(Workspace(name = "  Студия  "))
            assertEquals(true, store.undo(first))
            assertEquals(Workspace(), store.data.first().workspace)
            val second = store.save(Workspace(name = "Вторая запись"))
            store.save(Workspace(name = "Новая запись другого окна"))
            store.save(second.after)
            assertEquals(false, store.undo(second))
            job.cancelAndJoin()
            val reopened = createWorkspaceStore(path, CoroutineScope(reopenJob + Dispatchers.IO))
            assertEquals("Вторая запись", reopened.data.first().workspace.name)
        } finally {
            job.cancelAndJoin()
            reopenJob.cancelAndJoin()
            directory.deleteRecursively()
        }
    }

    @Test
    fun savedWorkspaceAndDisplaySurviveClosingAndReopeningStorage() = runBlocking {
        val directory = Files.createTempDirectory("labui-settings-test").toFile()
        val path = directory.resolve(settingsFileName).absolutePath
        val firstJob = SupervisorJob()
        val secondJob = SupervisorJob()
        try {
            val first = createWorkspaceStore(path, CoroutineScope(firstJob + Dispatchers.IO))
            val workspace =
                Workspace(
                    "Новая лаборатория 東京",
                    "studio@example.com",
                    "Первая строка\nВторая строка",
                    false,
                )
            first.save(workspace)
            first.updateDisplay {
                it.copy(
                    preferences = it.preferences.copy(appearance = LabAppearance.Dark),
                    material = LabMaterial.Acrylic,
                )
            }
            firstJob.cancelAndJoin()
            val restored =
                createWorkspaceStore(path, CoroutineScope(secondJob + Dispatchers.IO)).data.first()
            assertEquals(workspace, restored.workspace)
            assertEquals(LabAppearance.Dark, restored.display.preferences.appearance)
            assertEquals(LabMaterial.Acrylic, restored.display.material)
        } finally {
            firstJob.cancelAndJoin()
            secondJob.cancelAndJoin()
            directory.deleteRecursively()
        }
    }

    @Test
    fun concurrentSettingsWritesPreserveBothChangesAndRejectInvalidWorkspace() = runBlocking {
        val directory = Files.createTempDirectory("labui-settings-test").toFile()
        val job = SupervisorJob()
        try {
            val store =
                createWorkspaceStore(
                    directory.resolve(settingsFileName).absolutePath,
                    CoroutineScope(job + Dispatchers.IO),
                )
            val workspace = Workspace(name = "Студия", description = "Сохранённое описание")
            coroutineScope {
                launch { store.save(workspace) }
                launch {
                    store.updateDisplay {
                        it.copy(preferences = it.preferences.copy(reducedMotion = true))
                    }
                }
            }
            assertFailsWith<IllegalArgumentException> { store.save(workspace.copy(name = " ")) }
            assertEquals(workspace, store.data.first().workspace)
            assertEquals(true, store.data.first().display.preferences.reducedMotion)
        } finally {
            job.cancelAndJoin()
            directory.deleteRecursively()
        }
    }
}
