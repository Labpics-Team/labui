package pics.lab.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.icons.Icon
import pics.lab.icons.symbols.alertCircle
import pics.lab.icons.symbols.close

public enum class LabAlertType { Neutral, Danger }

@Immutable
public data class LabAlertIconScope(public val color: Color, public val size: Dp)

/** Persistent feedback with hoisted visibility and message storage. Quantity is capped visual depth. */
@Composable
public fun LabAlert(
    heading: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null,
    type: LabAlertType = LabAlertType.Neutral,
    quantity: Int = 1,
    open: Boolean = true,
    showIcon: Boolean = true,
    icon: (@Composable LabAlertIconScope.() -> Unit)? = null,
    closeLabel: String = "Закрыть уведомление",
    announcement: LiveRegionMode = LiveRegionMode.Polite,
    notificationKey: Any? = heading to description,
    material: LabMaterial = LabMaterial.Solid,
    restoreFocus: FocusRequester? = null,
) {
    require(closeLabel.isNotBlank()) { "Alert close requires an accessible name" }
    if (!open) return
    val colors = LocalLabTheme.current.colors
    val shape = RoundedCornerShape(LabComponents.AlertRadius.dp)
    val size = LabComponents.AlertIconSize.dp
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val iconColor = colors[if (type == LabAlertType.Danger) LabComponents.AlertRolesDangerIcon else LabComponents.AlertRolesIcon]
    val closeColor = colors[if (hovered) LabComponents.AlertRolesHeading else LabComponents.AlertRolesClose]
    val border = colors[LabComponents.AlertRolesBorder]
    val focus = colors[LabComponents.AlertRolesFocus]
    val headingStyle = LabType.body().withTypography(fontSize = LabComponents.AlertHeadingFontSize.sp,
        lineHeight = LabComponents.AlertHeadingLineHeight.sp, fontWeight = FontWeight(LabComponents.AlertHeadingFontWeight.toInt()),
        letterSpacing = LabComponents.AlertHeadingLetterSpacing.sp).copy(color = colors[LabComponents.AlertRolesHeading])
    val descriptionStyle = LabType.body().withTypography(fontSize = LabComponents.AlertDescriptionFontSize.sp,
        lineHeight = LabComponents.AlertDescriptionLineHeight.sp, fontWeight = FontWeight(LabComponents.AlertDescriptionFontWeight.toInt()),
        letterSpacing = LabComponents.AlertDescriptionLetterSpacing.sp).copy(color = colors[LabComponents.AlertRolesDescription])
    Column(modifier) {
        LabSurface(LabComponents.AlertMaterial,
            Modifier.fillMaxWidth().border(LabComponents.AlertStrokeWidth.dp, border, shape), material, shape) {
            Row(Modifier.padding(LabComponents.AlertPadding.dp), horizontalArrangement = Arrangement.spacedBy(LabComponents.AlertActionGap.dp)) {
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(LabComponents.AlertLabelGap.dp)) {
                    if (showIcon) Box(Modifier.size(size).clearAndSetSemantics {}) {
                        if (icon == null) Icon(alertCircle, tint = iconColor, size = size)
                        else LabAlertIconScope(iconColor, size).icon()
                    }
                    key(notificationKey) {
                        Column(Modifier.weight(1f).padding(start = LabComponents.AlertContentPaddingStart.dp)
                            .semantics(mergeDescendants = true) { liveRegion = announcement }) {
                            LabText(heading, style = headingStyle)
                            if (!description.isNullOrEmpty()) LabText(description, style = descriptionStyle)
                        }
                    }
                }
                Box(Modifier.size(size).drawWithContent {
                    drawContent()
                    if (focused) {
                        val width = LabTokens.FocusRingWidth.dp.toPx()
                        val offset = LabTokens.FocusRingOffset.dp.toPx() + width / 2
                        drawRoundRect(focus, Offset(-offset, -offset), Size(this.size.width + 2 * offset, this.size.height + 2 * offset),
                            CornerRadius(LabComponents.AlertStackRadius.dp.toPx()), style = Stroke(width))
                    }
                }.semantics { contentDescription = closeLabel }
                    .clickable(interactionSource = interactions, indication = null, role = Role.Button) {
                        if (focused) restoreFocus?.requestFocus()
                        onDismiss()
                    }) { Icon(close, tint = closeColor, size = size) }
            }
        }
        if (quantity >= 2) AlertLayer(LabComponents.AlertStackFirstInset.dp, LabComponents.AlertStackFirstOpacity,
            LabComponents.AlertStackFirstMaterial, material)
        if (quantity >= 3) AlertLayer(LabComponents.AlertStackSecondInset.dp, LabComponents.AlertStackSecondOpacity,
            LabComponents.AlertStackSecondMaterial, material)
    }
}

@Composable
private fun AlertLayer(inset: Dp, opacity: Float, recipe: LabMaterialRecipe, material: LabMaterial) {
    val shape = RoundedCornerShape(bottomStart = LabComponents.AlertStackRadius.dp, bottomEnd = LabComponents.AlertStackRadius.dp)
    val border = LocalLabTheme.current.colors[LabComponents.AlertRolesBorder]
    Box(Modifier.fillMaxWidth().padding(horizontal = inset).height(LabComponents.AlertStackHeight.dp)
        .alpha(opacity).clip(shape).border(LabComponents.AlertStrokeWidth.dp, border, shape).clearAndSetSemantics {}) {
        // The source exposes the bottom half of a 16-unit material through an
        // 8-unit stack slice. That decoration never increases measured height.
        Layout(modifier = Modifier.matchParentSize(), content = { LabSurface(recipe, Modifier, material, shape) {} }) { measurables, constraints ->
            val slice = LabComponents.AlertStackHeight.dp.roundToPx()
            val materialPlane = measurables.single().measure(constraints.copy(minHeight = slice * 2, maxHeight = slice * 2))
            layout(materialPlane.width, slice) { materialPlane.placeRelative(0, -slice) }
        }
    }
}
