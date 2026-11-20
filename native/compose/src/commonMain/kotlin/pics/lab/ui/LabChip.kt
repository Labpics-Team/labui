package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

public enum class LabChipSize { Small, Medium }
public enum class LabChipMode { Filter, Action, Remove }

/** The leading slot receives authored size and paint without depending on an avatar package. */
@Immutable
public data class LabChipLeadingScope(public val size: Dp, public val color: Color)

/** A single native action. Active brand emphasis is independent of selection and pointer press. */
@Composable
public fun LabChip(
    text: String,
    modifier: Modifier = Modifier,
    mode: LabChipMode = LabChipMode.Filter,
    selected: Boolean = false,
    onSelectedChange: ((Boolean) -> Unit)? = null,
    onAction: (() -> Unit)? = null,
    onRemove: (() -> Unit)? = null,
    size: LabChipSize = LabChipSize.Medium,
    sharp: Boolean = false,
    active: Boolean = false,
    enabled: Boolean = true,
    loading: Boolean = false,
    accessibilityLabel: String? = null,
    loadingDescription: String = "Выполняется",
    showLeading: Boolean = false,
    leading: (@Composable LabChipLeadingScope.() -> Unit)? = null,
    interactionSource: MutableInteractionSource? = null,
    readOnly: Boolean = false,
) {
    require(readOnly || when (mode) {
        LabChipMode.Filter -> onSelectedChange != null
        LabChipMode.Action -> onAction != null
        LabChipMode.Remove -> onRemove != null && !accessibilityLabel.isNullOrBlank()
    }) { "Chip needs its mode's action; Remove also needs an explicit accessibilityLabel" }
    val metrics = when (size) {
        LabChipSize.Small -> LabComponents.ChipS
        LabChipSize.Medium -> LabComponents.ChipM
    }
    val colors = LocalLabTheme.current.colors
    val interactions = interactionSource ?: remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val isSelected = selected || mode == LabChipMode.Remove
    val interactive = enabled && !loading && !readOnly
    val isPressed = interactive && pressed
    val isActive = interactive && active && !isPressed
    val isHovered = interactive && hovered && !isPressed && !isActive
    val radius = if (sharp) LabComponents.ChipSharpRadius else metrics.radius
    val shape = RoundedCornerShape(radius.dp)
    val fill = when {
        !enabled && isSelected -> colors[LabComponents.ChipRolesDisabledSelected]
        isPressed -> if (isSelected) colors[LabComponents.ChipRolesHover] else Color.Transparent
        isActive && isSelected -> colors[LabComponents.ChipRolesActiveFill]
        isActive -> colors[LabComponents.ChipRolesActiveTint].copy(alpha = LabComponents.ChipActiveTintOpacity)
        isHovered -> colors[LabComponents.ChipRolesHover]
        isSelected -> colors[LabComponents.ChipRolesSelected]
        else -> Color.Transparent
    }
    val label = colors[when {
        !enabled -> LabComponents.ChipRolesDisabledLabel
        isActive && isSelected -> LabComponents.ChipRolesActiveSelectedLabel
        isActive -> LabComponents.ChipRolesActiveLabel
        else -> LabComponents.ChipRolesLabel
    }]
    val close = colors[when {
        !enabled -> LabComponents.ChipRolesDisabledLabel
        isActive && isSelected -> LabComponents.ChipRolesActiveSelectedLabel
        else -> LabComponents.ChipRolesClose
    }]
    val style = LabType.body().withTypography(
        color = label, fontSize = metrics.fontSize.sp, lineHeight = metrics.lineHeight.sp,
        fontWeight = FontWeight(metrics.fontWeight.toInt()), letterSpacing = metrics.letterSpacing.sp,
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Tight),
    )
    val action = if (readOnly) Modifier else when (mode) {
        LabChipMode.Filter -> Modifier.toggleable(selected, enabled = enabled, role = Role.Button,
            interactionSource = interactions, indication = null) { if (!loading) onSelectedChange?.invoke(it) }
        else -> Modifier.clickable(enabled = enabled, role = Role.Button,
            interactionSource = interactions, indication = null) {
                if (!loading) { if (mode == LabChipMode.Remove) onRemove?.invoke() else onAction?.invoke() }
            }
    }
    val skeletonRadius = if (size == LabChipSize.Small && !sharp)
        LabComponents.ChipSkeletonRoundedSmallRadius else LabComponents.ChipSkeletonRadius
    val direction = LocalLayoutDirection.current
    Box(modifier.then(action).semantics {
        if (accessibilityLabel != null) contentDescription = accessibilityLabel
        if (loading) { disabled(); stateDescription = loadingDescription }
    }.drawWithContent {
        if (focused && enabled && !readOnly) {
            val width = LabComponents.ChipFocusWidth.dp.toPx()
            val expansion = LabComponents.ChipFocusOffset.dp.toPx() + width / 2
            drawRoundRect(colors[LabComponents.ChipRolesFocus], topLeft = Offset(-expansion, -expansion),
                size = Size(this.size.width + expansion * 2, this.size.height + expansion * 2),
                cornerRadius = CornerRadius(radius.dp.toPx() + expansion), style = Stroke(width))
        }
        drawContent()
    }) {
        Box(Modifier.matchParentSize().background(fill, shape).then(
            if (isActive && isSelected) Modifier.background(Brush.verticalGradient(listOf(
                colors[LabComponents.ChipRolesHighlight].copy(alpha = LabComponents.ChipActiveHighlightOpacity),
                colors[LabComponents.ChipRolesHighlight].copy(alpha = 0f),
            )), shape) else Modifier,
        ).drawWithContent {
            drawContent()
            if (!isSelected && !isActive) {
                val stroke = LabComponents.ChipStrokeWidth.dp.toPx()
                val inset = stroke / 2
                drawRoundRect(colors[LabComponents.ChipRolesBorder], topLeft = Offset(inset, inset),
                    size = Size(this.size.width - stroke, this.size.height - stroke),
                    cornerRadius = CornerRadius((radius.dp.toPx() - inset).coerceAtLeast(0f)), style = Stroke(stroke))
            }
        })
        if (isPressed && !isSelected) ChipGlow(Modifier.matchParentSize(), shape, direction, false, colors[LabComponents.ChipRolesGlow])
        Row(Modifier.defaultMinSize(minHeight = metrics.height.dp)
            .padding(horizontal = metrics.paddingX.dp, vertical = metrics.paddingY.dp),
            horizontalArrangement = Arrangement.spacedBy(metrics.gap.dp), verticalAlignment = Alignment.CenterVertically) {
            if (showLeading) Box(Modifier.size(metrics.leadingSize.dp)
                .alpha(if (enabled) 1f else LabComponents.ChipDisabledLeadingOpacity).clearAndSetSemantics {},
                contentAlignment = Alignment.Center) { leading?.invoke(LabChipLeadingScope(metrics.leadingSize.dp, label)) }
            Row(Modifier.weight(1f, fill = false).then(if (loading) Modifier.background(
                colors[LabComponents.ChipRolesSkeleton], RoundedCornerShape(skeletonRadius.dp),
            ) else Modifier), horizontalArrangement = Arrangement.spacedBy(metrics.gap.dp),
                verticalAlignment = Alignment.CenterVertically) {
                LabText(text, Modifier.weight(1f, fill = false).alpha(if (loading) 0f else 1f).then(
                    if (accessibilityLabel != null) Modifier.clearAndSetSemantics {} else Modifier,
                ), style)
                if (isSelected && !readOnly) ChipClose(size, metrics.closeSize.dp, close, Modifier.alpha(if (loading) 0f else 1f))
            }
        }
        if (isPressed && isSelected) ChipGlow(Modifier.matchParentSize(), shape, direction, true, colors[LabComponents.ChipRolesGlow])
    }
}

@Composable
private fun ChipGlow(modifier: Modifier, shape: RoundedCornerShape, direction: LayoutDirection, selected: Boolean, color: Color) {
    val centerOffset = if (selected) LabComponents.ChipGlowSelectedCenterOffset else LabComponents.ChipGlowCenterOffset
    Layout(modifier = modifier.clip(shape).clearAndSetSemantics {}, content = {
        Box(Modifier.size(LabComponents.ChipGlowDiameter.dp)
            .blur((LabComponents.ChipGlowBlur / 2).dp, BlurredEdgeTreatment.Unbounded)
            .background(color.copy(alpha = color.alpha * LabComponents.ChipGlowOpacity), CircleShape))
    }) { children, constraints ->
        val diameter = LabComponents.ChipGlowDiameter.dp.roundToPx()
        val ellipse = children.single().measure(Constraints.fixed(diameter, diameter))
        layout(constraints.maxWidth, constraints.maxHeight) {
            val shift = centerOffset.dp.toPx() * if (direction == LayoutDirection.Ltr) 1 else -1
            ellipse.place(((constraints.maxWidth - diameter) / 2f + shift).roundToInt(), (constraints.maxHeight - diameter) / 2)
        }
    }
}

@Composable
private fun ChipClose(size: LabChipSize, diameter: Dp, color: Color, modifier: Modifier) {
    val small = size == LabChipSize.Small
    val path = if (small) LabComponents.ChipCloseSPath else LabComponents.ChipCloseMPath
    Box(modifier.size(diameter).clearAndSetSemantics {}.drawBehind {
        val box = if (small) LabComponents.ChipCloseSViewBox else LabComponents.ChipCloseMViewBox
        val x = if (small) LabComponents.ChipCloseSX else LabComponents.ChipCloseMX
        val y = if (small) LabComponents.ChipCloseSY else LabComponents.ChipCloseMY
        withTransform({
            scale(this@drawBehind.size.width / box, this@drawBehind.size.height / box, Offset.Zero)
            translate(x, y)
        }) { drawPath(path, color) }
    })
}
