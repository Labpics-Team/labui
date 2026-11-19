package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max

public enum class LabBreadcrumbSize { Small, Medium, Large }

/** The app supplies navigation; a null action represents a grouping label. */
public data class LabBreadcrumbItem(public val label: String, public val id: String? = null, public val onNavigate: (() -> Unit)? = null)

/** Root-to-current hierarchy with a single inline disclosure for hidden middle levels. */
@Composable
public fun LabBreadcrumb(
    items: List<LabBreadcrumbItem>,
    modifier: Modifier = Modifier,
    size: LabBreadcrumbSize = LabBreadcrumbSize.Medium,
    maxItems: Int = LabComponents.BreadcrumbDefaultMaxItems.toInt(),
    label: String = "Навигационная цепочка",
    expandLabel: String = "Показать все разделы",
) {
    val metrics = when (size) {
        LabBreadcrumbSize.Small -> LabComponents.BreadcrumbS
        LabBreadcrumbSize.Medium -> LabComponents.BreadcrumbM
        LabBreadcrumbSize.Large -> LabComponents.BreadcrumbL
    }
    val limit = if (maxItems == 0 || maxItems >= 3) maxItems else LabComponents.BreadcrumbDefaultMaxItems.toInt()
    var expanded by remember { mutableStateOf(false) }
    var restoreFocus by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    val firstRevealedAction = (1 until max(1, items.size - limit + 2))
        .firstOrNull { it < items.lastIndex && items[it].onNavigate != null }
    val indices = if (expanded || limit == 0 || items.size <= limit) items.indices.toList()
        else listOf(0, -1) + (items.size - limit + 2 until items.size)
    val occurrences = mutableMapOf<String, Int>()
    val keys = items.map { item ->
        val identity = item.id?.let { "id:$it" } ?: "label:${item.label}"
        val occurrence = occurrences[identity] ?: 0
        occurrences[identity] = occurrence + 1
        "${identity.length}:$identity:$occurrence"
    }
    val colors = LocalLabTheme.current.colors
    val density = LocalDensity.current
    val scale = density.fontScale
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    LaunchedEffect(expanded, restoreFocus) {
        if (expanded && restoreFocus) {
            if (firstRevealedAction != null) focus.requestFocus()
            restoreFocus = false
        }
    }
    FlowRow(modifier.semantics { isTraversalGroup = true; contentDescription = label },
        horizontalArrangement = Arrangement.spacedBy((metrics.gap * scale).dp),
        verticalArrangement = Arrangement.spacedBy((metrics.gap * scale).dp)) {
        indices.forEachIndexed { position, index ->
            key(if (index == -1) "disclosure" else keys[index]) {
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy((metrics.gap * scale).dp)) {
                    if (index == -1) {
                        val interactions = remember { MutableInteractionSource() }
                        val focused by interactions.collectIsFocusedAsState()
                        val hovered by interactions.collectIsHoveredAsState()
                        Box(Modifier.size((metrics.icon * scale).dp)
                            .breadcrumbFocus(focused, colors[LabComponents.BreadcrumbRolesFocus])
                            .clickable(interactionSource = interactions, indication = null, role = Role.Button,
                                onClickLabel = expandLabel) { restoreFocus = true; expanded = true }
                            .semantics { contentDescription = expandLabel }) {
                            BreadcrumbGlyph(LabComponents.BreadcrumbGlyphsEllipsisPath,
                                LabComponents.BreadcrumbGlyphsEllipsisX, LabComponents.BreadcrumbGlyphsEllipsisY,
                                LabComponents.BreadcrumbGlyphsEllipsisViewBox,
                                colors[if (hovered) LabComponents.BreadcrumbRolesHover else LabComponents.BreadcrumbRolesLabel],
                                metrics.icon * scale, false)
                        }
                    } else {
                        val current = index == items.lastIndex
                        val item = items[index]
                        val interactions = remember { MutableInteractionSource() }
                        val focused by interactions.collectIsFocusedAsState()
                        val hovered by interactions.collectIsHoveredAsState()
                        val action = if (current) null else item.onNavigate
                        val paint = colors[if (current) LabComponents.BreadcrumbRolesCurrent
                            else if (action != null && hovered) LabComponents.BreadcrumbRolesHover else LabComponents.BreadcrumbRolesLabel]
                        var textModifier: Modifier = Modifier.weight(1f, fill = false)
                        if (index == firstRevealedAction) textModifier = textModifier.focusRequester(focus)
                        if (action != null) textModifier = textModifier
                            .breadcrumbFocus(focused, colors[LabComponents.BreadcrumbRolesFocus])
                            .clickable(interactionSource = interactions, indication = null, role = Role.Button, onClick = action)
                        if (current) textModifier = textModifier.semantics { selected = true }
                        // Trim only the outer leading. Wrapped lines retain a readable baseline distance.
                        val trim = with(density) { (metrics.multilineLineHeight - metrics.lineHeight).sp.roundToPx() }
                        LabText(item.label, textModifier.layout { measurable, constraints ->
                            val placeable = measurable.measure(constraints)
                            layout(placeable.width, max(0, placeable.height - trim)) {
                                placeable.placeRelative(0, -trim / 2)
                            }
                        }, style = LabType.body().withTypography(color = paint, fontSize = metrics.fontSize.sp,
                            lineHeight = metrics.multilineLineHeight.sp,
                            fontWeight = FontWeight(LabComponents.BreadcrumbFontWeight.toInt()),
                            letterSpacing = LabComponents.BreadcrumbLetterSpacing.sp,
                            lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center,
                                LineHeightStyle.Trim.None, LineHeightStyle.Mode.Tight)))
                    }
                    if (position < indices.lastIndex) BreadcrumbGlyph(LabComponents.BreadcrumbGlyphsChevronPath,
                        LabComponents.BreadcrumbGlyphsChevronX, LabComponents.BreadcrumbGlyphsChevronY,
                        LabComponents.BreadcrumbGlyphsChevronViewBox, colors[LabComponents.BreadcrumbRolesLabel],
                        metrics.icon * scale, rtl)
                }
            }
        }
    }
}

private fun Modifier.breadcrumbFocus(focused: Boolean, color: Color): Modifier = drawWithContent {
    drawContent()
    if (focused) drawRoundRect(color, cornerRadius = CornerRadius(LabTokens.RadiusXs.dp.toPx()),
        style = Stroke(LabTokens.FocusRingWidth.dp.toPx()))
}

@Composable
private fun BreadcrumbGlyph(path: Path, x: Float, y: Float, viewBox: Float, color: Color, extent: Float, rtl: Boolean) {
    Canvas(Modifier.size(extent.dp).clearAndSetSemantics {}) {
        withTransform({
            if (rtl) { translate(size.width, 0f); scale(-1f, 1f, pivot = androidx.compose.ui.geometry.Offset.Zero) }
            scale(size.width / viewBox, size.height / viewBox, pivot = androidx.compose.ui.geometry.Offset.Zero)
            translate(x, y)
        }) { drawPath(path, color) }
    }
}
