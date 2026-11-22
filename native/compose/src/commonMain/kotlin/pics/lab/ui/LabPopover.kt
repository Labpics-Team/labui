package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import dev.chrisbanes.haze.hazeSource
import kotlin.math.roundToInt

public enum class LabPopoverPlacement { TopStart, Top, TopEnd, RightStart, Right, RightEnd, BottomStart, Bottom, BottomEnd, LeftStart, Left, LeftEnd }

internal class PopoverPosition(
    private val anchor: () -> IntRect,
    private val placement: LabPopoverPlacement,
    private val gap: Int,
    private val inset: Int,
    private val placed: (Int, IntOffset) -> Unit = { _, _ -> },
) : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
        val a = anchor(); val p = popupContentSize
        val requested = placement.ordinal / 3
        val alignment = placement.ordinal % 3
        fun main(side: Int) = when (side) { 0 -> a.top - p.height - gap; 1 -> a.right + gap; 2 -> a.bottom + gap; else -> a.left - p.width - gap }
        fun fits(side: Int): Boolean {
            val size = if (side % 2 == 0) p.height else p.width
            val limit = if (side % 2 == 0) windowSize.height else windowSize.width
            return main(side) >= inset && main(side) + size <= limit - inset
        }
        val side = if (!fits(requested) && fits((requested + 2) % 4)) (requested + 2) % 4 else requested
        val start = if (side % 2 == 0 && layoutDirection == LayoutDirection.Rtl) 2 - alignment else alignment
        val cross = when (start) {
            0 -> if (side % 2 == 0) a.left else a.top
            2 -> if (side % 2 == 0) a.right - p.width else a.bottom - p.height
            else -> if (side % 2 == 0) a.center.x - p.width / 2 else a.center.y - p.height / 2
        }
        val x = if (side % 2 == 0) cross else main(side)
        val y = if (side % 2 == 0) main(side) else cross
        val result = IntOffset(x.coerceIn(inset, maxOf(inset, windowSize.width - p.width - inset)),
            y.coerceIn(inset, maxOf(inset, windowSize.height - p.height - inset)))
        placed(side, result)
        return result
    }
}

/** Anchored task content with a retained scene. Apply the supplied anchor modifier
 * to the actual opening control. Modal mode hides the scene for assistive technology.
 */
@Composable
public fun LabPopoverHost(
    open: Boolean,
    title: String,
    onDismissRequest: () -> Unit,
    returnFocus: FocusRequester,
    modifier: Modifier = Modifier,
    description: String? = null,
    placement: LabPopoverPlacement = LabPopoverPlacement.Bottom,
    size: LabDialogSize = LabDialogSize.Medium,
    material: LabMaterial = LabMaterial.Acrylic,
    modal: Boolean = false,
    arrow: Boolean = true,
    closable: Boolean = false,
    closeLabel: String = "Закрыть",
    content: @Composable BoxScope.(Modifier) -> Unit,
    popover: @Composable ColumnScope.() -> Unit,
) {
    val capture = LocalLabCapture.current
    val colors = LocalLabTheme.current.colors
    var anchor by remember { mutableStateOf(IntRect.Zero) }
    val anchorModifier = Modifier.focusRequester(returnFocus).onGloballyPositioned {
        val r = it.boundsInWindow()
        anchor = IntRect(r.left.roundToInt(), r.top.roundToInt(), r.right.roundToInt(), r.bottom.roundToInt())
    }
    val focus = remember { FocusRequester() }
    val (present, reveal) = rememberDialogPresence(open)
    var wasOpen by remember { mutableStateOf(false) }
    LaunchedEffect(present) {
        if (present) wasOpen = true
        else if (wasOpen) { withFrameNanos {}; returnFocus.requestFocus() }
    }
    val density = LocalDensity.current
    val gap = with(density) { LabComponents.DialogAnchorGap.dp.roundToPx() }
    val inset = with(density) { LabComponents.DialogViewportGap.dp.roundToPx() }
    var side by remember { mutableIntStateOf(placement.ordinal / 3) }
    var origin by remember { mutableStateOf(IntOffset.Zero) }
    val provider = remember(placement, gap, inset) {
        PopoverPosition({ anchor }, placement, gap, inset) { nextSide, nextOrigin -> side = nextSide; origin = nextOrigin }
    }
    Box(modifier) {
        Box(Modifier.fillMaxSize().hazeSource(capture, zIndex = 1f).then(
            if (present && modal) Modifier.clearAndSetSemantics {}.focusProperties { onEnter = { cancelFocusChange() } } else Modifier,
        )) { content(anchorModifier) }
        if (present) {
            if (modal) Box(Modifier.fillMaxSize().graphicsLayer { alpha = reveal.value }.background(colors[LabComponents.DialogRolesScrim])
                .pointerInput(onDismissRequest) { detectTapGestures { onDismissRequest() } }.clearAndSetSemantics {})
            Popup(popupPositionProvider = provider, onDismissRequest = onDismissRequest,
                properties = PopupProperties(focusable = true)) {
                LaunchedEffect(Unit) { withFrameNanos {}; focus.requestFocus() }
                BoxWithConstraints {
                    val tail = if (arrow) LabComponents.DialogActionGap.dp else 0.dp
                    val availableHeight = maxHeight - LabComponents.DialogViewportGap.dp * 2 - tail * 2
                    Box(Modifier.widthIn(max = minOf(size.width(true) + tail * 2, maxWidth - LabComponents.DialogViewportGap.dp * 2))) {
                        DialogSurface(title, description, material,
                        Modifier.padding(tail).fillMaxWidth()
                            .heightIn(max = availableHeight)
                            .semantics { paneTitle = title; isTraversalGroup = true }
                            .focusRequester(focus).focusable().onPreviewKeyEvent {
                                if (it.key == Key.Escape && it.type == KeyEventType.KeyUp) { onDismissRequest(); true } else false
                            },
                        LabComponents.DialogRadius.dp, closable, closeLabel, onDismissRequest, null, popover, reveal, { side })
                        if (arrow) Canvas(Modifier.matchParentSize().graphicsLayer { alpha = reveal.value }.clearAndSetSemantics {}) {
                            val t = tail.toPx()
                            val inset = t + LabComponents.DialogRadius.dp.toPx()
                            val horizontal = side % 2 == 0
                            val extent = if (horizontal) this.size.width else this.size.height
                            val anchorCenter = if (horizontal) anchor.center.x - origin.x else anchor.center.y - origin.y
                            val center = anchorCenter.toFloat().coerceIn(minOf(inset, extent / 2), maxOf(extent / 2, extent - inset))
                            val path = Path()
                            when (side) {
                                0 -> { path.moveTo(center - t, this.size.height - t); path.lineTo(center, this.size.height); path.lineTo(center + t, this.size.height - t) }
                                1 -> { path.moveTo(t, center - t); path.lineTo(0f, center); path.lineTo(t, center + t) }
                                2 -> { path.moveTo(center - t, t); path.lineTo(center, 0f); path.lineTo(center + t, t) }
                                else -> { path.moveTo(this.size.width - t, center - t); path.lineTo(this.size.width, center); path.lineTo(this.size.width - t, center + t) }
                            }
                            path.close(); drawPath(path, colors["bg-secondary"])
                        }
                    }
                }
            }
        }
    }
}
