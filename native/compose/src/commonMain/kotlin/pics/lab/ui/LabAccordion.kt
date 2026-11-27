package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.offset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition
import kotlin.math.roundToInt

public enum class LabAccordionOrientation { Vertical, Horizontal }

@Immutable
public data class LabAccordionItem(
    public val value: String,
    public val label: String,
    public val disabled: Boolean = false,
)

/**
 * Controlled disclosures. A rejected request leaves the panels unchanged.
 * Every keyed panel keeps its composition; hidden content leaves focus and semantics immediately.
 * Medium/vertical follows the author; other sizes and horizontal grouping are extensions.
 */
@Composable
public fun LabAccordion(
    value: List<String>,
    onValueChange: (List<String>) -> Unit,
    items: List<LabAccordionItem>,
    modifier: Modifier = Modifier,
    multiple: Boolean = false,
    collapsible: Boolean = true,
    disabled: Boolean = false,
    size: LabControlSize = LabControlSize.Medium,
    orientation: LabAccordionOrientation = LabAccordionOrientation.Vertical,
    content: @Composable (String) -> Unit,
) {
    require(items.map { it.value }.distinct().size == items.size) { "Accordion values must be unique" }
    require(items.all { it.label.isNotBlank() }) { "Every accordion item needs a label" }
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.AccordionS
        LabControlSize.Medium -> LabComponents.AccordionM
        LabControlSize.Large -> LabComponents.AccordionL
    }
    val expanded = value.toSet()
    val enabled = items.filterNot { disabled || it.disabled }.map { it.value }
    val requesters = remember(items.map { it.value }) { items.associate { it.value to FocusRequester() } }
    val horizontal = orientation == LabAccordionOrientation.Horizontal
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val request: (String) -> Unit = { item ->
        if (item in enabled) {
            val open = item in expanded
            if (!open || collapsible || multiple) {
                onValueChange(if (open) value.filterNot { it == item }
                    else if (multiple) (value + item).distinct() else listOf(item))
            }
        }
    }
    val panels: @Composable () -> Unit = {
        items.forEach { item -> key(item.value) {
            AccordionDisclosure(item, item.value in expanded, disabled || item.disabled,
                !multiple && !collapsible && item.value in expanded, metrics,
                requesters.getValue(item.value), Modifier.onPreviewKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    val index = enabled.indexOf(item.value)
                    if (index < 0) return@onPreviewKeyEvent false
                    val next = when (event.key) {
                        Key.MoveHome -> 0
                        Key.MoveEnd -> enabled.lastIndex
                        (if (horizontal) if (rtl) Key.DirectionLeft else Key.DirectionRight else Key.DirectionDown) -> (index + 1) % enabled.size
                        (if (horizontal) if (rtl) Key.DirectionRight else Key.DirectionLeft else Key.DirectionUp) -> (index + enabled.size - 1) % enabled.size
                        else -> return@onPreviewKeyEvent false
                    }
                    requesters.getValue(enabled[next]).requestFocus()
                    true
                }, { request(item.value) }) { content(item.value) }
        } }
    }
    Layout(modifier = modifier, content = panels) { children, constraints ->
        val width = if (horizontal && constraints.hasBoundedWidth && children.isNotEmpty())
            constraints.maxWidth / children.size else constraints.maxWidth
        val panelConstraints = if (width == Constraints.Infinity) constraints.copy(minWidth = 0, minHeight = 0)
            else Constraints(minWidth = width, maxWidth = width, maxHeight = constraints.maxHeight)
        val measured = children.map { it.measure(panelConstraints) }
        layout(constraints.constrainWidth(if (horizontal) measured.sumOf { it.width } else measured.maxOfOrNull { it.width } ?: 0),
            constraints.constrainHeight(if (horizontal) measured.maxOfOrNull { it.height } ?: 0 else measured.sumOf { it.height })) {
            var position = 0
            measured.forEach {
                it.placeRelative(if (horizontal) position else 0, if (horizontal) 0 else position)
                position += if (horizontal) it.width else it.height
            }
        }
    }
}

@Composable
private fun AccordionDisclosure(
    item: LabAccordionItem, expanded: Boolean, disabled: Boolean, fixed: Boolean,
    metrics: LabAccordionMetrics, focusRequester: FocusRequester, navigation: Modifier,
    onClick: () -> Unit, content: @Composable () -> Unit,
) {
    val theme = LocalLabTheme.current
    val colors = theme.colors
    val interactions = remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val motion = rememberLabMotion()
    val progress = remember(motion) { motion.value(if (expanded) 1f else 0f, "accordion.disclosure") }
    LaunchedEffect(expanded, theme.preferences.reducedMotion) {
        val playback = motion.animate { to(progress, if (expanded) 1f else 0f,
            MotionTransition.Tween(LabTokens.MotionTransitionDurationMs.toInt(),
                MotionEase.Bezier(LabTokens.MotionTransitionEase0, LabTokens.MotionTransitionEase1,
                    LabTokens.MotionTransitionEase2, LabTokens.MotionTransitionEase3))) }
        try { playback.finished.await() } finally { playback.stop() }
    }
    val labelColor = colors[if (disabled) LabComponents.AccordionRolesDisabled else LabComponents.AccordionRolesLabel]
    val shape = RoundedCornerShape(metrics.radius.dp)
    val text = LabType.body().copy(fontSize = metrics.fontSize.sp, lineHeight = metrics.lineHeight.sp,
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Tight))
    Column(Modifier.hoverable(interactions, enabled = !disabled)
        .then(if (hovered && !disabled) Modifier.background(colors[LabComponents.AccordionRolesHover], shape) else Modifier)) {
        Row(navigation.focusRequester(focusRequester)
            .clickable(enabled = !disabled, role = Role.Button, interactionSource = interactions, indication = null,
                onClick = { if (!fixed) onClick() })
            .semantics {
                heading()
                if (!disabled && !fixed) {
                    if (expanded) collapse { onClick(); true } else expand { onClick(); true }
                }
            }
            .fillMaxWidth()
            .drawWithContent {
                drawContent()
                if (focused) {
                    val stroke = LabTokens.FocusRingWidth.dp.toPx()
                    val inset = LabTokens.FocusRingOffset.dp.toPx() + stroke / 2
                    drawRoundRect(colors[LabComponents.AccordionRolesFocus], Offset(inset, inset),
                        Size((this.size.width - 2 * inset).coerceAtLeast(0f), (this.size.height - 2 * inset).coerceAtLeast(0f)),
                        CornerRadius((metrics.radius.dp.toPx() - inset).coerceAtLeast(0f)), style = Stroke(stroke))
                }
            }
            .layout { child, constraints ->
                val top = metrics.padding.dp.roundToPx()
                val bottom = (metrics.padding + (metrics.contentGap - metrics.padding) * progress.value).dp.roundToPx()
                val horizontal = top * 2
                val measured = child.measure(constraints.offset(-horizontal, -top - bottom))
                layout(constraints.constrainWidth(measured.width + horizontal), constraints.constrainHeight(measured.height + top + bottom)) {
                    measured.placeRelative(top, top)
                }
            }, horizontalArrangement = Arrangement.spacedBy(metrics.gap.dp), verticalAlignment = Alignment.CenterVertically) {
            LabText(item.label, Modifier.weight(1f), style = text.withTypography(color = labelColor,
                fontWeight = FontWeight(LabComponents.AccordionTitleWeight.toInt()), letterSpacing = LabComponents.AccordionTitleTracking.sp))
            Canvas(Modifier.size(metrics.iconSize.dp).align(if (expanded) Alignment.Top else Alignment.CenterVertically)
                .graphicsLayer { rotationZ = 180f * progress.value }.clearAndSetSemantics {}) {
                withTransform({ scale(this@Canvas.size.width / LabComponents.AccordionChevronViewBox,
                    this@Canvas.size.height / LabComponents.AccordionChevronViewBox, Offset.Zero)
                    translate(LabComponents.AccordionChevronX, LabComponents.AccordionChevronY) }) {
                    drawPath(LabComponents.AccordionChevronPath, labelColor)
                }
            }
        }
        RetainedDisclosure(expanded, { progress.value }, focusRequester) {
            Box(Modifier.padding(start = metrics.padding.dp, end = (metrics.padding + metrics.iconSize + metrics.gap).dp,
                bottom = metrics.padding.dp)) {
                androidx.compose.runtime.CompositionLocalProvider(LocalLabDisclosureText provides text.withTypography(
                    color = colors[LabComponents.AccordionRolesBody], fontWeight = FontWeight(LabComponents.AccordionBodyWeight.toInt()),
                    letterSpacing = (LabComponents.AccordionBodyTracking * metrics.fontSize / LabComponents.AccordionM.fontSize).sp), content = content)
            }
        }
    }
}

private val LocalLabDisclosureText = androidx.compose.runtime.staticCompositionLocalOf<TextStyle> {
    error("Use LabAccordionText inside LabAccordion content")
}

/** Default body typography; custom panel content may contain any controls or layout. */
@Composable
public fun LabAccordionText(text: String, modifier: Modifier = Modifier): Unit =
    LabText(text, modifier, style = LocalLabDisclosureText.current)

@Composable
private fun RetainedDisclosure(expanded: Boolean, progress: () -> Float, trigger: FocusRequester, content: @Composable () -> Unit) {
    var hasFocus by remember { mutableStateOf(false) }
    LaunchedEffect(expanded) { if (!expanded && hasFocus) trigger.requestFocus() }
    Layout(modifier = Modifier.clipToBounds(), content = {
        Box(Modifier.onFocusChanged { hasFocus = it.hasFocus }
            .focusProperties { onEnter = { if (!expanded) cancelFocusChange() } }.focusGroup()
            .then(if (expanded) Modifier else Modifier.clearAndSetSemantics {})) { content() }
    }) { children, constraints ->
        val fraction = progress().coerceIn(0f, 1f)
        val child = if (expanded || fraction > 0f) children.single().measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity)) else null
        layout(constraints.constrainWidth(child?.width ?: 0), constraints.constrainHeight(((child?.height ?: 0) * fraction).roundToInt())) {
            child?.placeRelative(0, 0)
        }
    }
}
