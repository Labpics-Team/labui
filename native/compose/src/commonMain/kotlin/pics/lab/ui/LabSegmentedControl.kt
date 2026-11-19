package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition

public enum class LabSegmentedShape { Rounded, Regular, Sharp }
@Immutable
public data class LabSegmentedIconScope(public val color: Color, public val size: Dp)
@Immutable
public data class LabSegmentedItem(
    public val value: String,
    public val label: String,
    public val disabled: Boolean = false,
    public val iconOnly: Boolean = false,
    public val icon: (@Composable LabSegmentedIconScope.() -> Unit)? = null,
    public val iconEnd: (@Composable LabSegmentedIconScope.() -> Unit)? = null,
)

/** Optional local state; a controlled consumer can supply value/onValueChange directly. */
@Stable
public class LabSegmentedState(initialValue: String? = null) {
    public var value: String? by mutableStateOf(initialValue)
}
@Composable
public fun rememberLabSegmentedState(defaultValue: String? = null): LabSegmentedState = rememberSaveable(
    saver = listSaver(save = { listOf(it.value) }, restore = { LabSegmentedState(it[0]) }),
) { LabSegmentedState(defaultValue) }

/** One radio choice within the current view. Stable values preserve focus through reordering. */
@Composable
public fun LabSegmentedControl(
    value: String?,
    onValueChange: (String) -> Unit,
    items: List<LabSegmentedItem>,
    modifier: Modifier = Modifier,
    shape: LabSegmentedShape = LabSegmentedShape.Rounded,
    enabled: Boolean = true,
    label: String? = null,
) {
    require(items.map { it.value }.distinct().size == items.size) { "Segment values must be unique" }
    require(items.all { it.label.isNotBlank() && (!it.iconOnly || it.icon != null) }) {
        "Every segment needs a label; an icon-only segment also needs an icon"
    }
    val navigation = selectionNavigation(items.map { it.value to (enabled && !it.disabled) }, value, onValueChange)
    val radius = when (shape) {
        LabSegmentedShape.Rounded -> LabComponents.SegmentedShapesRoundedTrackRadius
        LabSegmentedShape.Regular -> LabComponents.SegmentedShapesRegularTrackRadius
        LabSegmentedShape.Sharp -> LabComponents.SegmentedShapesSharpTrackRadius
    }.dp
    val padding = LabComponents.SegmentedPadding.dp
    val surface = RoundedCornerShape(radius)
    BoxWithConstraints(modifier.selectableGroup().semantics { if (label != null) contentDescription = label }
        .clip(surface).background(LocalLabTheme.current.colors[LabComponents.SegmentedRolesTrack], surface)) {
        val share = if (items.isEmpty() || maxWidth == Dp.Infinity) 0.dp
            else ((maxWidth - padding * 2) / items.size).coerceAtLeast(0.dp)
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(padding)) {
            items.forEachIndexed { index, item -> key(item.value) {
                SegmentedOption(item, item.value == value, enabled && !item.disabled, shape,
                    index < items.lastIndex && item.value != value && items[index + 1].value != value,
                    navigation[index].widthIn(min = share)) { onValueChange(item.value) }
            } }
        }
    }
}

@Composable
private fun SegmentedOption(item: LabSegmentedItem, selected: Boolean, enabled: Boolean,
    shape: LabSegmentedShape, separator: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val theme = LocalLabTheme.current
    val colors = theme.colors
    val interactions = remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val radius = when (shape) {
        LabSegmentedShape.Rounded -> LabComponents.SegmentedShapesRoundedControlRadius
        LabSegmentedShape.Regular -> LabComponents.SegmentedShapesRegularControlRadius
        LabSegmentedShape.Sharp -> LabComponents.SegmentedShapesSharpControlRadius
    }.dp
    val contour = RoundedCornerShape(radius)
    val color = colors[when {
        !enabled -> LabComponents.SegmentedRolesDisabledLabel
        selected || hovered -> LabComponents.SegmentedRolesLabel
        else -> LabComponents.SegmentedRolesInactiveLabel
    }]
    val iconSize = (if (item.iconOnly) LabComponents.SegmentedIconOnlySize else LabComponents.SegmentedIconSize).dp
    val iconScope = LabSegmentedIconScope(color, iconSize)
    val motion = rememberLabMotion()
    val opacity = remember(motion) { motion.value(if (selected) 1f else 0f, "segmented.selection") }
    LaunchedEffect(selected, theme.preferences.reducedMotion) {
        if (!selected) motion.animate { to(opacity, 0f, MotionTransition.Tween(0)) }.finished.await()
        else {
            val playback = motion.animate { to(opacity, 1f, MotionTransition.Tween(
                LabTokens.MotionTransitionDurationMs.toInt(), MotionEase.Bezier(
                    LabTokens.MotionTransitionEase0, LabTokens.MotionTransitionEase1,
                    LabTokens.MotionTransitionEase2, LabTokens.MotionTransitionEase3))) }
            try { playback.finished.await() } finally { playback.stop() }
        }
    }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Box(modifier.selectable(selected, enabled = enabled, role = Role.RadioButton,
        interactionSource = interactions, indication = null, onClick = onClick)
        .semantics { if (item.iconOnly) contentDescription = item.label }
        .drawWithContent {
            drawContent()
            if (separator) {
                val stroke = LabComponents.SegmentedStrokeWidth.dp.toPx()
                val inset = LabComponents.SegmentedSeparatorInset.dp.toPx()
                drawRect(colors[LabComponents.SegmentedRolesBorder],
                    Offset(if (rtl) 0f else size.width - stroke, inset),
                    Size(stroke, (size.height - inset * 2).coerceAtLeast(0f)))
            }
            if (focused && enabled) {
                val stroke = LabComponents.SegmentedFocusWidth.dp.toPx()
                val inset = LabComponents.SegmentedFocusInset.dp.toPx() + stroke / 2
                drawRoundRect(colors[LabComponents.SegmentedRolesFocus], Offset(inset, inset),
                    Size((size.width - inset * 2).coerceAtLeast(0f), (size.height - inset * 2).coerceAtLeast(0f)),
                    CornerRadius((radius.toPx() - inset).coerceAtLeast(0f)), style = Stroke(stroke))
            }
        }, contentAlignment = Alignment.Center) {
        if (hovered && enabled && !selected) Box(Modifier.matchParentSize().background(colors[LabComponents.SegmentedRolesHover], contour))
        if (selected) Box(Modifier.matchParentSize().graphicsLayer { alpha = opacity.value }
            .labShadow(contour, LabComponents.SegmentedActiveShadow).background(colors[LabComponents.SegmentedRolesActiveFill], contour))
        Row(Modifier.defaultMinSize(minHeight = LabComponents.SegmentedControlHeight.dp)
            .padding((if (item.iconOnly) LabComponents.SegmentedIconOnlyPadding else LabComponents.SegmentedControlPadding).dp),
            horizontalArrangement = Arrangement.spacedBy(LabComponents.SegmentedGap.dp), verticalAlignment = Alignment.CenterVertically) {
            if (item.icon != null) Box(Modifier.size(iconSize).clearAndSetSemantics {}, contentAlignment = Alignment.Center) { item.icon.invoke(iconScope) }
            if (!item.iconOnly) BasicText(item.label, Modifier.layout { child, constraints ->
                val paragraph = child.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity))
                val height = LabComponents.SegmentedLineHeight.sp.roundToPx()
                layout(paragraph.width, constraints.constrainHeight(height)) { paragraph.placeRelative(0, (height - paragraph.height) / 2) }
            }, style = LabType.body().withTypography(color = color, fontSize = LabComponents.SegmentedFontSize.sp,
                lineHeight = LabComponents.SegmentedLineHeight.sp, fontWeight = FontWeight(LabComponents.SegmentedFontWeight.toInt()),
                letterSpacing = LabComponents.SegmentedLetterSpacing.sp,
                lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Fixed)), softWrap = false)
            if (!item.iconOnly && item.iconEnd != null) Box(Modifier.size(iconSize).clearAndSetSemantics {}, contentAlignment = Alignment.Center) { item.iconEnd.invoke(iconScope) }
        }
    }
}
