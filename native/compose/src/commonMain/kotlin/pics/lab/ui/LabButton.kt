package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.floor
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition

public enum class LabIntent { Accent, Neutral, Danger }
public enum class LabButtonKind { Fill, Tinted, Border, Ghost }
public enum class LabControlSize { Small, Medium, Large }

/** The button supplies icon paint and logical size; icon packages remain independent of LabUI. */
@Immutable
public data class LabButtonIconScope(public val color: Color, public val size: Dp)

@Composable
public fun LabButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    intent: LabIntent = LabIntent.Accent,
    kind: LabButtonKind = LabButtonKind.Fill,
    size: LabControlSize = LabControlSize.Medium,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingDescription: String = "Выполняется",
    description: String? = null,
    iconOnly: Boolean = false,
    icon: (@Composable LabButtonIconScope.() -> Unit)? = null,
    iconEnd: (@Composable LabButtonIconScope.() -> Unit)? = null,
) {
    require(!iconOnly || icon != null) { "An icon-only button requires an icon" }
    require(!iconOnly || text.isNotBlank()) { "An icon-only button requires an accessible name" }
    val theme = LocalLabTheme.current
    val colors = theme.colors
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val disabled = !enabled || loading
    val motion = rememberLabMotion()
    val pendingMotion = rememberLabMotion()
    val turn = remember(pendingMotion) { pendingMotion.value(0f, "button.pending") }
    val scale = remember(motion) { motion.value(1f, "button.press") }
    LaunchedEffect(pressed, disabled) {
        motion.animate { to(scale, if (pressed && !disabled) .98f else 1f, MotionTransition.Tween(120)) }
    }
    LaunchedEffect(loading, theme.preferences.reducedMotion) {
        if (loading && !theme.preferences.reducedMotion) {
            while (true) {
                val playback = pendingMotion.animate {
                    to(turn, turn.value + 360f, MotionTransition.Tween(LabComponents.ButtonLoaderPeriodMs.toInt(), MotionEase.Linear))
                }
                try { playback.finished.await() } finally { playback.stop() }
            }
        }
    }
    val intentName = intent.name.lowercase()
    val family = when (intent) { LabIntent.Accent -> "brand"; LabIntent.Danger -> "danger"; LabIntent.Neutral -> null }
    val fill = when {
        disabled -> if (kind == LabButtonKind.Fill || kind == LabButtonKind.Tinted) colors["fill-quaternary"] else Color.Transparent
        kind == LabButtonKind.Fill -> colors["fill-$intentName"]
        pressed -> if (kind == LabButtonKind.Tinted) colors[if (family == null) "fill-tertiary" else "fill-$family-primary"] else Color.Transparent
        hovered -> colors[if (family == null) "fill-quaternary" else "fill-$family-tertiary"]
        kind == LabButtonKind.Tinted -> colors[if (family == null) "fill-primary" else "fill-$intentName-tinted"]
        else -> Color.Transparent
    }
    val label = when {
        disabled -> colors["label-quaternary"]
        kind == LabButtonKind.Fill -> colors["label-on-$intentName"]
        intent == LabIntent.Neutral -> colors["label-primary"]
        else -> colors["label-$intentName"]
    }
    val stroke = when {
        kind != LabButtonKind.Border -> Color.Transparent
        disabled -> colors["border-soft"]
        family == null -> colors[if (pressed) "border-base" else "border-soft"]
        else -> colors["border-$family-${if (pressed) "base" else "soft"}"]
    }
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.ButtonS
        LabControlSize.Medium -> LabComponents.ButtonM
        LabControlSize.Large -> LabComponents.ButtonL
    }
    val shape = RoundedCornerShape(metrics.radius.dp)
    val gradient = when {
        pressed -> colors["bg-static-dark"].copy(alpha = LabComponents.ButtonFillPressedShade)
        hovered -> colors["bg-static-light"].copy(alpha = LabComponents.ButtonFillHoverHighlight)
        else -> colors["bg-static-light"].copy(alpha = LabComponents.ButtonFillHighlight)
    }
    val descriptionColor = when {
        disabled -> label
        intent == LabIntent.Neutral && kind != LabButtonKind.Fill -> colors["label-secondary"]
        intent == LabIntent.Accent && (kind == LabButtonKind.Border || kind == LabButtonKind.Ghost) ->
            label.copy(alpha = label.alpha * metrics.descriptionAccentPlainOpacity)
        else -> label.copy(alpha = label.alpha * LabComponents.ButtonDescriptionOpacity)
    }
    val surface = Modifier.clip(shape).background(fill).then(
        if (!disabled && kind == LabButtonKind.Fill) Modifier
            .background(Brush.verticalGradient(listOf(gradient, gradient.copy(alpha = 0f))))
            .innerShadow(shape, Shadow(radius = LabComponents.ButtonInnerShadowBlur.dp,
                color = colors["fx-control-inner"],
                offset = DpOffset(LabComponents.ButtonInnerShadowX.dp,
                    (if (pressed) -LabComponents.ButtonInnerShadowY else LabComponents.ButtonInnerShadowY).dp)))
        else Modifier)
    val iconScope = LabButtonIconScope(label, metrics.icon.dp)
    val labelStyle = LabType.body().withTypography(color = label, fontSize = metrics.fontSize.sp,
        lineHeight = metrics.lineHeight.sp, letterSpacing = metrics.letterSpacing.sp,
        fontWeight = FontWeight(LabComponents.ButtonFontWeight.toInt()))
    Box(modifier.graphicsLayer { scaleX = scale.value; scaleY = scale.value }
        .drawWithContent {
            if (focused && !disabled) {
                val width = LabTokens.FocusRingWidth.dp.toPx()
                val expansion = LabTokens.FocusRingOffset.dp.toPx() + width / 2
                drawRoundRect(colors["border-focus"], topLeft = Offset(-expansion, -expansion),
                    size = Size(this.size.width + expansion * 2, this.size.height + expansion * 2),
                    cornerRadius = CornerRadius(metrics.radius.dp.toPx() + expansion), style = Stroke(width))
            }
            drawContent()
        }
        .then(surface)
        .border(LabTokens.StrokeHairline.dp, stroke, shape)
        .clickable(enabled = !disabled, role = Role.Button, interactionSource = interactions, indication = null, onClick = onClick)
        .semantics {
            if (loading) stateDescription = loadingDescription
            if (iconOnly) contentDescription = text
        }
        .defaultMinSize(minHeight = metrics.height.dp, minWidth = if (iconOnly) metrics.height.dp else Dp.Unspecified)
        .padding(horizontal = if (iconOnly) 0.dp else metrics.paddingX.dp,
            vertical = if (iconOnly) 0.dp else metrics.paddingY.dp), contentAlignment = Alignment.Center) {
        Row(Modifier.alpha(if (loading) 0f else 1f), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) Box(Modifier.size(metrics.icon.dp), contentAlignment = Alignment.Center) { iconScope.icon() }
            if (!iconOnly) Row(Modifier.heightIn(min = metrics.icon.dp).padding(horizontal = LabComponents.ButtonLabelPaddingX.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(LabComponents.ButtonLabelGap.dp)) {
                LabText(text, style = labelStyle)
                if (description != null) LabText(description, style = labelStyle.withTypography(color = descriptionColor,
                    fontWeight = FontWeight(metrics.descriptionFontWeight.toInt()), letterSpacing = metrics.descriptionLetterSpacing.sp))
            }
            if (!iconOnly && iconEnd != null) Box(Modifier.size(metrics.icon.dp), contentAlignment = Alignment.Center) { iconScope.iconEnd() }
        }
        if (loading) Canvas(Modifier.size(metrics.icon.dp)) {
            val unit = this.size.width / LabComponents.ButtonLoaderSize
            val step = 360f / LabComponents.ButtonLoaderCount
            rotate(floor(turn.value / step) * step) {
                repeat(LabComponents.ButtonLoaderCount.toInt()) { index ->
                    rotate(index * step) {
                        drawRoundRect(label.copy(alpha = label.alpha * (index + 1) / LabComponents.ButtonLoaderCount),
                            topLeft = Offset(LabComponents.ButtonLoaderSegmentX * unit, LabComponents.ButtonLoaderSegmentY * unit),
                            size = Size(LabComponents.ButtonLoaderSegmentWidth * unit, LabComponents.ButtonLoaderSegmentHeight * unit),
                            cornerRadius = CornerRadius(LabComponents.ButtonLoaderSegmentRadius * unit))
                    }
                }
            }
        }
    }
}
