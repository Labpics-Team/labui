package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.sp
import pics.lab.motion.MotionTransition
import pics.lab.motion.MotionEase

public enum class LabIntent { Accent, Neutral, Danger }
public enum class LabButtonKind { Fill, Tinted, Border, Ghost }
public enum class LabControlSize { Small, Medium, Large }

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
    leading: (@Composable RowScope.() -> Unit)? = null,
) {
    val theme = LocalLabTheme.current
    val colors = theme.colors
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val motion = rememberLabMotion()
    val pendingMotion = rememberLabMotion()
    val turn = remember(pendingMotion) { pendingMotion.value(0f, "button.pending") }
    val scale = remember(motion) { motion.value(1f, "button.press") }
    LaunchedEffect(pressed) { motion.animate { to(scale, if (pressed) .98f else 1f, MotionTransition.Tween(120)) } }
    LaunchedEffect(loading, theme.preferences.reducedMotion) {
        if (loading && !theme.preferences.reducedMotion) {
            while (true) {
                val playback = pendingMotion.animate {
                    to(turn, turn.value + 360f, MotionTransition.Tween(900, MotionEase.Linear))
                }
                try { playback.finished.await() } finally { playback.stop() }
            }
        }
    }
    val intentName = intent.name.lowercase()
    val fill = if (!enabled || loading) colors["fill-primary"] else when (kind) {
        LabButtonKind.Fill -> colors["fill-$intentName"]
        LabButtonKind.Tinted -> colors[if (intent == LabIntent.Neutral) "fill-primary" else "fill-$intentName-tinted"]
        else -> Color.Transparent
    }
    val label = when {
        !enabled || loading -> colors["label-tertiary"]
        kind == LabButtonKind.Fill -> colors["label-on-$intentName"]
        intent == LabIntent.Neutral -> colors["label-primary"]
        else -> colors["label-$intentName"]
    }
    val stroke = when {
        focused -> colors["border-focus"]
        kind == LabButtonKind.Border -> colors[if (intent == LabIntent.Neutral) "border-base" else "border-$intentName"]
        else -> Color.Transparent
    }
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.ButtonS
        LabControlSize.Medium -> LabComponents.ButtonM
        LabControlSize.Large -> LabComponents.ButtonL
    }
    val fontSize = metrics.fontSize
    val shape = RoundedCornerShape(metrics.radius.dp)
    val gradient = when {
        pressed -> colors["bg-static-dark"].copy(alpha = LabComponents.ButtonFillPressedShade)
        hovered -> colors["bg-static-light"].copy(alpha = LabComponents.ButtonFillHoverHighlight)
        else -> colors["bg-static-light"].copy(alpha = LabComponents.ButtonFillHighlight)
    }
    val surface = Modifier.clip(shape).background(fill).then(
        if (enabled && !loading && kind == LabButtonKind.Fill) Modifier
            .background(Brush.verticalGradient(listOf(gradient, gradient.copy(alpha = 0f))))
            .innerShadow(shape, Shadow(radius = LabComponents.ButtonInnerShadowBlur.dp,
                color = colors["fx-control-inner"],
                offset = DpOffset(LabComponents.ButtonInnerShadowX.dp,
                    (if (pressed) -LabComponents.ButtonInnerShadowY else LabComponents.ButtonInnerShadowY).dp)))
        else Modifier)
    Box(modifier.graphicsLayer { scaleX = scale.value; scaleY = scale.value }
        .border(if (focused) LabTokens.FocusRingWidth.dp else 1.dp, stroke, shape)
        .then(surface)
        .clickable(enabled = enabled && !loading, role = Role.Button, interactionSource = interactions, indication = null, onClick = onClick)
        .semantics { if (loading) stateDescription = loadingDescription }
        .defaultMinSize(minHeight = metrics.height.dp)
        .padding(horizontal = metrics.paddingX.dp, vertical = metrics.paddingY.dp), contentAlignment = Alignment.Center) {
        Row(Modifier.alpha(if (loading) 0f else 1f), verticalAlignment = Alignment.CenterVertically) {
            leading?.invoke(this)
            Box(Modifier.heightIn(min = metrics.icon.dp).padding(horizontal = LabComponents.ButtonLabelPaddingX.dp), contentAlignment = Alignment.Center) {
                BasicText(text, style = LabType.body().copy(color = label, fontSize = fontSize.sp,
                    lineHeight = metrics.lineHeight.sp, letterSpacing = metrics.letterSpacing.sp,
                    fontWeight = FontWeight(LabComponents.ButtonFontWeight.toInt())))
            }
        }
        if (loading) Canvas(Modifier.size(fontSize.dp)) {
            drawArc(label, startAngle = turn.value, sweepAngle = 270f, useCenter = false,
                style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round))
        }
        // A state overlay preserves the complete label, line wrapping and measured width.
        if (enabled && kind != LabButtonKind.Fill && (pressed || hovered)) Box(Modifier.matchParentSize().background(
            colors["label-primary"].copy(alpha = if (pressed) LabTokens.StatePressed else LabTokens.StateHover)))
    }
}
