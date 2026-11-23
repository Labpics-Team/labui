package pics.lab.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.github.vinceglb.filekit.PlatformFile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** One in-flight metadata operation for picker and drop, with live controlled inputs. */
internal class LabUploadReceiver(
    private val scope: CoroutineScope,
    private val readMetadata: suspend (List<PlatformFile>) -> List<LabUploadMetadata> = { files ->
        withContext(Dispatchers.IO) { files.map { ensureActive(); labUploadMetadata(it) } }
    },
) {
    var pendingFiles: List<PlatformFile> by mutableStateOf(emptyList())
        private set
    private var job: Job? = null

    fun receive(
        picked: List<PlatformFile>,
        value: () -> List<PlatformFile>,
        enabled: () -> Boolean,
        policy: () -> LabUploadPolicy,
        onResult: (LabUploadSelection) -> Unit,
    ): Job? {
        if (!enabled() || picked.isEmpty()) return null
        val requestedPolicy = policy()
        val batch = if (requestedPolicy.multiple) pendingFiles + picked else picked
        val baseline = value()
        job?.cancel()
        // Publish synchronously so Android retains drop permissions while metadata is pending.
        pendingFiles = batch
        return scope.launch {
            try {
                val incoming = readMetadata(batch)
                val existing = readMetadata(baseline)
                val result = validateLabUpload(incoming, existing, requestedPolicy.multiple,
                    requestedPolicy.accept, requestedPolicy.maxFiles, requestedPolicy.minFileSize,
                    requestedPolicy.maxFileSize)
                if (enabled() && value() == baseline && policy() == requestedPolicy) onResult(result)
            } finally {
                // A cancelled older operation cannot clear a later drop's pending references.
                if (pendingFiles === batch) pendingFiles = emptyList()
            }
        }.also { job = it }
    }

    fun cancel() {
        job?.cancel()
        pendingFiles = emptyList()
    }
}
