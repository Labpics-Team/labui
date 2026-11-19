package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth

/** A single native switch action. Accent uses the neutral off surface; Danger paints both values red. */
@Composable
public fun LabSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    intent: LabIntent = LabIntent.Accent,
    size: LabControlSize = LabControlSize.Medium,
    icon: Boolean = false,
    labelStart: String? = null,
    interactionSource: MutableInteractionSource? = null,
) {
    val colors = LocalLabTheme.current.colors
    val interactions = interactionSource ?: remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    val pressed by interactions.collectIsPressedAsState()
    val focused by interactions.collectIsFocusedAsState()
    val isPressed = enabled && pressed
    val isHovered = enabled && hovered && !isPressed
    val appearance = if (intent == LabIntent.Accent && !checked) LabIntent.Neutral else intent
    val colored = appearance != LabIntent.Neutral
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.SwitchS
        LabControlSize.Medium -> LabComponents.SwitchM
        LabControlSize.Large -> LabComponents.SwitchL
    }
    val targetPadding = when {
        isPressed -> LabComponents.SwitchThumbPressedPadding
        isHovered -> LabComponents.SwitchThumbHoverPadding
        else -> LabComponents.SwitchThumbPadding
    }
    val motion = rememberLabMotion()
    val progress = remember(motion) { motion.value(if (checked) 1f else 0f, "switch.thumb") }
    val padding = remember(motion) { motion.value(targetPadding, "switch.padding") }
    LaunchedEffect(checked, targetPadding) {
        motion.animate {
            to(progress, if (checked) 1f else 0f)
            to(padding, targetPadding)
        }
    }
    val thumbShape = remember(checked, icon, isPressed, colored) {
        if (icon && !(colored && isPressed && LabComponents.SwitchCutoutHideOnColoredPressed))
            SwitchThumbShape(checked)
        else CircleShape
    }
    val shadows = when {
        !enabled -> LabComponents.SwitchThumbDisabledShadow
        isPressed && colored && metrics.trackHeight >= LabComponents.SwitchThumbColoredPressedShadowMinimumTrackHeight ->
            LabComponents.SwitchThumbColoredPressedShadow
        isHovered && !colored && icon -> LabComponents.SwitchThumbNeutralIconHoverShadow
        isHovered -> LabComponents.SwitchThumbHoverShadow
        else -> LabComponents.SwitchThumbShadow
    }
    val trackRole = when {
        !enabled -> LabComponents.SwitchTrackDisabledRole
        appearance == LabIntent.Danger -> LabComponents.SwitchTrackDangerRole
        appearance == LabIntent.Accent -> LabComponents.SwitchTrackAccentRole
        isHovered -> LabComponents.SwitchTrackNeutralHoverRole
        else -> LabComponents.SwitchTrackNeutralRole
    }
    val focusRole = when (appearance) {
        LabIntent.Accent -> LabComponents.SwitchFocusAccentRole
        LabIntent.Danger -> LabComponents.SwitchFocusDangerRole
        LabIntent.Neutral -> LabComponents.SwitchFocusNeutralRole
    }
    val shade = when {
        isPressed -> colors["bg-static-dark"].copy(alpha = LabComponents.SwitchColoredFillPressedShade)
        isHovered -> colors["bg-static-light"].copy(alpha = LabComponents.SwitchColoredFillHoverHighlight)
        else -> colors["bg-static-light"].copy(alpha = LabComponents.SwitchColoredFillHighlight)
    }
    val tailOpacity = when {
        isPressed -> LabComponents.SwitchColoredFillGradientTailOpacityPressed
        isHovered -> LabComponents.SwitchColoredFillGradientTailOpacityHover
        else -> LabComponents.SwitchColoredFillGradientTailOpacityDefault
    }
    val labelStyle = LabType.body().withTypography(
        color = colors[LabComponents.SwitchLabelRole], fontSize = metrics.fontSize.sp,
        lineHeight = metrics.lineHeight.sp, letterSpacing = metrics.letterSpacing.sp,
        fontWeight = FontWeight(metrics.fontWeight.toInt()),
    )
    SwitchLayout(modifier.toggleable(checked, enabled = enabled, role = Role.Switch,
        interactionSource = interactions, indication = null, onValueChange = onCheckedChange)
        .heightIn(min = metrics.controlHeight.dp), labelStart, label, labelStyle, metrics.labelGap.dp) {
        Box(Modifier.size(metrics.trackWidth.dp, metrics.trackHeight.dp).drawWithContent {
            if (focused && enabled) {
                val width = LabComponents.SwitchFocusWidth.dp.toPx()
                val expansion = LabComponents.SwitchFocusOffset.dp.toPx() + width / 2
                drawRoundRect(colors[focusRole], topLeft = Offset(-expansion, -expansion),
                    size = Size(this.size.width + expansion * 2, this.size.height + expansion * 2),
                    cornerRadius = CornerRadius(this.size.height / 2 + expansion), style = Stroke(width))
            }
            drawContent()
        }.background(colors[trackRole], CircleShape).then(
            if (colored && enabled) Modifier
                .background(Brush.verticalGradient(listOf(shade, shade.copy(alpha = tailOpacity))), CircleShape)
                .innerShadow(CircleShape, Shadow(radius = LabComponents.SwitchInnerShadowBlur.dp,
                    color = colors[LabComponents.SwitchInnerShadowColorRole],
                    offset = DpOffset(LabComponents.SwitchInnerShadowX.dp,
                        (if (isPressed) LabComponents.SwitchInnerShadowPressedY else LabComponents.SwitchInnerShadowY).dp)))
            else Modifier,
        )) {
            val inset = padding.value.coerceIn(0f, metrics.trackHeight / 2)
            Box(Modifier.offset {
                IntOffset((inset + (metrics.trackWidth - metrics.trackHeight) * progress.value).dp.roundToPx(), inset.dp.roundToPx())
            }.size((metrics.trackHeight - 2 * inset).dp).labShadow(thumbShape, shadows)
                .background(colors[if (enabled) LabComponents.SwitchThumbFillRole else LabComponents.SwitchThumbDisabledFillRole], thumbShape))
        }
    }
}

/** Keep authored short labels compact; give long words a full line before they fragment. */
@Composable
private fun SwitchLayout(
    modifier: Modifier,
    labelStart: String?,
    label: String,
    style: TextStyle,
    gap: Dp,
    track: @Composable () -> Unit,
) {
    val hasStart = !labelStart.isNullOrEmpty()
    val hasEnd = label.isNotEmpty()
    val trackIndex = if (hasStart) 1 else 0
    Layout(modifier = modifier, content = {
        if (hasStart) BasicText(labelStart, style = style)
        track()
        if (hasEnd) BasicText(label, style = style)
    }) { measurables, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val control = measurables[trackIndex].measure(loose)
        val labels = measurables.indices.filter { it != trackIndex }
        val spacing = gap.roundToPx()
        val available = (constraints.maxWidth - control.width - labels.size * spacing).coerceAtLeast(0)
        val minimum = labels.map { measurables[it].minIntrinsicWidth(Constraints.Infinity) }
        val natural = labels.map { measurables[it].maxIntrinsicWidth(Constraints.Infinity) }
        val stacked = minimum.sum() > available
        // Intrinsic measurement precedes one actual measurement per child. The
        // same nodes survive reflow, preserving focus and pointer interaction.
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
                    val item = if (index == trackIndex) control else text[labels.indexOf(index)]
                    item.placeRelative(x, (height - item.height) / 2)
                    x += item.width + spacing
                }
            }
        }
    }
}

/** Keep the cutout transparent so the actual track and gradient remain visible. */
private class SwitchThumbShape(checked: Boolean) : Shape {
    private val template = PathParser().parsePathString(
        if (checked) LabComponents.SwitchCutoutOnData else LabComponents.SwitchCutoutOffData,
    ).toPath().apply {
        val winding = if (checked) LabComponents.SwitchCutoutOnWindingRule else LabComponents.SwitchCutoutOffWindingRule
        fillType = if (winding == "EVENODD") PathFillType.EvenOdd else PathFillType.NonZero
    }
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val diameter = size.minDimension
        val iconSize = diameter * LabComponents.SwitchCutoutDiameterRatio
        val cutout = Path().apply {
            addPath(template)
            transform(Matrix().apply { scale(iconSize / LabComponents.SwitchCutoutViewBox, iconSize / LabComponents.SwitchCutoutViewBox) })
            translate(Offset((diameter - iconSize) / 2, (diameter - iconSize) / 2))
        }
        val circle = Path().apply { addOval(Rect(Offset.Zero, size)) }
        return Outline.Generic(Path.combine(PathOperation.Difference, circle, cutout))
    }
}
