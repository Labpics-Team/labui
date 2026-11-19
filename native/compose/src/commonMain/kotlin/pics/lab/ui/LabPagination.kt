package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
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

public enum class LabPaginationVariant { Numbered, Compact }

/** Controlled paged navigation. The application accepts requests and changes its data. */
@Composable
public fun LabPagination(
    page: Int,
    onPageChange: (Int) -> Unit,
    count: Int,
    modifier: Modifier = Modifier,
    pageSize: Int = 10,
    siblingCount: Int = 1,
    variant: LabPaginationVariant = LabPaginationVariant.Numbered,
    disabled: Boolean = false,
    ambient: Boolean = false,
    progress: Float? = null,
    material: LabMaterial = LabMaterial.Acrylic,
    label: String = "Pagination",
    previousLabel: String = "Previous page",
    nextLabel: String = "Next page",
    pageLabel: (Int) -> String = { "Page $it" },
) {
    val effectivePageSize = if (pageSize > 0) pageSize else 10
    val total = if (count <= 0) 0 else ((count.toLong() + effectivePageSize - 1) / effectivePageSize).toInt()
    val selectedPage = page.coerceIn(1, total.coerceAtLeast(1))
    val compact = variant == LabPaginationVariant.Compact
    val pages = paginationPages(selectedPage, total, siblingCount, compact)
    val scale = LocalDensity.current.fontScale
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val colors = LocalLabTheme.current.colors
    val compactColor = colors[if (ambient) LabComponents.PaginationCompactAmbientColorRole else LabComponents.PaginationCompactColorRole]
    val selectedFocus = remember { FocusRequester() }
    var focusWithin by remember { mutableStateOf(false) }
    val hadFocusBeforePageChange = focusWithin
    LaunchedEffect(selectedPage) {
        if (hadFocusBeforePageChange && compact && total > 0) selectedFocus.requestFocus()
    }
    val root = modifier.onFocusChanged { focusWithin = it.hasFocus }.focusGroup()
        .semantics { isTraversalGroup = true; contentDescription = label }
        .onPreviewKeyEvent { event ->
            if (!compact || disabled || total == 0 || event.type != KeyEventType.KeyDown) false else {
                val next = when (event.key) {
                    Key.MoveHome -> 1L
                    Key.MoveEnd -> total.toLong()
                    Key.DirectionRight -> selectedPage.toLong() + if (rtl) -1 else 1
                    Key.DirectionLeft -> selectedPage.toLong() + if (rtl) 1 else -1
                    else -> null
                }
                if (next == null) false else {
                    val destination = next.coerceIn(1L, total.toLong()).toInt()
                    if (destination != selectedPage) onPageChange(destination)
                    true
                }
            }
        }
    val content: @Composable () -> Unit = {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(if (compact) 0.dp else (LabComponents.PaginationGap * scale).dp),
            verticalArrangement = Arrangement.spacedBy((LabComponents.PaginationGap * scale).dp),
            modifier = if (compact) Modifier.padding(horizontal = ((LabComponents.PaginationCompactPadding - LabComponents.PaginationCompactGap / 2) * scale).dp) else Modifier) {
            if (!compact) PaginationButton(previousLabel, false, disabled || selectedPage <= 1, scale,
                chevron = true,
                onClick = { onPageChange(selectedPage - 1) }) { color -> PaginationChevron(color, scale, rtl) }
            pages.forEachIndexed { index, value ->
                key(if (value == 0) "gap-$index" else "page-$value") {
                    if (value == 0) Box(Modifier.size((LabComponents.PaginationControl * scale).dp).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
                        Canvas(Modifier.size((LabComponents.PaginationIcon * scale).dp)) {
                            val ratio = size.width / LabComponents.PaginationIcon
                            repeat(3) { dot -> drawCircle(colors[LabComponents.PaginationRolesChevron],
                                LabComponents.PaginationGlyphsEllipsisDiameter * ratio / 2,
                                Offset((3f + dot * (LabComponents.PaginationGlyphsEllipsisDiameter + LabComponents.PaginationGlyphsEllipsisGap)) * ratio,
                                    (LabComponents.PaginationGlyphsEllipsisOffsetY + LabComponents.PaginationGlyphsEllipsisDiameter / 2) * ratio)) }
                        }
                    } else {
                        val current = value == selectedPage
                        val receding = compact && ((index == 0 && value > 1) || (index == pages.lastIndex && value < total))
                        val ratio = progress?.let { if (it.isFinite()) it.coerceIn(0f, 1f) else 0f }
                        val width = if (compact && current && ratio != null) LabComponents.PaginationCompactTrack else LabComponents.PaginationCompactDot
                        PaginationButton(pageLabel(value), current, disabled, scale, compact, width,
                            if (compact) Modifier.focusProperties { canFocus = current }
                                .then(if (current) Modifier.focusRequester(selectedFocus) else Modifier) else Modifier,
                            onClick = { if (!current) onPageChange(value) }) { color ->
                            if (compact) Canvas(Modifier.size((width * scale).dp, (LabComponents.PaginationCompactDot * scale).dp).clearAndSetSemantics {}) {
                                val inactive = if (ambient) LabComponents.PaginationCompactAmbientInactiveOpacity else LabComponents.PaginationCompactInactiveOpacity
                                val opacity = if (current && !disabled) 1f else inactive
                                val factor = if (receding) LabComponents.PaginationCompactRecedingDot / LabComponents.PaginationCompactDot else 1f
                                val inset = size.height * (1 - factor) / 2
                                val radius = CornerRadius(size.height / 2)
                                drawRoundRect(compactColor.copy(alpha = compactColor.alpha * if (current && ratio != null) inactive else opacity),
                                    Offset(inset, inset), Size(size.width - 2 * inset, size.height - 2 * inset), radius)
                                if (current && ratio != null && ratio > 0) drawRoundRect(compactColor.copy(alpha = compactColor.alpha * opacity),
                                    Offset(if (rtl) size.width * (1 - ratio) else 0f, 0f), Size(size.width * ratio, size.height), radius)
                            } else LabText(value.toString(), style = LabType.body().withTypography(color = color,
                                fontSize = LabComponents.PaginationFontSize.sp, lineHeight = LabComponents.PaginationLineHeight.sp,
                                fontWeight = FontWeight(LabComponents.PaginationFontWeight.toInt()), letterSpacing = 0.sp,
                                lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Tight)))
                        }
                    }
                }
            }
            if (!compact) PaginationButton(nextLabel, false, disabled || selectedPage >= total, scale,
                chevron = true,
                onClick = { onPageChange(selectedPage + 1) }) { color -> PaginationChevron(color, scale, !rtl) }
        }
    }
    if (compact && ambient) LabSurface(LabComponents.PaginationCompactMaterial, root, material,
        RoundedCornerShape((LabComponents.PaginationCompactRadius * scale).dp)) { content() }
    else Box(root) { content() }
}

/** 0 is a passive ellipsis. Allocation is bounded by the visible window, not count. */
internal fun paginationPages(page: Int, total: Int, siblings: Int, compact: Boolean): List<Int> {
    if (total <= 0) return emptyList()
    if (compact) {
        val length = minOf(total, LabComponents.PaginationCompactVisiblePages.toInt())
        val first = (page - length / 2).coerceIn(1, total - length + 1)
        return (first..first + (length - 1)).toList()
    }
    val sibling = siblings.coerceIn(0, LabComponents.PaginationMaxSiblingCount.toInt())
    val number = sibling * 2 + 5
    if (total <= number) return (1..total).toList()
    val left = page > sibling + 3
    val right = page < total - 2 - sibling
    return when {
        !left && right -> (1..number - 2).toList() + listOf(0, total)
        left && !right -> listOf(1, 0) + (total - number + 3..total).toList()
        left && right -> listOf(1, 0) + (page - sibling..page + sibling).toList() + listOf(0, total)
        else -> (1..total).toList()
    }
}

@Composable
private fun PaginationButton(label: String, current: Boolean, disabled: Boolean, scale: Float,
    compact: Boolean = false, contentWidth: Float = 0f, modifier: Modifier = Modifier,
    chevron: Boolean = false,
    onClick: () -> Unit, content: @Composable (Color) -> Unit) {
    val colors = LocalLabTheme.current.colors
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val radius = if (compact) LabComponents.PaginationCompactRadius else LabComponents.PaginationRadius
    val fill = if (compact) Color.Transparent else if (current) colors[LabComponents.PaginationRolesActive]
        else if (hovered && !disabled) colors[LabComponents.PaginationRolesHover] else Color.Transparent
    val text = colors[when {
        disabled -> LabComponents.PaginationRolesDisabled
        chevron && !hovered -> LabComponents.PaginationRolesChevron
        else -> LabComponents.PaginationRolesLabel
    }]
    Box(modifier.defaultMinSize(minWidth = if (compact) ((contentWidth + LabComponents.PaginationCompactGap) * scale).dp else (LabComponents.PaginationControl * scale).dp,
        minHeight = ((if (compact) LabComponents.PaginationCompactHeight else LabComponents.PaginationControl) * scale).dp)
        .background(fill, RoundedCornerShape((radius * scale).dp))
        .drawWithContent {
            drawContent()
            val stroke = (LabComponents.PaginationStroke * scale).dp.toPx()
            if (!compact && !current) drawRoundRect(colors[LabComponents.PaginationRolesBorder],
                Offset(stroke / 2, stroke / 2), Size(size.width - stroke, size.height - stroke),
                CornerRadius((radius * scale).dp.toPx()), style = Stroke(stroke))
            if (focused) drawRoundRect(colors[LabComponents.PaginationRolesFocus], cornerRadius = CornerRadius((radius * scale).dp.toPx()),
                style = Stroke((LabComponents.PaginationFocusWidth * scale).dp.toPx()))
        }
        .clickable(enabled = !disabled, interactionSource = interactions, indication = null, role = Role.Button, onClick = onClick)
        .semantics { contentDescription = label; if (current) selected = true }
        .padding(horizontal = ((if (compact) LabComponents.PaginationCompactGap / 2 else LabComponents.PaginationPadding) * scale).dp),
        contentAlignment = Alignment.Center) { content(text) }
}

@Composable
private fun PaginationChevron(color: Color, scale: Float, flip: Boolean) {
    Canvas(Modifier.size((LabComponents.PaginationIcon * scale).dp).clearAndSetSemantics {}) {
        withTransform({
            if (flip) { translate(size.width, 0f); scale(-1f, 1f, Offset.Zero) }
            scale(size.width / LabComponents.PaginationGlyphsChevronViewBox, size.height / LabComponents.PaginationGlyphsChevronViewBox, Offset.Zero)
            translate(LabComponents.PaginationGlyphsChevronX, LabComponents.PaginationGlyphsChevronY)
        }) { drawPath(LabComponents.PaginationGlyphsChevronPath, color) }
    }
}
