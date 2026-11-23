package pics.lab.ui

import io.github.vinceglb.filekit.PlatformFile
import java.io.File
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class FileUploadAsyncTest {
    private val initialPolicy = LabUploadPolicy(true, listOf(".txt"), 10, 0, 100)

    @Test fun secondDropWhileMetadataIsSuspendedRetainsBothBatchesAndPendingReferences() = runTest {
        val firstFile = File.createTempFile("lab-upload-first-", ".txt")
        val secondFile = File.createTempFile("lab-upload-second-", ".txt")
        val first = PlatformFile(firstFile)
        val second = PlatformFile(secondFile)
        val resumeMetadata = CompletableDeferred<Unit>()
        val reads = mutableListOf<List<PlatformFile>>()
        val results = mutableListOf<LabUploadSelection>()
        val receiver = LabUploadReceiver(this) { files ->
            if (files.isNotEmpty()) { reads += files; resumeMetadata.await() }
            files.map(::labUploadMetadata)
        }
        try {
            val earlier = receiver.receive(listOf(first), { emptyList() }, { true }, { initialPolicy }, results::add)!!
            runCurrent()
            assertEquals(listOf(listOf(first)), reads, "First drop is suspended in real metadata operation")
            assertFalse(earlier.isCompleted)
            assertEquals(listOf(first), receiver.pendingFiles)

            val later = receiver.receive(listOf(second), { emptyList() }, { true }, { initialPolicy }, results::add)!!
            assertEquals(listOf(first, second), receiver.pendingFiles, "Both URI grants must remain retained synchronously")
            runCurrent()
            assertTrue(earlier.isCancelled)
            assertEquals(listOf(first, second), receiver.pendingFiles, "Earlier cancellation must not clear new pending references")
            assertTrue(results.isEmpty())

            resumeMetadata.complete(Unit)
            later.join()
            assertEquals(listOf(first, second), results.single().accepted)
            assertTrue(results.single().rejected.isEmpty())
            assertTrue(receiver.pendingFiles.isEmpty())
        } finally { receiver.cancel(); firstFile.delete(); secondFile.delete() }
    }

    @Test fun changingConstraintsWhileMetadataIsSuspendedCannotPublishTheOldPolicyResult() = runTest {
        val diskFile = File.createTempFile("lab-upload-policy-", ".txt").apply { writeText("ten bytes!") }
        val file = PlatformFile(diskFile)
        val resumeMetadata = CompletableDeferred<Unit>()
        val enteredMetadata = CompletableDeferred<Unit>()
        val results = mutableListOf<LabUploadSelection>()
        var currentPolicy = initialPolicy
        val receiver = LabUploadReceiver(this) { files ->
            if (files.isNotEmpty()) { enteredMetadata.complete(Unit); resumeMetadata.await() }
            files.map(::labUploadMetadata)
        }
        try {
            val earlier = receiver.receive(listOf(file), { emptyList() }, { true }, { currentPolicy }, results::add)!!
            runCurrent()
            assertTrue(enteredMetadata.isCompleted)
            assertFalse(earlier.isCompleted)
            currentPolicy = initialPolicy.copy(maxFileSize = 1)
            resumeMetadata.complete(Unit)
            earlier.join()
            assertTrue(results.isEmpty(), "A file accepted under the old limit must not reach the application")
            assertTrue(receiver.pendingFiles.isEmpty())

            receiver.receive(listOf(file), { emptyList() }, { true }, { currentPolicy }, results::add)!!.join()
            assertTrue(results.single().accepted.isEmpty())
            assertEquals(LabFileUploadRejectReason.TooLarge, results.single().rejected.single().reason)
        } finally { receiver.cancel(); diskFile.delete() }
    }
}
