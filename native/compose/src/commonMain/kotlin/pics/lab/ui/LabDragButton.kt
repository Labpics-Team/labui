package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitHorizontalTouchSlopOrCancellation
import androidx.compose.foundation.gestures.horizontalDrag
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.icons.Icon
import pics.lab.icons.symbols.checkmark
import pics.lab.icons.symbols.chevronForward
import pics.lab.motion.MotionTransition

public enum class LabDragButtonStatus { Idle, Pending, Success, Danger }
public enum class LabDragButtonSource { Drag, Press }

/** A single action with an optional drag gesture. Result and reset belong to the application. */
@Composable
public fun LabDragButton(
    label: String,
    onComplete: (LabDragButtonSource) -> Unit,
    modifier: Modifier = Modifier,
    status: LabDragButtonStatus = LabDragButtonStatus.Idle,
    resetKey: Any? = null,
    enabled: Boolean = true,
    helperText: String = "Swipe it",
    showHelper: Boolean = true,
    pendingText: String = "Pending",
    successText: String = "Success",
    dangerText: String = "Error",
) {
    require(label.isNotBlank()) { "Drag Button requires an accessible action label" }
    val theme = LocalLabTheme.current
    val colors = theme.colors
    var measuredWidth by remember { mutableStateOf(0) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val metrics = LabComponents.ButtonM
    var committed by remember(status, resetKey) { mutableStateOf(false) }
    var dragging by remember { mutableStateOf(false) }
    var cancelled by remember { mutableStateOf(false) }
    val effective = if (committed && status == LabDragButtonStatus.Idle) LabDragButtonStatus.Pending else status
    val active = enabled && effective == LabDragButtonStatus.Idle
    val callback by rememberUpdatedState(onComplete)
    val motion = rememberLabMotion()
    val progress = remember(motion) { motion.value(0f, "drag-button.progress") }
    LaunchedEffect(status, resetKey) { motion.animate { to(progress, 0f, MotionTransition.Tween(0)) }.finish() }
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    fun resetGesture() {
        cancelled = true
        dragging = false
        motion.animate { to(progress, 0f, MotionTransition.Tween(LabTokens.MotionTransitionDurationMs.toInt())) }
    }
    fun activate(source: LabDragButtonSource) {
        if (!enabled || committed || status != LabDragButtonStatus.Idle) return
        committed = true
        dragging = false
        callback(source)
    }
    val message = when (effective) {
        LabDragButtonStatus.Idle -> ""
        LabDragButtonStatus.Pending -> pendingText
        LabDragButtonStatus.Success -> successText
        LabDragButtonStatus.Danger -> dangerText
    }
    val fill = colors[if (!enabled) "fill-quaternary" else if (effective == LabDragButtonStatus.Danger) "fill-danger" else "fill-accent"]
    val ink = colors[if (!enabled) "label-quaternary" else if (effective == LabDragButtonStatus.Danger) "label-on-danger" else "label-on-accent"]
    val textStyle = LabType.body().withTypography(fontSize = metrics.fontSize.sp,
        lineHeight = metrics.lineHeight.sp, letterSpacing = metrics.letterSpacing.sp,
        fontWeight = FontWeight(LabComponents.ButtonFontWeight.toInt()))
    BoxWithConstraints(modifier.fillMaxWidth().heightIn(min = LabComponents.DragButtonHeight.dp)
        .drawWithContent {
            if (focused && enabled && !dragging) {
                val width = LabTokens.FocusRingWidth.dp.toPx()
                val expansion = LabTokens.FocusRingOffset.dp.toPx() + width / 2
                drawRoundRect(colors["border-focus"], Offset(-expansion, -expansion),
                    Size(size.width + expansion * 2, size.height + expansion * 2),
                    CornerRadius(LabComponents.DragButtonRadius.dp.toPx() + expansion), style = Stroke(width))
            }
            drawContent()
        }
        .onFocusChanged { if (!it.hasFocus && dragging) resetGesture() }
        .onPreviewKeyEvent { if (it.key == Key.Escape && dragging) { resetGesture(); true } else false }
        .clickable(enabled = enabled, role = Role.Button, interactionSource = interactions, indication = null) {
            if (active) activate(LabDragButtonSource.Press)
        }
        .clearAndSetSemantics {
            role = Role.Button; contentDescription = label
            if (!active) disabled()
            if (message.isNotEmpty()) { stateDescription = message; liveRegion = LiveRegionMode.Polite }
            onClick { if (active) { activate(LabDragButtonSource.Press); true } else false }
        }
        .onSizeChanged { measuredWidth = it.width }
        .pointerInput(active, resetKey, measuredWidth, rtl) {
            if (!active) return@pointerInput
            try {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    cancelled = false
                    val travel = size.width - (LabComponents.DragButtonPadding * 2 + metrics.height).dp.toPx()
                    if (travel <= 0) return@awaitEachGesture
                    var inside = true
                    fun move(x: Float, y: Float) {
                        inside = y >= 0 && y <= size.height
                        val next = (((x - down.position.x) * if (rtl) -1 else 1) / travel).coerceIn(0f, 1f)
                        motion.animate { to(progress, next, MotionTransition.Tween(0)) }.finish()
                    }
                    val start = awaitHorizontalTouchSlopOrCancellation(down.id) { change, _ ->
                        change.consume(); dragging = true; move(change.position.x, change.position.y)
                    }
                    if (start != null) {
                        val released = horizontalDrag(start.id) { change ->
                            change.consume()
                            if (!cancelled) move(change.position.x, change.position.y)
                        }
                        if (released && inside && !cancelled && progress.value >= 1f) activate(LabDragButtonSource.Drag)
                        else resetGesture()
                    }
                }
            } finally { if (dragging) resetGesture() }
        }) {
        val trackWidth = maxWidth.value
        // Mask belongs to helper + track, never the growing Button.
        Box(Modifier.matchParentSize().clipToBounds().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen; scaleX = if (rtl) -1f else 1f }) {
            if (showHelper && effective == LabDragButtonStatus.Idle) Box(Modifier.matchParentSize().padding(horizontal = (metrics.height + LabComponents.DragButtonPadding).dp), contentAlignment = Alignment.Center) {
                LabText(helperText, Modifier.graphicsLayer { scaleX = if (rtl) -1f else 1f },
                    style = textStyle.withTypography(color = colors[LabComponents.DragButtonRolesLabel]), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Canvas(Modifier.matchParentSize()) { drawRoundRect(colors[LabComponents.DragButtonRolesTrack], cornerRadius = CornerRadius(LabComponents.DragButtonRadius.dp.toPx())) }
            val blur = LabComponents.DragButtonMaskBlur
            val maskWidth = LabComponents.DragButtonMaskCount * LabComponents.DragButtonMaskWidth +
                (LabComponents.DragButtonMaskCount - 1) * LabComponents.DragButtonMaskGap
            Canvas(Modifier.requiredSize((maskWidth + blur * 2).dp, (LabComponents.DragButtonMaskHeight + blur * 2).dp)
                .align(Alignment.CenterEnd).absoluteOffset(x = (blur - ((maskWidth + blur * 2) - trackWidth).coerceAtLeast(0f) / 2).dp).graphicsLayer {
                    compositingStrategy = CompositingStrategy.Offscreen; blendMode = BlendMode.DstIn
                    renderEffect = BlurEffect(blur.dp.toPx() / 2, blur.dp.toPx() / 2)
                }) {
                repeat(LabComponents.DragButtonMaskCount.toInt()) { index ->
                    drawRect(Color.White, Offset((blur + index * (LabComponents.DragButtonMaskWidth + LabComponents.DragButtonMaskGap)).dp.toPx(), blur.dp.toPx()),
                        Size(LabComponents.DragButtonMaskWidth.dp.toPx(), LabComponents.DragButtonMaskHeight.dp.toPx()))
                }
            }
        }
        val innerWidth = maxWidth - (LabComponents.DragButtonPadding * 2).dp
        val width = if (effective == LabDragButtonStatus.Idle) metrics.height.dp + (innerWidth - metrics.height.dp) * progress.value else innerWidth
        Box(Modifier.padding(LabComponents.DragButtonPadding.dp).width(width).heightIn(min = metrics.height.dp)
            .labButtonSurface(RoundedCornerShape(metrics.radius.dp), fill, colors, enabled, dragging, active && hovered),
            contentAlignment = if (effective == LabDragButtonStatus.Idle) Alignment.CenterEnd else Alignment.Center) {
            if (dragging) Canvas(Modifier.requiredSize((LabComponents.DragButtonGlowSize + LabComponents.DragButtonGlowBlur * 2).dp)
                .align(Alignment.Center).absoluteOffset(LabComponents.DragButtonGlowOffsetX.dp, LabComponents.DragButtonGlowOffsetY.dp)
                .graphicsLayer { alpha = LabComponents.DragButtonGlowOpacity; renderEffect = BlurEffect(LabComponents.DragButtonGlowBlur.dp.toPx() / 2, LabComponents.DragButtonGlowBlur.dp.toPx() / 2) }) {
                drawCircle(colors[LabComponents.DragButtonGlowColorRole], radius = LabComponents.DragButtonGlowSize.dp.toPx() / 2)
            }
            if (effective == LabDragButtonStatus.Idle) Box(Modifier.size(metrics.height.dp), contentAlignment = Alignment.Center) {
                Icon(chevronForward, ink, Modifier.graphicsLayer { scaleX = if (rtl) -1f else 1f }, size = metrics.icon.dp)
            } else Row(Modifier.padding(horizontal = metrics.paddingX.dp, vertical = metrics.paddingY.dp), verticalAlignment = Alignment.CenterVertically) {
                if (effective == LabDragButtonStatus.Pending) LabLoader(modifier = Modifier.size(metrics.icon.dp).clearAndSetSemantics {}, size = LabControlSize.Small, tint = ink)
                else Icon(checkmark, ink, size = metrics.icon.dp)
                LabText(message, Modifier.padding(horizontal = LabComponents.ButtonLabelPaddingX.dp), style = textStyle.withTypography(color = ink))
            }
        }
    }
}
