package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.chrisbanes.haze.hazeSource
import pics.lab.icons.Icon
import pics.lab.icons.symbols.close
import pics.lab.motion.MotionValue

public enum class LabDialogSize { Small, Medium, Large }
internal fun LabDialogSize.width(popover: Boolean = false) = when (this) {
    LabDialogSize.Small -> if (popover) LabComponents.DialogPopoverWidthsS else LabComponents.DialogWidthsS
    LabDialogSize.Medium -> if (popover) LabComponents.DialogPopoverWidthsM else LabComponents.DialogWidthsM
    LabDialogSize.Large -> if (popover) LabComponents.DialogPopoverWidthsL else LabComponents.DialogWidthsL
}.dp

/** Retains the real backdrop while platform modality contains focus and IME.
 * The calling application decides when a completed operation closes the dialog.
 */
@Composable
public fun LabDialogHost(
    open: Boolean,
    title: String,
    onDismissRequest: () -> Unit,
    returnFocus: FocusRequester,
    modifier: Modifier = Modifier,
    description: String? = null,
    size: LabDialogSize = LabDialogSize.Medium,
    material: LabMaterial = LabMaterial.Acrylic,
    dismissOnOutside: Boolean = true,
    closeLabel: String = "Закрыть",
    closable: Boolean = true,
    initialFocus: FocusRequester? = null,
    actions: (@Composable () -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit,
    dialog: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val capture = LocalLabCapture.current
    val colors = LocalLabTheme.current.colors
    val fallbackFocus = remember { FocusRequester() }
    val (present, reveal) = rememberDialogPresence(open)
    var wasOpen by remember { mutableStateOf(false) }
    LaunchedEffect(present) {
        if (present) wasOpen = true
        else if (wasOpen) { withFrameNanos {}; returnFocus.requestFocus() }
    }
    Box(modifier) {
        Box(Modifier.fillMaxSize().hazeSource(capture, zIndex = 1f).then(
            if (present) Modifier.clearAndSetSemantics {}.focusProperties { onEnter = { cancelFocusChange() } }
            else Modifier,
        ), content = content)
        if (present) LabModal(onDismissRequest) {
            LaunchedEffect(Unit) { withFrameNanos {}; (initialFocus ?: fallbackFocus).requestFocus() }
            Box(Modifier.fillMaxSize().onPreviewKeyEvent {
                if (it.key == Key.Escape && it.type == KeyEventType.KeyUp) { onDismissRequest(); true } else false
            }) {
                Box(Modifier.fillMaxSize().graphicsLayer { alpha = reveal.value }.background(colors[LabComponents.DialogRolesScrim])
                    .pointerInput(dismissOnOutside, onDismissRequest) {
                        detectTapGestures { if (dismissOnOutside) onDismissRequest() }
                    }.clearAndSetSemantics {})
                BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding()
                    .padding(LabComponents.DialogViewportGap.dp), contentAlignment = Alignment.Center) {
                    val padding = if (maxWidth < LabComponents.DialogIntrinsicWidth.dp)
                        LabComponents.DialogRadius.dp else LabComponents.DialogPadding.dp
                    DialogSurface(
                        title, description, material,
                        Modifier.widthIn(max = size.width()).fillMaxWidth().heightIn(max = maxHeight)
                            .semantics { paneTitle = title; isTraversalGroup = true }
                            .focusRequester(fallbackFocus).focusable(),
                        padding, closable, closeLabel, onDismissRequest, actions, dialog, reveal,
                    )
                }
            }
        }
    }
}

@Composable
internal fun DialogSurface(
    title: String, description: String?, material: LabMaterial, modifier: Modifier,
    padding: androidx.compose.ui.unit.Dp, closable: Boolean, closeLabel: String,
    dismiss: () -> Unit, actions: (@Composable () -> Unit)?,
    content: (@Composable ColumnScope.() -> Unit)?,
    reveal: MotionValue,
    side: () -> Int = { 2 },
) {
    val colors = LocalLabTheme.current.colors
    Box(modifier) {
        LabSurface(LabComponents.DialogMaterial, Modifier.matchParentSize().dialogMaterialBounds(reveal, side), material,
            RoundedCornerShape(LabComponents.DialogRadius.dp),
            strokeWidth = LabComponents.DialogStrokeWidth.dp,
            strokeColor = colors[LabComponents.DialogRolesBorder],
        ) {}
        Column(Modifier.fillMaxWidth().dialogReveal(reveal, side).verticalScroll(rememberScrollState()).padding(padding),
            verticalArrangement = Arrangement.spacedBy(
                if (closable) LabComponents.DialogLabelGap.dp else padding),
        ) {
            Layout(modifier = Modifier.fillMaxWidth(), content = {
                LabText(title,
                    style = LabType.body().copy(color = colors[LabComponents.DialogRolesHeading]).withTypography(
                        fontSize = LabComponents.DialogHeadingFontSize.sp,
                        lineHeight = LabComponents.DialogHeadingLineHeight.sp,
                        fontWeight = FontWeight(LabComponents.DialogHeadingFontWeight.toInt()),
                        letterSpacing = LabComponents.DialogHeadingLetterSpacing.sp,
                    ))
                if (description != null) LabText(description,
                    style = LabType.body().copy(color = colors[LabComponents.DialogRolesDescription]).withTypography(
                        fontSize = LabComponents.DialogDescriptionFontSize.sp,
                        lineHeight = LabComponents.DialogDescriptionLineHeight.sp,
                        fontWeight = FontWeight(LabComponents.DialogDescriptionFontWeight.toInt()),
                        letterSpacing = LabComponents.DialogDescriptionLetterSpacing.sp,
                    ))
                if (closable) LabButton(closeLabel, dismiss,
                    intent = LabIntent.Neutral, kind = LabButtonKind.Ghost, size = LabControlSize.Small,
                    iconOnly = true, icon = { Icon(close, tint = color, size = LabComponents.DialogIconSize.dp) })
            }) { children, constraints ->
                val gap = LabComponents.DialogLabelGap.dp.roundToPx()
                val loose = constraints.copy(minWidth = 0, minHeight = 0)
                val close = if (closable) children.last().measure(loose) else null
                // Let the title keep whole words before giving room to the close control.
                // Reposition the same nodes so width and text-scale changes retain focus.
                val inline = close == null || children[0].minIntrinsicWidth(Constraints.Infinity) +
                    gap + close.width <= constraints.maxWidth
                val labelWidth = constraints.maxWidth - if (inline && close != null) close.width + gap else 0
                val heading = children[0].measure(loose.copy(maxWidth = labelWidth))
                val supporting = if (description != null) children[1].measure(loose.copy(maxWidth = labelWidth)) else null
                val labelHeight = heading.height + if (supporting != null) gap + supporting.height else 0
                val labelTop = if (!inline && close != null) close.height + gap else 0
                val height = maxOf(labelTop + labelHeight, close?.height ?: 0)
                layout(constraints.maxWidth, height) {
                    heading.placeRelative(0, labelTop)
                    supporting?.placeRelative(0, labelTop + heading.height + gap)
                    close?.placeRelative(constraints.maxWidth - close.width, 0)
                }
            }
            content?.invoke(this)
            actions?.invoke()
        }
    }
}

/** Authored confirmation. The safe Cancel action receives initial focus. */
@Composable
public fun LabAlertDialogHost(
    open: Boolean,
    title: String,
    description: String,
    onConfirm: () -> Unit,
    onDismissRequest: () -> Unit,
    returnFocus: FocusRequester,
    modifier: Modifier = Modifier,
    confirmLabel: String = "Продолжить",
    cancelLabel: String = "Отмена",
    pending: Boolean = false,
    material: LabMaterial = LabMaterial.Acrylic,
    content: @Composable BoxScope.() -> Unit,
) {
    val cancelFocus = remember { FocusRequester() }
    LabDialogHost(open, title, onDismissRequest, returnFocus, modifier,
        description = description, material = material, dismissOnOutside = false,
        closable = false, initialFocus = cancelFocus,
        actions = {
            val minimum = with(LocalDensity.current) {
                (LabComponents.DialogActionMinInlineEm * LabComponents.ButtonM.fontSize).sp.toDp()
            }
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val confirm: @Composable (Modifier) -> Unit = { buttonModifier ->
                    LabButton(confirmLabel, onConfirm, buttonModifier, loading = pending,
                        intent = LabIntent.Neutral, kind = LabButtonKind.Fill)
                }
                val cancel: @Composable (Modifier) -> Unit = { buttonModifier ->
                    LabButton(cancelLabel, onDismissRequest, buttonModifier.focusRequester(cancelFocus),
                        intent = LabIntent.Neutral, kind = LabButtonKind.Tinted)
                }
                if (maxWidth < minimum * 2 + LabComponents.DialogActionGap.dp)
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(LabComponents.DialogActionGap.dp)) {
                        confirm(Modifier.fillMaxWidth()); cancel(Modifier.fillMaxWidth())
                    }
                else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(LabComponents.DialogActionGap.dp)) {
                    confirm(Modifier.weight(1f)); cancel(Modifier.weight(1f))
                }
            }
        },
        content = content,
    )
}
