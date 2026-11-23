package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.vinceglb.filekit.PlatformFile
import io.github.vinceglb.filekit.readBytes
import io.github.vinceglb.filekit.startAccessingSecurityScopedResource
import io.github.vinceglb.filekit.stopAccessingSecurityScopedResource
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.withContext
import pics.lab.ui.*

/** A consumer imports a small text document through the public file-selection API. */
@Composable
fun FileUploadImportExample(theme: LabThemeState) {
    var files by remember { mutableStateOf(emptyList<PlatformFile>()) }
    var content by remember { mutableStateOf("") }
    var failure by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(files) {
        content = ""
        failure = null
        val file = files.singleOrNull() ?: return@LaunchedEffect
        try {
            content = withContext(Dispatchers.IO) {
                val accessGranted = file.startAccessingSecurityScopedResource()
                try {
                    file.readBytes().decodeToString()
                } finally {
                    if (accessGranted) file.stopAccessingSecurityScopedResource()
                }
            }
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            failure = "The document could not be read. Choose it again."
        }
    }
    LabTheme(theme) {
        Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"])
            .safeDrawingPadding().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            LabText("Import a document")
            LabFileUpload(files, { files = it }, "Document", accept = listOf(".txt"),
                maxFileSize = 65_536, labelHidden = false, error = failure)
            if (content.isNotEmpty()) LabText(content)
        }
    }
}
