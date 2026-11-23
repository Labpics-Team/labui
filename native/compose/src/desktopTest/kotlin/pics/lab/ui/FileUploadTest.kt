package pics.lab.ui

import io.github.vinceglb.filekit.PlatformFile
import java.io.File
import kotlin.test.*

class FileUploadTest {
    private fun item(name: String, size: Long? = 5, type: String? = "text/plain") =
        LabUploadMetadata(PlatformFile(File(name)), name, size, type)
    private fun select(incoming: List<LabUploadMetadata>, existing: List<LabUploadMetadata> = emptyList(),
        multiple: Boolean = true, accept: List<String> = emptyList(), max: Int = 10, limit: Long? = null) =
        validateLabUpload(incoming, existing, multiple, accept, max, 0, limit)

    @Test fun cancellationInvalidPicksAndCountOverflowKeepExistingSelection() {
        val old = item("old.txt")
        assertEquals(listOf(old.file), select(emptyList(), listOf(old)).accepted)
        val invalid = select(listOf(item("image.png", type = "image/png")), listOf(old), accept = listOf(".txt"))
        assertEquals(listOf(old.file), invalid.accepted)
        assertEquals(LabFileUploadRejectReason.InvalidType, invalid.rejected.single().reason)
        val overflow = select(listOf(item("a.txt"), item("b.txt")), listOf(old), max = 2)
        assertEquals(listOf(old.file), overflow.accepted)
        assertEquals(listOf(LabFileUploadRejectReason.TooMany, LabFileUploadRejectReason.TooMany), overflow.rejected.map { it.reason })
    }

    @Test fun multipleAppendsSingleReplacesAndDuplicatesAreRejected() {
        val old = item("old.txt")
        val next = item("next.txt")
        assertEquals(listOf(old.file, next.file), select(listOf(next), listOf(old)).accepted)
        assertEquals(listOf(next.file), select(listOf(next), listOf(old), multiple = false).accepted)
        val duplicate = select(listOf(old, next, next), listOf(old))
        assertEquals(listOf(old.file, next.file), duplicate.accepted)
        assertEquals(2, duplicate.rejected.size)
        assertTrue(duplicate.rejected.all { it.reason == LabFileUploadRejectReason.AlreadySelected })
    }

    @Test fun unknownSizeIsNotZeroAndMimeAndExtensionFiltersAreAlternatives() {
        val unknown = item("cloud.txt", null, null)
        assertEquals(listOf(unknown.file), select(listOf(unknown), accept = listOf(".TXT")).accepted)
        assertEquals(LabFileUploadRejectReason.UnknownSize, select(listOf(unknown), limit = 100).rejected.single().reason)
        val image = item("picture", 5, "image/png")
        assertEquals(listOf(unknown.file, image.file), select(listOf(unknown, image), accept = listOf(".txt", "image/*")).accepted)
        assertEquals(LabFileUploadRejectReason.TooLarge, select(listOf(item("large.txt", 101)), limit = 100).rejected.single().reason)
    }

    @Test fun metadataUsesTheRealFileKitHandleWithoutReadingFileContents() {
        val file = File.createTempFile("lab-upload-", ".txt")
        try {
            file.writeText("native metadata")
            val metadata = labUploadMetadata(PlatformFile(file))
            assertEquals(file.name, metadata.name)
            assertEquals(file.length(), metadata.size)
            assertNull(metadata.failure)
            assertEquals(LabFileUploadRejectReason.Directory, labUploadMetadata(PlatformFile(file.parentFile)).failure)
        } finally { file.delete() }
    }
}
