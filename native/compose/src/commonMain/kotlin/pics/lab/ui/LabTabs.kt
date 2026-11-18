package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition

public enum class LabTabsVariant { Tinted, Underlined }
public enum class LabTabsOrientation { Horizontal, Vertical }
public enum class LabTabsEdge { Start, End }

@Immutable
public data class LabTabIconScope(public val color: Color, public val size: Dp)

/** [label] is also the accessible name of an icon-only tab; icons are decorative. */
@Immutable
public data class LabTabItem(
    public val value: String,
    public val label: String,
    public val disabled: Boolean = false,
    public val iconOnly: Boolean = false,
    public val icon: (@Composable LabTabIconScope.() -> Unit)? = null,
    public val iconEnd: (@Composable LabTabIconScope.() -> Unit)? = null,
)

/**
 * Controlled tabs. Focus can move without accepting [onValueChange]; selection never does.
 * All keyed panels retain their composition. Only [value]'s panel enters layout, semantics and focus.
 * The vertical list moves above the panel when their natural widths no longer fit together.
 */
@Composable
public fun LabTabs(
    value: String?,
    onValueChange: (String) -> Unit,
    items: List<LabTabItem>,
    modifier: Modifier = Modifier,
    variant: LabTabsVariant = LabTabsVariant.Underlined,
    orientation: LabTabsOrientation = LabTabsOrientation.Horizontal,
    edge: LabTabsEdge = LabTabsEdge.End,
    size: LabControlSize = LabControlSize.Medium,
    automatic: Boolean = true,
    label: String? = null,
    panelModifier: Modifier = Modifier,
    content: @Composable (String) -> Unit,
) {
    require(items.map { it.value }.distinct().size == items.size) { "Tab values must be unique" }
    require(items.all { it.label.isNotBlank() && (!it.iconOnly || it.icon != null) }) {
        "Every tab needs a label; an icon-only tab also needs an icon"
    }
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.TabsS
        LabControlSize.Medium -> LabComponents.TabsM
        LabControlSize.Large -> LabComponents.TabsL
    }
    val vertical = orientation == LabTabsOrientation.Vertical
    val navigation = tabNavigation(items.map { it.value to !it.disabled }, value, vertical, automatic, onValueChange)
    Layout(modifier = modifier, content = {
        TabList(items, value, variant, vertical, edge, metrics, navigation,
            Modifier.semantics { if (label != null) contentDescription = label })
        RetainedTabPanels(items.map { it.value }, value, panelModifier, content)
    }) { children, constraints ->
        val gap = LabTokens.Space4.dp.roundToPx()
        val naturalListWidth = if (vertical) children[0].maxIntrinsicWidth(constraints.maxHeight) else 0
        val sideBySide = vertical && (!constraints.hasBoundedWidth ||
            constraints.maxWidth - naturalListWidth - gap >= (metrics.fontSize * 10).sp.roundToPx())
        val listWidth = if (vertical) naturalListWidth.coerceAtMost(constraints.maxWidth) else constraints.maxWidth
        val listConstraints = if (listWidth == Constraints.Infinity) constraints.copy(minWidth = 0, minHeight = 0)
            else Constraints(minWidth = listWidth, maxWidth = listWidth, maxHeight = constraints.maxHeight)
        val list = children[0].measure(listConstraints)
        val panel = children[1].measure(Constraints(
            maxWidth = if (sideBySide && constraints.hasBoundedWidth) (constraints.maxWidth - list.width - gap).coerceAtLeast(0)
                else constraints.maxWidth,
            maxHeight = if (!sideBySide && constraints.hasBoundedHeight) (constraints.maxHeight - list.height - gap).coerceAtLeast(0)
                else constraints.maxHeight,
        ))
        val width = constraints.constrainWidth(if (sideBySide) list.width + gap + panel.width else maxOf(list.width, panel.width))
        val height = constraints.constrainHeight(if (sideBySide) maxOf(list.height, panel.height) else list.height + gap + panel.height)
        layout(width, height) {
            list.placeRelative(0, 0)
            if (sideBySide) panel.placeRelative(list.width + gap, 0) else panel.placeRelative(0, list.height + gap)
        }
    }
}

@Composable
private fun TabList(
    items: List<LabTabItem>, selected: String?, variant: LabTabsVariant, vertical: Boolean,
    edge: LabTabsEdge, metrics: LabTabsMetrics, navigation: TabNavigation, modifier: Modifier,
) {
    val colors = LocalLabTheme.current.colors
    val tinted = variant == LabTabsVariant.Tinted
    val padding = if (!tinted) 0.dp else if (!vertical && items.size == 4)
        LabComponents.TabsListFourHorizontalPadding.dp else LabComponents.TabsListPadding.dp
    val surface = modifier.then(navigation.group).selectableGroup().then(if (tinted)
        Modifier.background(colors[LabComponents.TabsRolesTrack], RoundedCornerShape(LabComponents.TabsListRadius.dp)) else Modifier)
    val triggers: @Composable (Dp) -> Unit = { minWidth ->
        items.forEachIndexed { index, item -> key(item.value) {
            LabTabControl(item, selected == item.value, variant, vertical, edge, metrics,
                separator = tinted && index < items.lastIndex && item.value != selected && items[index + 1].value != selected,
                modifier = navigation.triggers.getValue(item.value).then(if (vertical) Modifier.fillMaxWidth()
                    else Modifier.widthIn(min = minWidth)), onClick = { navigation.activate(item.value) })
        } }
    }
    if (vertical) Column(surface.width(IntrinsicSize.Max).padding(padding)) { triggers(0.dp) }
    else BoxWithConstraints(surface) {
        val share = if (items.isEmpty() || maxWidth == Dp.Infinity) 0.dp
            else ((maxWidth - padding * 2) / items.size).coerceAtLeast(0.dp)
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(padding)) { triggers(share) }
    }
}

@Composable
internal fun LabTabControl(
    item: LabTabItem, selected: Boolean, variant: LabTabsVariant, vertical: Boolean,
    edge: LabTabsEdge, metrics: LabTabsMetrics, separator: Boolean, modifier: Modifier, onClick: () -> Unit,
) {
    val theme = LocalLabTheme.current
    val colors = theme.colors
    val tinted = variant == LabTabsVariant.Tinted
    val interactions = remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val motion = rememberLabMotion()
    val selection = remember(motion) { motion.value(if (selected) 1f else 0f, "tabs.selection") }
    LaunchedEffect(selected, theme.preferences.reducedMotion) {
        val playback = motion.animate { to(selection, if (selected) 1f else 0f,
            MotionTransition.Tween(LabTokens.MotionTransitionDurationMs.toInt(),
                MotionEase.Bezier(LabTokens.MotionTransitionEase0, LabTokens.MotionTransitionEase1,
                    LabTokens.MotionTransitionEase2, LabTokens.MotionTransitionEase3))) }
        try { playback.finished.await() } finally { playback.stop() }
    }
    val radius = metrics.radius.dp
    val shape = if (tinted) RoundedCornerShape(radius) else when {
        vertical && edge == LabTabsEdge.Start -> RoundedCornerShape(topEnd = radius, bottomEnd = radius)
        vertical -> RoundedCornerShape(topStart = radius, bottomStart = radius)
        edge == LabTabsEdge.Start -> RoundedCornerShape(bottomStart = radius, bottomEnd = radius)
        else -> RoundedCornerShape(topStart = radius, topEnd = radius)
    }
    val labelColor = colors[when {
        item.disabled -> LabComponents.TabsRolesDisabledLabel
        selected || hovered -> LabComponents.TabsRolesLabel
        else -> LabComponents.TabsRolesInactiveLabel
    }]
    val iconSize = (if (!item.iconOnly) metrics.iconSize else if (metrics == LabComponents.TabsM &&
        !tinted && !vertical && edge == LabTabsEdge.End) LabComponents.TabsUnderlinedBottomIconOnlySize else metrics.iconOnlySize).dp
    val iconScope = LabTabIconScope(labelColor, iconSize)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Box(modifier.selectable(selected, enabled = !item.disabled, role = Role.Tab,
        interactionSource = interactions, indication = null, onClick = onClick)
        .semantics { if (item.iconOnly) contentDescription = item.label }
        .drawWithContent {
            drawContent()
            if (separator) {
                val stroke = LabComponents.TabsStrokeWidth.dp.toPx()
                val inset = LabComponents.TabsListSeparatorInset.dp.toPx()
                if (vertical) drawRect(colors[LabComponents.TabsRolesBorder], Offset(0f, size.height - stroke), Size(size.width, stroke))
                else drawRect(colors[LabComponents.TabsRolesBorder], Offset(if (rtl) 0f else size.width - stroke, inset),
                    Size(stroke, (size.height - inset * 2).coerceAtLeast(0f)))
            }
            if (focused && !item.disabled) {
                val stroke = LabComponents.TabsFocusWidth.dp.toPx()
                val inset = LabComponents.TabsFocusOffset.dp.toPx() + stroke / 2
                drawRoundRect(colors["border-focus"], Offset(inset, inset),
                    Size((size.width - 2 * inset).coerceAtLeast(0f), (size.height - 2 * inset).coerceAtLeast(0f)),
                    CornerRadius((radius.toPx() - inset).coerceAtLeast(0f)), style = Stroke(stroke))
            }
        }, contentAlignment = Alignment.Center) {
        if (hovered && !item.disabled && !selected)
            Box(Modifier.matchParentSize().background(colors[LabComponents.TabsRolesHover], shape))
        if (tinted) Box(Modifier.matchParentSize().graphicsLayer { alpha = selection.value }
            .labShadow(shape, LabComponents.TabsActiveShadow).background(colors[LabComponents.TabsRolesActiveFill], shape))
        Row(Modifier.defaultMinSize(minHeight = if (item.iconOnly) Dp.Unspecified else metrics.height.dp)
            .padding(metrics.padding.dp), horizontalArrangement = Arrangement.spacedBy(metrics.gap.dp),
            verticalAlignment = Alignment.CenterVertically) {
            if (item.icon != null) Box(Modifier.size(iconSize).clearAndSetSemantics {}, contentAlignment = Alignment.Center) { item.icon.invoke(iconScope) }
            if (!item.iconOnly) BasicText(item.label, Modifier.layout { child, constraints ->
                val paragraph = child.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity))
                val height = metrics.lineHeight.sp.roundToPx()
                layout(paragraph.width, constraints.constrainHeight(height)) { paragraph.placeRelative(0, (height - paragraph.height) / 2) }
            }, style = LabType.body().copy(
                color = labelColor, fontSize = metrics.fontSize.sp, lineHeight = metrics.lineHeight.sp,
                fontWeight = FontWeight(metrics.fontWeight.toInt()), letterSpacing = metrics.letterSpacing.sp,
                lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Fixed),
            ), softWrap = false)
            if (!item.iconOnly && item.iconEnd != null) Box(Modifier.size(metrics.iconSize.dp).clearAndSetSemantics {},
                contentAlignment = Alignment.Center) { item.iconEnd.invoke(LabTabIconScope(labelColor, metrics.iconSize.dp)) }
        }
        if (!tinted) Box(Modifier.matchParentSize()) {
            val strip = if (vertical) Modifier.align(if (edge == LabTabsEdge.Start) Alignment.CenterStart else Alignment.CenterEnd)
                .width(LabComponents.TabsStrokeWidth.dp).fillMaxHeight()
                else Modifier.align(if (edge == LabTabsEdge.Start) Alignment.TopCenter else Alignment.BottomCenter)
                    .height(LabComponents.TabsStrokeWidth.dp).fillMaxWidth()
            Box(strip.background(colors[LabComponents.TabsRolesBorder]))
            Box(strip.graphicsLayer { alpha = selection.value }.labShadow(RectangleShape, LabComponents.TabsActiveShadow)
                .background(colors[LabComponents.TabsRolesIndicator]))
        }
    }
}
