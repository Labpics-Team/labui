package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.triStateToggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth

/** Tiny is an unboxed mark, while Small is the authored 12 dp boxed control. */
public enum class LabSelectionSize { Tiny, Small, Medium, Large }

/** A controlled native checkbox. Activating a mixed checkbox selects it. */
@Composable
public fun LabCheckbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    indeterminate: Boolean = false,
    intent: LabIntent = LabIntent.Accent,
    size: LabSelectionSize = LabSelectionSize.Medium,
    labelStart: String? = null,
    interactionSource: MutableInteractionSource? = null,
) {
    val interactions = interactionSource ?: remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val state = if (indeterminate) ToggleableState.Indeterminate else if (checked) ToggleableState.On else ToggleableState.Off
    val metrics = selectionMetrics(size)
    SelectionLabelLayout(modifier.triStateToggleable(state, enabled = enabled, role = Role.Checkbox,
        interactionSource = interactions, indication = null,
        onClick = { onCheckedChange(indeterminate || !checked) }).heightIn(min = metrics.controlHeight.dp),
        labelStart, label, selectionLabelStyle(metrics, enabled), metrics.labelGap.dp) {
        SelectionIndicator(state, false, enabled, intent, size, hovered, focused)
    }
}

internal fun selectionMetrics(size: LabSelectionSize): LabSelectionMetrics = when (size) {
    LabSelectionSize.Tiny -> LabComponents.SelectionTINY
    LabSelectionSize.Small -> LabComponents.SelectionS
    LabSelectionSize.Medium -> LabComponents.SelectionM
    LabSelectionSize.Large -> LabComponents.SelectionL
}

@Composable
internal fun selectionLabelStyle(metrics: LabSelectionMetrics, enabled: Boolean): TextStyle = LabType.body().copy(
    color = LocalLabTheme.current.colors[if (enabled) LabComponents.SelectionRolesLabel else LabComponents.SelectionRolesDisabledLabel],
    fontSize = metrics.fontSize.sp, lineHeight = metrics.lineHeight.sp,
    fontWeight = FontWeight(metrics.fontWeight.toInt()), letterSpacing = metrics.letterSpacing.sp,
)

/** Drawing only: the surrounding native action supplies interaction and semantics. */
@Composable
internal fun SelectionIndicator(
    state: ToggleableState,
    radio: Boolean,
    enabled: Boolean,
    intent: LabIntent,
    size: LabSelectionSize,
    hovered: Boolean,
    focused: Boolean,
) {
    val colors = LocalLabTheme.current.colors
    val metrics = selectionMetrics(size)
    val tiny = size == LabSelectionSize.Tiny
    val selected = state != ToggleableState.Off
    val motion = rememberLabMotion()
    val reveal = remember(motion) { motion.value(if (selected) 1f else 0f, "selection.mark") }
    var lastSelectedState by remember { mutableStateOf(state) }
    val glyphState = if (selected) state else lastSelectedState
    SideEffect { if (selected) lastSelectedState = state }
    LaunchedEffect(selected) { motion.animate { to(reveal, if (selected) 1f else 0f) } }
    val shape = if (radio) CircleShape else RoundedCornerShape(metrics.checkboxRadius.dp)
    val activeColor = colors[when (intent) {
        LabIntent.Accent -> LabComponents.SelectionRolesAccent
        LabIntent.Neutral -> LabComponents.SelectionRolesNeutral
        LabIntent.Danger -> LabComponents.SelectionRolesDanger
    }]
    val disabledColor = colors[LabComponents.SelectionRolesDisabledFill]
    val surface = when {
        tiny || (radio && selected) -> Color.Transparent
        !enabled -> disabledColor
        selected -> activeColor
        hovered -> colors[LabComponents.SelectionRolesUncheckedHoverFill]
        else -> colors[LabComponents.SelectionRolesUncheckedFill]
    }
    val white = colors["bg-static-light"]
    val highlight = white.copy(alpha = if (hovered && enabled) LabComponents.SelectionFillHoverHighlight else LabComponents.SelectionFillHighlight)
    val gradient = Brush.verticalGradient(listOf(highlight, white.copy(alpha = 0f)))
    val focusColor = colors[when {
        !selected || intent == LabIntent.Neutral -> LabComponents.SelectionRolesFocusNeutral
        intent == LabIntent.Danger -> LabComponents.SelectionRolesFocusDanger
        else -> LabComponents.SelectionRolesFocusAccent
    }]
    val check = remember {
        PathParser().parsePathString(LabComponents.SelectionCheckboxGlyphData).toPath().apply {
            fillType = if (LabComponents.SelectionCheckboxGlyphWindingRule == "EVENODD") PathFillType.EvenOdd else PathFillType.NonZero
        }
    }
    val glyphColor = when {
        enabled && tiny -> activeColor
        enabled && intent == LabIntent.Neutral -> colors[LabComponents.SelectionRolesNeutralGlyph]
        enabled -> colors[LabComponents.SelectionRolesGlyph]
        tiny && intent == LabIntent.Neutral -> colors[LabComponents.SelectionCheckboxTinyDisabledNeutralGlyphRole]
        tiny -> colors[LabComponents.SelectionRolesDisabledLabel]
        else -> colors[LabComponents.SelectionRolesDisabledGlyph]
    }
    Box(Modifier.size(metrics.controlSize.dp).drawWithContent {
        if (focused && enabled) {
            val width = LabComponents.SelectionFocusWidth.dp.toPx()
            // Unselected tiny controls retain a keyboard focus target even though
            // the source's empty tiny/focus frame has no visible focus paint.
            val offset = if (tiny) {
                if (radio) LabComponents.SelectionFocusTinyRadioOffset else LabComponents.SelectionFocusTinyCheckboxOffset
            } else LabComponents.SelectionFocusOffset
            val expansion = offset.dp.toPx() + width / 2
            drawRoundRect(focusColor, Offset(-expansion, -expansion),
                Size(this.size.width + expansion * 2, this.size.height + expansion * 2),
                CornerRadius(if (radio) this.size.width / 2 + expansion else metrics.checkboxRadius.dp.toPx() + expansion),
                style = Stroke(width))
        }
        drawContent()
    }.background(surface, shape).then(
        if (!radio && !tiny && selected && enabled) Modifier.background(gradient, shape)
            .innerShadow(shape, Shadow(radius = LabComponents.SelectionCheckboxInnerShadowBlur.dp,
                color = colors[LabComponents.SelectionCheckboxInnerShadowColorRole],
                offset = DpOffset(LabComponents.SelectionCheckboxInnerShadowX.dp, LabComponents.SelectionCheckboxInnerShadowY.dp)))
        else Modifier,
    )) {
        Canvas(Modifier.matchParentSize()) {
            val alpha = reveal.value.coerceIn(0f, 1f)
            if (!tiny && !selected && enabled) {
                val stroke = 1.dp.toPx()
                drawRoundRect(colors[LabComponents.SelectionRolesUncheckedStroke], Offset(stroke / 2, stroke / 2),
                    Size(this.size.width - stroke, this.size.height - stroke),
                    CornerRadius(if (radio) this.size.width / 2 else metrics.checkboxRadius.dp.toPx() - stroke / 2), style = Stroke(stroke))
            }
            if (radio && (selected || alpha > 0f)) {
                val color = if (enabled) activeColor else disabledColor
                if (tiny) {
                    val radius = metrics.tinyDot.dp.toPx() / 2
                    drawCircle(color, radius, alpha = alpha)
                    if (enabled) drawCircle(Brush.verticalGradient(listOf(highlight, white.copy(alpha = 0f)),
                        startY = center.y - radius, endY = center.y + radius), radius, alpha = alpha)
                } else {
                    val stroke = (if (focused && enabled && intent == LabIntent.Accent) metrics.radioFocusStroke else metrics.radioStroke).dp.toPx()
                    val radius = (this.size.width - stroke) / 2
                    drawCircle(color, radius, style = Stroke(stroke), alpha = alpha)
                    if (enabled) drawCircle(gradient, radius, style = Stroke(stroke), alpha = alpha)
                }
            } else if (!radio && (selected || alpha > 0f)) {
                val glyph = metrics.glyphSize.dp.toPx()
                val left = (this.size.width - glyph) / 2
                if (glyphState == ToggleableState.Indeterminate) {
                    val top = metrics.mixedY.dp.toPx()
                    val height = metrics.mixedHeight.dp.toPx()
                    drawRoundRect(glyphColor, Offset(left, top), Size(glyph, height), CornerRadius(height / 2), alpha = alpha)
                    if (tiny && enabled) drawRoundRect(Brush.verticalGradient(listOf(highlight, white.copy(alpha = 0f)),
                        startY = top, endY = top + height), Offset(left, top), Size(glyph, height), CornerRadius(height / 2), alpha = alpha)
                } else withTransform({
                    translate(left, (this@Canvas.size.height - glyph) / 2)
                    scale(glyph / LabComponents.SelectionCheckboxGlyphViewBox, glyph / LabComponents.SelectionCheckboxGlyphViewBox, Offset.Zero)
                }) {
                    drawPath(check, glyphColor, alpha = alpha)
                    if (tiny && enabled) drawPath(check, Brush.verticalGradient(listOf(highlight, white.copy(alpha = 0f)), endY = LabComponents.SelectionCheckboxGlyphViewBox), alpha = alpha)
                }
            }
        }
    }
}

/** Both authored labels share the available width; long words can occupy a full line. */
@Composable
internal fun SelectionLabelLayout(
    modifier: Modifier, labelStart: String?, label: String, style: TextStyle, gap: Dp,
    indicator: @Composable () -> Unit,
) {
    val hasStart = !labelStart.isNullOrEmpty()
    val hasEnd = label.isNotEmpty()
    val controlIndex = if (hasStart) 1 else 0
    Layout(modifier = modifier, content = {
        if (hasStart) BasicText(labelStart, style = style)
        indicator()
        if (hasEnd) BasicText(label, style = style)
    }) { measurables, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val control = measurables[controlIndex].measure(loose)
        val labels = measurables.indices.filter { it != controlIndex }
        val spacing = gap.roundToPx()
        val available = (constraints.maxWidth - control.width - labels.size * spacing).coerceAtLeast(0)
        val minimum = labels.map { measurables[it].minIntrinsicWidth(Constraints.Infinity) }
        val natural = labels.map { measurables[it].maxIntrinsicWidth(Constraints.Infinity) }
        val stacked = minimum.sum() > available
        val widths = if (stacked) labels.map { constraints.maxWidth }
            else if (natural.sum() <= available) natural
            else if (labels.size == 1) listOf(available)
            else {
                val first = (available / 2).coerceIn(minimum[0], available - minimum[1])
                    .coerceAtMost(natural[0]).coerceAtLeast(available - natural[1])
                listOf(first, available - first)
            }
        val text = labels.mapIndexed { index, child -> measurables[child].measure(loose.copy(maxWidth = widths[index])) }
        val width = constraints.constrainWidth(if (stacked) maxOf(control.width, text.maxOf { it.width })
            else control.width + text.sumOf { it.width } + labels.size * spacing)
        val height = constraints.constrainHeight(if (stacked) control.height + text.sumOf { it.height } + labels.size * spacing
            else maxOf(control.height, text.maxOfOrNull { it.height } ?: 0))
        layout(width, height) {
            if (stacked) {
                var y = 0
                for (item in text) { item.placeRelative(0, y); y += item.height + spacing }
                control.placeRelative(0, y)
            } else {
                var x = 0
                for (index in measurables.indices) {
                    val item = if (index == controlIndex) control else text[labels.indexOf(index)]
                    item.placeRelative(x, (height - item.height) / 2)
                    x += item.width + spacing
                }
            }
        }
    }
}
