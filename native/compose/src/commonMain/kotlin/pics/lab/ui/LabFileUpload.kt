package pics.lab.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.vinceglb.filekit.PlatformFile
import io.github.vinceglb.filekit.dialogs.FileKitMode
import io.github.vinceglb.filekit.dialogs.FileKitType
import io.github.vinceglb.filekit.dialogs.compose.rememberFilePickerLauncher
import io.github.vinceglb.filekit.isDirectory
import io.github.vinceglb.filekit.mimeType
import io.github.vinceglb.filekit.name
import io.github.vinceglb.filekit.size
import io.github.vinceglb.filekit.withScopedAccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource
import pics.lab.ui.resources.*

public enum class LabFileUploadVariant { Input, Area }
public enum class LabFileUploadRejectReason { InvalidType, TooLarge, TooSmall, TooMany, AlreadySelected, UnknownSize, Unreadable, Directory }

public data class LabFileUploadRejection(
    public val file: PlatformFile,
    public val name: String,
    public val reason: LabFileUploadRejectReason,
)

/** All visible and spoken actions can be translated by the application. */
public data class LabFileUploadStrings(
    public val chooseFile: String = "Choose File",
    public val empty: String = "No file chosen",
    public val drop: String = "Drag and drop files here",
    public val chooseFiles: String = "Choose files to upload",
    public val dragging: String = "Drag and drop files here",
    public val browse: String = "Browse files",
    public val or: String = "or",
    public val remove: String = "Remove",
    public val selectedFile: String = "Selected file",
    public val pickerError: String = "The file picker could not be opened. Try again.",
    public val rejectionMessage: (LabFileUploadRejectReason) -> String = { reason ->
        when (reason) {
            LabFileUploadRejectReason.InvalidType -> "File type is not accepted."
            LabFileUploadRejectReason.TooLarge -> "File is too large."
            LabFileUploadRejectReason.TooSmall -> "File is too small."
            LabFileUploadRejectReason.TooMany -> "Too many files."
            LabFileUploadRejectReason.AlreadySelected -> "File is already selected."
            LabFileUploadRejectReason.UnknownSize -> "File size is unavailable; the size limit cannot be checked."
            LabFileUploadRejectReason.Unreadable -> "File metadata could not be read."
            LabFileUploadRejectReason.Directory -> "Choose a file, not a folder."
        }
    },
)

internal data class LabUploadMetadata(
    val file: PlatformFile, val name: String, val size: Long?, val type: String?,
    val failure: LabFileUploadRejectReason? = null,
)
internal data class LabUploadSelection(val accepted: List<PlatformFile>, val rejected: List<LabFileUploadRejection>)
internal data class LabUploadPolicy(val multiple: Boolean, val accept: List<String>, val maxFiles: Int,
    val minFileSize: Long, val maxFileSize: Long?)

/** Metadata only. FileKit handles Android providers and Apple security-scoped URLs. */
internal fun labUploadMetadata(file: PlatformFile): LabUploadMetadata = try {
    file.withScopedAccess {
        LabUploadMetadata(file, file.name, file.size().takeIf { it >= 0 },
            file.mimeType()?.let { "${it.primaryType}/${it.subtype}" },
            if (file.isDirectory()) LabFileUploadRejectReason.Directory else null)
    }
} catch (failure: Exception) {
    if (failure is CancellationException) throw failure
    LabUploadMetadata(file, "", null, null, LabFileUploadRejectReason.Unreadable)
}

internal fun validateLabUpload(
    incoming: List<LabUploadMetadata>, existing: List<LabUploadMetadata>, multiple: Boolean,
    accept: List<String>, maxFiles: Int, minFileSize: Long, maxFileSize: Long?,
): LabUploadSelection {
    val retained = if (multiple) existing else emptyList()
    val rejected = mutableListOf<LabFileUploadRejection>()
    val accepted = mutableListOf<LabUploadMetadata>()
    val filters = accept.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
    val identities = retained.mapTo(mutableSetOf()) { Triple(it.name, it.size, it.type) }
    for (item in incoming) {
        val identity = Triple(item.name, item.size, item.type)
        val reason = item.failure ?: when {
            filters.isNotEmpty() && filters.none { filter ->
                when {
                    filter.startsWith('.') -> item.name.lowercase().endsWith(filter)
                    filter == "*/*" -> true
                    filter.endsWith("/*") -> item.type?.startsWith(filter.dropLast(1)) == true
                    else -> item.type?.equals(filter, ignoreCase = true) == true
                }
            } -> LabFileUploadRejectReason.InvalidType
            item.size == null && (minFileSize > 0 || maxFileSize != null) -> LabFileUploadRejectReason.UnknownSize
            item.size != null && maxFileSize != null && item.size > maxFileSize -> LabFileUploadRejectReason.TooLarge
            item.size != null && item.size < minFileSize -> LabFileUploadRejectReason.TooSmall
            identity in identities -> LabFileUploadRejectReason.AlreadySelected
            else -> null
        }
        if (reason != null) rejected += LabFileUploadRejection(item.file, item.name, reason)
        else { accepted += item; identities += identity }
    }
    if (retained.size.toLong() + accepted.size > (if (multiple) maxFiles else 1)) {
        rejected += accepted.map { LabFileUploadRejection(it.file, it.name, LabFileUploadRejectReason.TooMany) }
        accepted.clear()
    }
    return LabUploadSelection(if (accepted.isEmpty()) existing.map { it.file } else (retained + accepted).map { it.file }, rejected)
}

/**
 * Controlled native file selection. Multiple picks append; single picks replace. Cancellation
 * and wholly rejected batches preserve value. No file contents are read or uploaded here.
 * accept uses dotted extensions, MIME types, or MIME groups ending in a wildcard.
 */
@Composable
public fun LabFileUpload(
    value: List<PlatformFile>,
    onValueChange: (List<PlatformFile>) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    variant: LabFileUploadVariant = LabFileUploadVariant.Input,
    size: LabControlSize = LabControlSize.Medium,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    labelHidden: Boolean = true,
    multiple: Boolean = false,
    accept: List<String> = emptyList(),
    maxFiles: Int = Int.MAX_VALUE,
    minFileSize: Long = 0,
    maxFileSize: Long? = null,
    helper: String? = null,
    error: String? = null,
    strings: LabFileUploadStrings = LabFileUploadStrings(),
    onReject: (List<LabFileUploadRejection>) -> Unit = {},
) {
    require(maxFiles > 0) { "maxFiles must be positive" }
    require(minFileSize >= 0 && (maxFileSize == null || maxFileSize >= minFileSize)) { "Invalid file size range" }
    val mutable = enabled && !readOnly
    val scope = rememberCoroutineScope()
    val selection = remember(scope) { LabUploadReceiver(scope) }
    var rejection by remember { mutableStateOf<String?>(null) }
    var dragging by remember { mutableStateOf(false) }
    val latestValue by rememberUpdatedState(value)
    val latestMutable by rememberUpdatedState(mutable)
    val latestChange by rememberUpdatedState(onValueChange)
    val latestReject by rememberUpdatedState(onReject)
    val latestStrings by rememberUpdatedState(strings)
    val policy = LabUploadPolicy(multiple, accept, maxFiles, minFileSize, maxFileSize)
    val latestPolicy by rememberUpdatedState(policy)
    val selectedValue = value
    val metadata by produceState(emptyList<LabUploadMetadata>(), selectedValue) {
        this.value = withContext(Dispatchers.IO) { selectedValue.map(::labUploadMetadata) }
    }
    val names = value.mapIndexed { index, file -> metadata.getOrNull(index)?.takeIf { it.file == file }?.name
        ?.takeIf { it.isNotEmpty() } ?: strings.selectedFile }
    val receive: (List<PlatformFile>) -> Unit = { picked ->
        selection.receive(picked, value = { latestValue }, enabled = { latestMutable }, policy = { latestPolicy }) { result ->
            rejection = result.rejected.takeIf { it.isNotEmpty() }?.joinToString("\n") {
                "${it.name.ifEmpty { latestStrings.selectedFile }}: ${latestStrings.rejectionMessage(it.reason)}"
            }
            if (result.rejected.isNotEmpty()) latestReject(result.rejected)
            if (result.accepted != latestValue) latestChange(result.accepted)
        }
    }
    // A mixed MIME/extension accept list must not hide valid types in a native extension-only picker.
    val extensions = accept.takeIf { it.isNotEmpty() && it.all { filter -> filter.trim().startsWith('.') } }
        ?.map { it.trim().drop(1).lowercase() }?.toSet()
    val pickerType = FileKitType.File(extensions)
    val pickerFailure = { _: io.github.vinceglb.filekit.dialogs.FileKitPickerException -> rejection = latestStrings.pickerError }
    val launcher = if (multiple) rememberFilePickerLauncher(type = pickerType, mode = FileKitMode.Multiple(),
        onError = pickerFailure) { picked -> picked?.let(receive) }
    else rememberFilePickerLauncher(type = pickerType, onError = pickerFailure) { picked -> picked?.let { receive(listOf(it)) } }
    LaunchedEffect(mutable) { if (!mutable) { selection.cancel(); dragging = false } }
    LabFileUploadBody(names, label, modifier.labFileUploadDrop(mutable, value + selection.pendingFiles, { dragging = it }, receive),
        variant, size, enabled, readOnly, labelHidden, dragging, helper, error ?: rejection, strings,
        dropSupported = labFileUploadSupportsDrop,
        onBrowse = { if (latestMutable) launcher.launch() },
        onRemove = { index -> if (latestMutable) {
            selection.cancel(); rejection = null
            latestChange(latestValue.filterIndexed { i, _ -> i != index })
        } })
}

@Composable
internal fun LabFileUploadBody(
    names: List<String>, label: String, modifier: Modifier = Modifier,
    variant: LabFileUploadVariant = LabFileUploadVariant.Input, size: LabControlSize = LabControlSize.Medium,
    enabled: Boolean = true, readOnly: Boolean = false, labelHidden: Boolean = true,
    dragging: Boolean = false, helper: String? = null, error: String? = null,
    strings: LabFileUploadStrings = LabFileUploadStrings(), dropSupported: Boolean = true,
    onBrowse: () -> Unit, onRemove: (Int) -> Unit,
) {
    val colors = LocalLabTheme.current.colors
    val interactive = enabled && !readOnly
    val interactions = remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val metrics = when (size) { LabControlSize.Small -> LabComponents.FileUploadS; LabControlSize.Medium -> LabComponents.FileUploadM; LabControlSize.Large -> LabComponents.FileUploadL }
    val area = variant == LabFileUploadVariant.Area
    val radius = if (area) LabComponents.FileUploadAreaRadius else metrics.radius
    val foreground = colors[if (enabled) LabComponents.FileUploadRolesLabel else LabComponents.FileUploadRolesDisabled]
    val secondary = colors[if (enabled) LabComponents.FileUploadRolesSecondary else LabComponents.FileUploadRolesDisabled]
    val bodyStyle = LabType.body().withTypography(color = foreground, fontSize = metrics.fontSize.sp,
        lineHeight = metrics.lineHeight.sp, fontWeight = FontWeight(metrics.fontWeight.toInt()), letterSpacing = metrics.letterSpacing.sp)
    val caption = LabType.caption().withTypography(color = secondary, fontSize = LabComponents.FileUploadCaptionFontSize.sp,
        lineHeight = LabComponents.FileUploadCaptionLineHeight.sp, fontWeight = FontWeight(LabComponents.FileUploadCaptionFontWeight.toInt()),
        letterSpacing = LabComponents.FileUploadCaptionLetterSpacing.sp)
    val border = colors[when { dragging && interactive -> LabComponents.FileUploadRolesDragBorder; focused -> LabComponents.FileUploadRolesFocus; else -> LabComponents.FileUploadRolesBorder }]
    val fill = when {
        dragging && interactive && !area -> colors[LabComponents.FileUploadRolesDragBackground]
        !area && hovered && interactive -> colors[LabComponents.FileUploadRolesHover]
        else -> colors[LabComponents.FileUploadRolesBackground]
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(LabComponents.FileUploadFieldGap.dp)) {
        if (!labelHidden) LabText(label, style = caption)
        val panel = Modifier.fillMaxWidth().clip(RoundedCornerShape(radius.dp)).background(fill)
            .drawWithContent {
                drawContent()
                val width = (if (dragging && interactive || focused) LabComponents.FileUploadDragStrokeWidth else LabComponents.FileUploadStrokeWidth).dp.toPx()
                val inset = width / 2
                drawRoundRect(border, Offset(inset, inset), Size(this.size.width - width, this.size.height - width),
                    CornerRadius((radius.dp.toPx() - inset).coerceAtLeast(0f)),
                    style = Stroke(width, pathEffect = if (dragging && interactive) PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())) else null))
            }.hoverable(interactions, interactive)
        if (area) {
            BoxWithConstraints(panel.heightIn(min = LabComponents.FileUploadAreaHeight.dp)) {
                if (dragging && interactive) Image(painterResource(Res.drawable.lab_file_upload_drag_background), null,
                    Modifier.matchParentSize(), contentScale = ContentScale.FillBounds)
                val paddingX = minOf(LabComponents.FileUploadAreaPaddingX.dp, maxWidth / 12)
                Column(Modifier.fillMaxWidth().padding(horizontal = paddingX, vertical = LabComponents.FileUploadAreaPaddingY.dp)
                    .align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(LabComponents.FileUploadAreaGap.dp)) {
                    if (enabled) LabFileUploadArtwork(dragging && interactive, names.isNotEmpty(), hovered && interactive)
                    val title = if (dragging && interactive) strings.dragging else names.firstOrNull()
                        ?: if (dropSupported) strings.drop else strings.chooseFiles
                    LabText(title, Modifier.fillMaxWidth().then(if (names.isNotEmpty()) Modifier.clickable(interactions, null,
                        enabled = interactive, onClickLabel = strings.browse, role = Role.Button, onClick = onBrowse)
                        .semantics { contentDescription = "$label: $title" } else Modifier),
                        style = bodyStyle.withTypography(fontSize = LabComponents.FileUploadAreaTitleFontSize.sp,
                            lineHeight = LabComponents.FileUploadAreaTitleLineHeight.sp,
                            fontWeight = FontWeight(LabComponents.FileUploadAreaTitleFontWeight.toInt()),
                            letterSpacing = LabComponents.FileUploadAreaTitleLetterSpacing.sp).copy(textAlign = TextAlign.Center))
                    if (names.isEmpty() && !dragging) {
                        LabText(strings.or, style = caption)
                        LabButton(strings.browse, onBrowse, Modifier.semantics { contentDescription = "$label: ${strings.browse}" },
                            enabled = interactive, size = LabControlSize.Large)
                    }
                }
            }
        } else {
            Row(panel.defaultMinSize(minHeight = metrics.height.dp).clickable(interactions, null, interactive,
                onClickLabel = strings.browse, role = Role.Button, onClick = onBrowse)
                .semantics { contentDescription = "$label: ${names.joinToString().ifEmpty { strings.empty }}" }
                .padding(horizontal = metrics.paddingX.dp, vertical = metrics.paddingY.dp),
                horizontalArrangement = Arrangement.spacedBy(LabComponents.FileUploadGap.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically) {
                if (names.isNotEmpty()) {
                    Image(painterResource(Res.drawable.lab_file_upload_file), null, Modifier.size(metrics.icon.dp), colorFilter = ColorFilter.tint(secondary))
                    LabText(names.first(), Modifier.weight(1f, fill = false), style = bodyStyle)
                } else {
                    LabText(strings.chooseFile, style = bodyStyle)
                    LabText(strings.empty, Modifier.weight(1f, fill = false), style = bodyStyle.copy(color = secondary))
                }
            }
        }
        names.forEachIndexed { index, name ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(LabComponents.FileUploadGap.dp), verticalAlignment = Alignment.CenterVertically) {
                if (names.size > 1) LabText(name, Modifier.weight(1f), style = bodyStyle)
                else Spacer(Modifier.weight(1f))
                LabButton(strings.remove, { if (interactive) onRemove(index) },
                    Modifier.semantics { contentDescription = "${strings.remove} $name" },
                    intent = LabIntent.Neutral, kind = LabButtonKind.Ghost, size = LabControlSize.Small, enabled = interactive)
            }
        }
        val message = error ?: helper
        if (message != null) LabText(message, Modifier.fillMaxWidth().semantics {
            if (error != null) { this.error(error); liveRegion = LiveRegionMode.Polite }
        }, style = caption.copy(color = colors[if (error != null) LabComponents.FileUploadRolesDanger else LabComponents.FileUploadRolesSecondary]))
    }
}

@Composable
private fun LabFileUploadArtwork(dragging: Boolean, selected: Boolean, hovered: Boolean) {
    val resource: DrawableResource
    val width: Float
    val height: Float
    val offset: Float
    when {
        dragging -> { resource = Res.drawable.lab_file_upload_drag; width = LabComponents.FileUploadAreaArtworkDragWidth; height = LabComponents.FileUploadAreaArtworkDragHeight; offset = LabComponents.FileUploadAreaArtworkDragOffsetY }
        selected -> { resource = Res.drawable.lab_file_upload_selected; width = LabComponents.FileUploadAreaArtworkSelectedWidth; height = LabComponents.FileUploadAreaArtworkSelectedHeight; offset = LabComponents.FileUploadAreaArtworkSelectedOffsetY }
        hovered -> { resource = Res.drawable.lab_file_upload_hover; width = LabComponents.FileUploadAreaArtworkHoverWidth; height = LabComponents.FileUploadAreaArtworkHoverHeight; offset = LabComponents.FileUploadAreaArtworkHoverOffsetY }
        else -> { resource = Res.drawable.lab_file_upload_default; width = LabComponents.FileUploadAreaArtworkDefaultWidth; height = LabComponents.FileUploadAreaArtworkDefaultHeight; offset = LabComponents.FileUploadAreaArtworkDefaultOffsetY }
    }
    val frameWidth = if (dragging) LabComponents.FileUploadAreaDragIllustrationWidth else LabComponents.FileUploadAreaIllustrationWidth
    val frameHeight = if (dragging) LabComponents.FileUploadAreaDragIllustrationHeight else LabComponents.FileUploadAreaIllustrationHeight
    BoxWithConstraints(Modifier.widthIn(max = frameWidth.dp).fillMaxWidth()) {
        val scale = minOf(1f, maxWidth.value / frameWidth)
        Box(Modifier.size((frameWidth * scale).dp, (frameHeight * scale).dp)) {
            Image(painterResource(resource), null, Modifier.wrapContentSize(unbounded = true, align = Alignment.TopStart)
                .requiredSize((width * scale).dp, (height * scale).dp).offset(y = (offset * scale).dp), contentScale = ContentScale.FillBounds)
        }
    }
}
