package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

public enum class LabChoiceboxLayout { Card, Row }

/** Decorative icon rendering receives the current enabled/disabled color. */
public data class LabChoiceboxIconScope(public val color: Color, public val size: Dp)

/** Content and icons are descriptive; the option itself is the only action. */
public data class LabChoiceboxItem(
    public val value: String,
    public val label: String,
    public val description: String? = null,
    public val disabled: Boolean = false,
    public val icon: (@Composable LabChoiceboxIconScope.() -> Unit)? = null,
    public val content: (@Composable () -> Unit)? = null,
)

/** Mutually exclusive whole-card choices, with the same keyboard model as RadioGroup. */
@Composable
public fun LabChoicebox(
    value: String?,
    onValueChange: (String) -> Unit,
    items: List<LabChoiceboxItem>,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    layout: LabChoiceboxLayout = LabChoiceboxLayout.Card,
    label: String? = null,
) {
    ChoiceboxGroup(if (value == null) emptySet() else setOf(value), { onValueChange(it.single()) },
        items, modifier, enabled, layout, label, multiple = false)
}

/** Independent whole-card choices. Each option is a native checkbox action. */
@Composable
public fun LabChoicebox(
    values: Set<String>,
    onValuesChange: (Set<String>) -> Unit,
    items: List<LabChoiceboxItem>,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    layout: LabChoiceboxLayout = LabChoiceboxLayout.Card,
    label: String? = null,
) {
    ChoiceboxGroup(values, onValuesChange, items, modifier, enabled, layout, label, multiple = true)
}

@Composable
private fun ChoiceboxGroup(
    values: Set<String>, onValuesChange: (Set<String>) -> Unit, items: List<LabChoiceboxItem>,
    modifier: Modifier, enabled: Boolean, layout: LabChoiceboxLayout, label: String?, multiple: Boolean,
) {
    require(items.map { it.value }.distinct().size == items.size) { "Choicebox values must be unique" }
    val navigation = if (multiple) items.map { Modifier } else selectionNavigation(
        items.map { it.value to (enabled && !it.disabled) }, values.firstOrNull(), { onValuesChange(setOf(it)) })
    val group = modifier.then(if (multiple) Modifier else Modifier.selectableGroup())
        .then(if (label != null) Modifier.semantics { contentDescription = label } else Modifier)
    val content: @Composable () -> Unit = {
        items.forEachIndexed { index, item -> key(item.value) {
            val interactions = remember { MutableInteractionSource() }
            val selected = item.value in values
            val active = enabled && !item.disabled
            val change = { onValuesChange(if (!multiple) setOf(item.value)
                else if (selected) values - item.value else values + item.value) }
            val action = if (multiple) navigation[index].toggleable(selected, enabled = active,
                role = Role.Checkbox, interactionSource = interactions, indication = null, onValueChange = { change() })
                else navigation[index].selectable(selected, enabled = active, role = Role.RadioButton,
                    interactionSource = interactions, indication = null, onClick = change)
            ChoiceboxOption(item, selected, active, multiple, layout, action, interactions)
        } }
    }
    if (layout == LabChoiceboxLayout.Card) FlowRow(group,
        horizontalArrangement = Arrangement.spacedBy(LabTokens.Space4.dp),
        verticalArrangement = Arrangement.spacedBy(LabTokens.Space4.dp), content = { content() })
    else Column(group, verticalArrangement = Arrangement.spacedBy(LabTokens.Space2.dp), content = { content() })
}

@Composable
internal fun ChoiceboxOption(
    item: LabChoiceboxItem, selected: Boolean, enabled: Boolean, multiple: Boolean, layout: LabChoiceboxLayout,
    modifier: Modifier, interactions: MutableInteractionSource,
) {
    val colors = LocalLabTheme.current.colors
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val shape = RoundedCornerShape(LabComponents.SelectionChoiceboxRadius.dp)
    val border = colors[if (selected && enabled) LabComponents.SelectionChoiceboxSelectedStrokeRole else LabComponents.SelectionChoiceboxStrokeRole]
    val labelStyle = LabType.body().copy(
        color = colors[if (enabled) LabComponents.SelectionRolesLabel else LabComponents.SelectionRolesDisabledLabel],
        fontSize = LabComponents.SelectionChoiceboxFontSize.sp,
        lineHeight = LabComponents.SelectionChoiceboxLineHeight.sp,
        letterSpacing = LabComponents.SelectionChoiceboxLetterSpacing.sp,
        fontWeight = FontWeight(LabComponents.SelectionChoiceboxFontWeight.toInt()),
    )
    val iconScope = LabChoiceboxIconScope(colors[if (enabled) LabComponents.SelectionChoiceboxIconRole else LabComponents.SelectionRolesDisabledLabel],
        LabComponents.SelectionChoiceboxIconSize.dp)
    val indicator: @Composable () -> Unit = {
        SelectionIndicator(if (selected) ToggleableState.On else ToggleableState.Off, !multiple,
            enabled, LabIntent.Accent, LabSelectionSize.Large, hovered, false)
    }
    val icon: @Composable () -> Unit = {
        Box(Modifier.size(iconScope.size).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
            item.icon?.invoke(iconScope)
        }
    }
    val label: @Composable () -> Unit = { BasicText(item.label, style = labelStyle) }
    val description: (@Composable () -> Unit)? = item.description?.let { value -> {
        BasicText(value, style = LabType.body().copy(
            color = colors[if (enabled) LabComponents.SelectionChoiceboxDescriptionRole else LabComponents.SelectionRolesDisabledLabel]))
    } }
    val bounds = if (layout == LabChoiceboxLayout.Card) Modifier.width(LabComponents.SelectionChoiceboxPreferredWidth.dp)
        .heightIn(min = LabComponents.SelectionChoiceboxCardHeight.dp)
        else Modifier.fillMaxWidth().heightIn(min = LabComponents.SelectionChoiceboxRowHeight.dp)
    val surface = modifier.then(bounds).drawWithContent {
        if (focused && enabled) {
            val stroke = LabComponents.SelectionFocusWidth.dp.toPx()
            val expansion = LabComponents.SelectionFocusOffset.dp.toPx() + stroke / 2
            drawRoundRect(colors[LabComponents.SelectionRolesFocusAccent], Offset(-expansion, -expansion),
                Size(size.width + expansion * 2, size.height + expansion * 2),
                CornerRadius(LabComponents.SelectionChoiceboxRadius.dp.toPx() + expansion), style = Stroke(stroke))
        }
        drawContent()
    }.background(if (hovered && enabled) colors[LabComponents.SelectionChoiceboxHoverFillRole] else Color.Transparent, shape)
        .border((if (selected && enabled) LabComponents.SelectionChoiceboxSelectedStrokeWidth else LabComponents.SelectionChoiceboxStrokeWidth).dp, border, shape)
        .padding(LabComponents.SelectionChoiceboxPadding.dp)
    if (layout == LabChoiceboxLayout.Card) Column(surface,
        verticalArrangement = Arrangement.spacedBy(LabComponents.SelectionChoiceboxCardContentGap.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            icon()
            indicator()
        }
        Column(verticalArrangement = Arrangement.spacedBy(LabTokens.Space1.dp)) {
            label(); description?.invoke(); item.content?.invoke()
        }
    } else ChoiceboxRowLayout(surface, if (item.icon == null) null else icon, label, description, item.content, indicator)
}

/** A long word gets the whole row before line breaking splits it into fragments. */
@Composable
private fun ChoiceboxRowLayout(
    modifier: Modifier, icon: (@Composable () -> Unit)?, label: @Composable () -> Unit,
    description: (@Composable () -> Unit)?, content: (@Composable () -> Unit)?,
    indicator: @Composable () -> Unit,
) {
    Layout(modifier = modifier, content = {
        icon?.invoke(); label(); description?.invoke()
        if (content != null) Column(verticalArrangement = Arrangement.spacedBy(LabTokens.Space1.dp)) { content() }
        indicator()
    }) { measurables, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val iconIndex = if (icon == null) -1 else 0
        val textIndex = if (icon == null) 0 else 1
        val iconPlaceable = if (iconIndex < 0) null else measurables[iconIndex].measure(loose)
        val control = measurables.last().measure(loose)
        val contentGap = LabComponents.SelectionChoiceboxRowContentGap.dp.roundToPx()
        val controlGap = LabComponents.SelectionChoiceboxHeaderGap.dp.roundToPx()
        val iconWidth = if (iconPlaceable == null) 0 else iconPlaceable.width + contentGap
        val available = (constraints.maxWidth - iconWidth - control.width - controlGap).coerceAtLeast(0)
        // Only our own text participates in intrinsic reflow. Consumer content
        // may use SubcomposeLayout (for example BoxWithConstraints or lazy lists),
        // which intentionally does not implement intrinsic measurement.
        val authoredText = textIndex until (textIndex + if (description == null) 1 else 2)
        val stacked = authoredText.any { measurables[it].minIntrinsicWidth(Constraints.Infinity) > available }
        val textPlaceables = (textIndex until measurables.lastIndex).map {
            measurables[it].measure(loose.copy(maxWidth = if (stacked) constraints.maxWidth else available))
        }
        val textGap = LabTokens.Space1.dp.roundToPx()
        val textWidth = textPlaceables.maxOf { it.width }
        val textHeight = textPlaceables.sumOf { it.height } + (textPlaceables.size - 1) * textGap
        val width = constraints.constrainWidth(if (stacked) maxOf(textWidth, iconWidth + control.width)
            else iconWidth + textWidth + controlGap + control.width)
        val headerHeight = maxOf(iconPlaceable?.height ?: 0, control.height)
        val height = constraints.constrainHeight(if (stacked) headerHeight + contentGap + textHeight
            else maxOf(headerHeight, textHeight))
        layout(width, height) {
            val textX = if (stacked) 0 else iconWidth
            var textY = if (stacked) headerHeight + contentGap else (height - textHeight) / 2
            for (text in textPlaceables) { text.placeRelative(textX, textY); textY += text.height + textGap }
            if (stacked) {
                iconPlaceable?.placeRelative(0, (headerHeight - iconPlaceable.height) / 2)
                control.placeRelative(width - control.width, (headerHeight - control.height) / 2)
            } else {
                iconPlaceable?.placeRelative(0, (height - iconPlaceable.height) / 2)
                control.placeRelative(width - control.width, (height - control.height) / 2)
            }
        }
    }
}
