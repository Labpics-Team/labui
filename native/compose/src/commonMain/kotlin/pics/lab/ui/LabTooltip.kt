package pics.lab.ui

import androidx.compose.foundation.BasicTooltipBox
import androidx.compose.foundation.BasicTooltipState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.background
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absolutePadding
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberBasicTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.PopupPositionProvider
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition

public enum class LabTooltipTail { Chevron, Bubble, None }
public enum class LabTooltipPlacement { TopStart, Top, TopEnd, Right, BottomStart, Bottom, BottomEnd, Left }
private class TooltipCloseJob { var job: Job? = null }

@Stable
@OptIn(ExperimentalFoundationApi::class)
public class LabTooltipState internal constructor(internal val native: BasicTooltipState) {
    public val open: Boolean get() = native.isVisible
    public suspend fun show() { native.show() }
    public fun dismiss() { native.dismiss() }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
public fun rememberLabTooltipState(initiallyOpen: Boolean = false): LabTooltipState {
    val state = rememberBasicTooltipState(initialIsVisible = initiallyOpen, isPersistent = true)
    return remember(state) { LabTooltipState(state) }
}

/** A passive explanation. Foundation owns long-press recognition, popup lifetime
 * and the single-tooltip mutex. The actual control receives the supplied Modifier
 * so keyboard focus and supplementary semantics never create a second action.
 */
@Composable
@OptIn(ExperimentalFoundationApi::class)
public fun LabTooltip(
    text: String,
    modifier: Modifier = Modifier,
    state: LabTooltipState = rememberLabTooltipState(),
    type: LabTooltipType = LabTooltipType.Neutral,
    placement: LabTooltipPlacement = LabTooltipPlacement.Bottom,
    tail: LabTooltipTail = LabTooltipTail.Chevron,
    enabled: Boolean = true,
    closeDelayMillis: Long = 150,
    content: @Composable (Modifier) -> Unit,
) {
    require(closeDelayMillis >= 0) { "Tooltip close delay must be nonnegative" }
    val scope = rememberCoroutineScope()
    val closing = remember { TooltipCloseJob() }
    var focused by remember { mutableStateOf(false) }
    val interactions = remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val triggerInteractions = remember { MutableInteractionSource() }
    val triggerHovered by triggerInteractions.collectIsHoveredAsState()
    val bridge = remember(state, closeDelayMillis) {
        object : BasicTooltipState by state.native {
            override suspend fun show(mutatePriority: MutatePriority) { closing.job?.cancel(); state.native.show(mutatePriority) }
            override fun dismiss() {
                closing.job?.cancel()
                closing.job = scope.launch { delay(closeDelayMillis); if (!focused && !hovered && !triggerHovered) state.dismiss() }
            }
        }
    }
    LaunchedEffect(enabled) { if (!enabled) state.dismiss() }
    var wasFocused by remember { mutableStateOf(false) }
    LaunchedEffect(focused, enabled) {
        if (focused && enabled) { closing.job?.cancel(); if (!state.open) scope.launch { state.show() } }
        else if (wasFocused) bridge.dismiss()
        wasFocused = focused
    }
    var wasHovered by remember { mutableStateOf(false) }
    LaunchedEffect(hovered) { if (hovered) closing.job?.cancel() else if (wasHovered) bridge.dismiss(); wasHovered = hovered }
    var geometry by remember { mutableStateOf(TooltipGeometry(placement.side(), 0f)) }
    val density = LocalDensity.current
    val gap = with(density) { LabComponents.TooltipGap.dp.roundToPx() }
    val provider = remember(placement, gap) { TooltipPosition(placement, gap) { geometry = it } }
    BasicTooltipBox(positionProvider = provider, state = bridge,
        modifier = modifier, focusable = false, enableUserInput = enabled,
        tooltip = {
            TooltipSurface(text, type, tail, geometry,
                Modifier.hoverable(interactions))
        },
    ) {
        content(Modifier.hoverable(triggerInteractions, enabled).onFocusChanged { focused = it.isFocused }
            .onPreviewKeyEvent {
                if (it.key == Key.Escape && it.type == KeyEventType.KeyDown && state.open) {
                    closing.job?.cancel(); state.dismiss(); true
                } else false
            }.semantics { if (enabled) onLongClick(label = text) { scope.launch { state.show() }; true } })
    }
}

internal data class TooltipGeometry(val side: Int, val center: Float)
private fun LabTooltipPlacement.side() = when (this) {
    LabTooltipPlacement.TopStart, LabTooltipPlacement.Top, LabTooltipPlacement.TopEnd -> 0
    LabTooltipPlacement.Right -> 1
    LabTooltipPlacement.BottomStart, LabTooltipPlacement.Bottom, LabTooltipPlacement.BottomEnd -> 2
    LabTooltipPlacement.Left -> 3
}

internal class TooltipPosition(
    private val placement: LabTooltipPlacement, private val gap: Int,
    private val onPlaced: (TooltipGeometry) -> Unit,
) : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
        val a = anchorBounds; val p = popupContentSize
        var side = placement.side()
        fun main(s: Int) = when (s) { 0 -> a.top - p.height - gap; 1 -> a.right + gap; 2 -> a.bottom + gap; else -> a.left - p.width - gap }
        val extent = if (side % 2 == 0) p.height else p.width
        val limit = if (side % 2 == 0) windowSize.height else windowSize.width
        if (main(side) < gap || main(side) + extent > limit - gap) {
            val opposite = (side + 2) % 4
            if (main(opposite) >= gap && main(opposite) + extent <= limit - gap) side = opposite
        }
        val start = placement == LabTooltipPlacement.TopStart || placement == LabTooltipPlacement.BottomStart
        val end = placement == LabTooltipPlacement.TopEnd || placement == LabTooltipPlacement.BottomEnd
        val x = if (side % 2 == 1) main(side) else if (start != (layoutDirection == LayoutDirection.Rtl) && (start || end)) a.left else if (start || end) a.right - p.width else a.center.x - p.width / 2
        val y = if (side % 2 == 0) main(side) else a.center.y - p.height / 2
        val position = IntOffset(x.coerceIn(gap, maxOf(gap, windowSize.width - p.width - gap)), y.coerceIn(gap, maxOf(gap, windowSize.height - p.height - gap)))
        onPlaced(TooltipGeometry(side, (if (side % 2 == 0) a.center.x - position.x else a.center.y - position.y).toFloat()))
        return position
    }
}

@Composable
internal fun TooltipSurface(text: String, type: LabTooltipType, tail: LabTooltipTail, geometry: TooltipGeometry, modifier: Modifier = Modifier) {
    val colors = LocalLabTheme.current.colors
    val color = colors[type.surfaceRole]
    val extent = if (tail == LabTooltipTail.None) 0.dp else if (tail == LabTooltipTail.Bubble) LabComponents.TooltipTailBubbleHeight.dp else LabComponents.TooltipTailHeight.dp
    val side = geometry.side
    val motion = rememberLabMotion()
    val opacity = remember(motion) { motion.value(0f, "tooltip.entrance") }
    LaunchedEffect(motion) { motion.animate { to(opacity, 1f, MotionTransition.Tween(
        LabTokens.MotionEntranceDurationMs.toInt(), MotionEase.Bezier(LabTokens.MotionEntranceEase0,
            LabTokens.MotionEntranceEase1, LabTokens.MotionEntranceEase2, LabTokens.MotionEntranceEase3))) }.finished.await() }
    Box(modifier.graphicsLayer { alpha = opacity.value }.absolutePadding(left = if (side == 1) extent else 0.dp, top = if (side == 2) extent else 0.dp,
        right = if (side == 3) extent else 0.dp, bottom = if (side == 0) extent else 0.dp)) {
        val shape = TooltipBodyShape
        Box(Modifier.widthIn(max = LabComponents.TooltipMaxWidth.dp).defaultMinSize(minWidth = LabComponents.TooltipMinWidth.dp)
            .labShadow(shape, LabComponents.TooltipShadow).background(color, shape)
            .drawBehind {
                if (tail == LabTooltipTail.None) return@drawBehind
                val unit = 1.dp.toPx(); val half = LabComponents.TooltipTailWidth * unit / 2
                val edge = LabComponents.TooltipPadding * unit + half
                val axis = if (side % 2 == 0) size.width else size.height
                val center = (if (geometry.center == 0f) axis / 2 else geometry.center).coerceIn(minOf(edge, axis / 2), maxOf(axis - edge, axis / 2))
                withTransform({
                    when (side) {
                        0 -> translate(center - half, size.height)
                        1 -> { translate(0f, center - half); rotate(90f, androidx.compose.ui.geometry.Offset.Zero) }
                        2 -> { translate(center + half, 0f); rotate(180f, androidx.compose.ui.geometry.Offset.Zero) }
                        3 -> { translate(size.width, center + half); rotate(-90f, androidx.compose.ui.geometry.Offset.Zero) }
                    }
                    scale(unit, unit, androidx.compose.ui.geometry.Offset.Zero)
                    if (tail == LabTooltipTail.Bubble) translate(LabComponents.TooltipTailBubbleX, LabComponents.TooltipTailBubbleY)
                }) { drawPath(if (tail == LabTooltipTail.Bubble) LabComponents.TooltipTailBubblePath else LabComponents.TooltipTailChevronPath, color) }
            }.padding(LabComponents.TooltipPadding.dp)) {
            LabText(text, style = LabType.body().withTypography(color = colors[type.labelRole],
                fontSize = LabComponents.TooltipFontSize.sp, lineHeight = LabComponents.TooltipLineHeight.sp,
                fontWeight = FontWeight(LabComponents.TooltipFontWeight.toInt()), letterSpacing = LabComponents.TooltipLetterSpacing.sp))
        }
    }
}

private object TooltipBodyShape : Shape {
    override fun createOutline(size: androidx.compose.ui.geometry.Size, layoutDirection: LayoutDirection, density: androidx.compose.ui.unit.Density): Outline =
        Outline.Generic(LabComponents.TooltipBodyPath(size.width, size.height, density.density))
}
