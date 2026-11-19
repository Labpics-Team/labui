package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties

@Immutable
public data class LabSelectItem(public val value: String, public val label: String, public val disabled: Boolean = false)
@Immutable
public data class LabSelectIconScope(public val size: Dp, public val color: Color)

/** Dropdown and Multiselect. Only the supplied value is accepted; callbacks request a change.
 * For local state use rememberSaveable { mutableStateOf(defaultValues) }; reset by assigning it.
 */
@Composable
public fun LabSelect(
    value: List<String>,
    onValueChange: (List<String>) -> Unit,
    items: List<LabSelectItem>,
    label: String,
    modifier: Modifier = Modifier,
    multiple: Boolean = false,
    size: LabControlSize = LabControlSize.Medium,
    enabled: Boolean = true,
    placeholder: String = "Select…",
    showLabel: Boolean = true,
    removeLabel: (String) -> String = { "Remove $it" },
    leading: (@Composable LabSelectIconScope.() -> Unit)? = null,
) {
    require(items.map { it.value }.distinct().size == items.size) { "Select values must be unique" }
    require(value.distinct().size == value.size && (multiple || value.size <= 1)) { "Select needs unique values; single mode accepts at most one" }
    require(label.isNotBlank()) { "Select needs an accessible label" }
    val colors = LocalLabTheme.current.colors
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.SelectS
        LabControlSize.Medium -> LabComponents.SelectM
        LabControlSize.Large -> LabComponents.SelectL
    }
    val type = if (multiple) LabComponents.SelectM else metrics
    val textColor = colors[if (enabled) LabComponents.SelectRolesLabel else LabComponents.SelectRolesDisabled]
    val style = LabType.body().withTypography(fontSize = type.fontSize.sp, lineHeight = type.lineHeight.sp,
        fontWeight = FontWeight(type.fontWeight.toInt()), letterSpacing = type.letterSpacing.sp, color = textColor)
    val caption = LabType.caption().withTypography(fontSize = LabComponents.SelectMultipleLabelFontSize.sp,
        lineHeight = LabComponents.SelectMultipleLabelLineHeight.sp, letterSpacing = 0.sp,
        fontWeight = FontWeight(LabComponents.SelectMultipleLabelWeight.toInt()),
        color = colors[if (enabled) LabComponents.SelectRolesCaption else LabComponents.SelectRolesDisabled])
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    var expanded by remember { mutableStateOf(false) }
    var controlSize by remember { mutableStateOf(IntSize.Zero) }
    val trigger = remember { FocusRequester() }
    var restoreFocus by remember { mutableStateOf(false) }
    val close: () -> Unit = { expanded = false; restoreFocus = true }
    LaunchedEffect(expanded, enabled) {
        if (!enabled) expanded = false
        if (!expanded && restoreFocus && enabled) { trigger.requestFocus(); restoreFocus = false }
    }
    val chosen = value.map { selected -> items.find { it.value == selected } ?: LabSelectItem(selected, selected) }
    val text = chosen.joinToString(", ") { it.label }.ifEmpty { placeholder }
    val shape = RoundedCornerShape((if (multiple) LabComponents.SelectMultipleRadius else metrics.radius).dp)
    val visibleCaption = multiple && showLabel
    val labelLayout = rememberTextMeasurer().measure(label, caption, maxLines = 1)
    val border = colors[if (multiple && (focused || expanded)) LabComponents.SelectRolesFocus else LabComponents.SelectRolesBorder]
    val density = LocalDensity.current
    val captionOverhang = with(density) { LabComponents.SelectMultipleLabelOverhang.sp.toDp() }
    val multipleMinHeight = maxOf(LabComponents.SelectMultipleHeight.dp,
        with(density) { style.lineHeight.toDp() } + LabComponents.SelectM.paddingY.dp * 2)
    Box(modifier.then(if (multiple) Modifier.fillMaxWidth() else Modifier).padding(top = if (visibleCaption) captionOverhang else 0.dp)) {
        Box(Modifier.then(if (multiple) Modifier.fillMaxWidth() else Modifier).onSizeChanged { controlSize = it }.drawWithCache {
            val stroke = LabComponents.SelectStroke.dp.toPx()
            val outline = shape.createOutline(this.size, layoutDirection, this)
            val contour = Path().apply { addOutline(outline) }
            val hoverCenter = androidx.compose.ui.geometry.Offset(this.size.width * LabComponents.SelectMultipleHoverCenterX,
                this.size.height * LabComponents.SelectMultipleHoverCenterY)
            val hoverRadius = (this.size.width * LabComponents.SelectMultipleHoverRadiusX).coerceAtLeast(1f)
            val hoverScale = (this.size.height * LabComponents.SelectMultipleHoverRadiusY / hoverRadius).coerceAtLeast(.001f)
            val hover = Brush.radialGradient(listOf(Color.Transparent, colors[LabComponents.SelectRolesHover]), hoverCenter, hoverRadius)
            val start = LabComponents.SelectMultipleLabelStart.dp.toPx()
            val gap = LabComponents.SelectMultipleLabelGap.dp.toPx()
            val labelWidth = labelLayout.size.width.toFloat().coerceAtMost((this.size.width - start * 2).coerceAtLeast(0f))
            val left = if (layoutDirection == LayoutDirection.Ltr) start else this.size.width - start - labelWidth
            onDrawWithContent {
                if (enabled && hovered) {
                    if (multiple) clipPath(contour) {
                        withTransform({ scale(1f, hoverScale, hoverCenter) }) {
                            drawRect(hover, size = androidx.compose.ui.geometry.Size(this.size.width, this.size.height / hoverScale))
                        }
                    } else drawOutline(outline, colors[LabComponents.SelectRolesHover])
                }
                drawContent()
                if (visibleCaption) clipRect(left - gap, -stroke, left + labelWidth + gap, stroke, ClipOp.Difference) {
                    drawOutline(outline, border, style = Stroke(stroke))
                } else drawOutline(outline, border, style = Stroke(stroke))
                if (!multiple && focused) drawOutline(outline, colors[LabComponents.SelectRolesFocus], style = Stroke(2.dp.toPx()))
            }
        }) {
            // The trigger and removal chips are siblings: each is one independent action.
            Row(Modifier.then(if (multiple) Modifier.matchParentSize() else Modifier)
                .defaultMinSize(minHeight = if (multiple) multipleMinHeight else metrics.height.dp)
                .focusRequester(trigger).onPreviewKeyEvent { event ->
                    if (enabled && event.type == KeyEventType.KeyDown && (event.key == Key.DirectionDown || event.key == Key.DirectionUp)) {
                        expanded = true; true
                    } else false
                }.clickable(enabled = enabled, role = Role.Button, interactionSource = interactions, indication = null) { expanded = !expanded }
                .semantics { contentDescription = label; stateDescription = text }
                .padding(start = (if (multiple) LabComponents.SelectMultiplePlaceholderStart else metrics.paddingStart).dp,
                    end = (if (multiple) LabComponents.SelectMultipleChevronEnd else metrics.paddingEnd).dp,
                    top = (if (multiple) LabComponents.SelectM.paddingY else metrics.paddingY).dp,
                    bottom = (if (multiple) LabComponents.SelectM.paddingY else metrics.paddingY).dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(metrics.gap.dp)) {
                if (!multiple || value.isEmpty()) Row(Modifier.weight(1f, fill = multiple), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(LabComponents.SelectLeadingGap.dp)) {
                    if (!multiple && leading != null) Box(Modifier.size(metrics.leadingSize.dp).clearAndSetSemantics {}) {
                        leading(LabSelectIconScope(metrics.leadingSize.dp, textColor))
                    }
                    LabText(text, Modifier.weight(1f, fill = false).clearAndSetSemantics {}, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = if (multiple && enabled) style.copy(color = colors[LabComponents.SelectRolesPlaceholder]) else style)
                } else Box(Modifier.weight(1f))
                SelectChevron(expanded, if (!enabled) textColor else colors[if (multiple) LabComponents.SelectRolesCaption else LabComponents.SelectRolesLabel])
            }
            if (multiple) FlowRow(Modifier.defaultMinSize(minHeight = multipleMinHeight)
                .padding(start = LabComponents.SelectMultiplePaddingStart.dp, end = LabComponents.SelectMultiplePaddingEnd.dp,
                    top = LabComponents.SelectMultiplePaddingY.dp, bottom = LabComponents.SelectMultiplePaddingY.dp),
                horizontalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp),
                verticalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp)) {
                chosen.forEach { item -> key(item.value) {
                    LabChip(item.label, mode = LabChipMode.Remove, size = LabChipSize.Small, sharp = true,
                        enabled = enabled && !item.disabled, accessibilityLabel = removeLabel(item.label),
                        onRemove = { onValueChange(value.filter { it != item.value }); trigger.requestFocus() })
                } }
            }
            if (visibleCaption) LabText(label, Modifier.offset(y = -captionOverhang)
                .padding(start = LabComponents.SelectMultipleLabelStart.dp, end = LabComponents.SelectMultipleLabelStart.dp)
                .clearAndSetSemantics {}, style = if (enabled && (focused || expanded)) caption.copy(color = textColor) else caption, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (expanded && enabled) Popup(alignment = Alignment.TopStart, offset = IntOffset(0, controlSize.height),
            onDismissRequest = close, properties = PopupProperties(focusable = true)) {
            val selectable = items.filterNot { it.disabled }
            val requesters = remember(items.map { it.value }) { items.associate { it.value to FocusRequester() } }
            var active by remember { mutableStateOf(value.firstOrNull { selected -> selectable.any { it.value == selected } } ?: selectable.firstOrNull()?.value) }
            LaunchedEffect(active, items) { active?.let { requesters[it]?.requestFocus() } }
            Column(Modifier.width(with(density) { controlSize.width.toDp() }).heightIn(max = 256.dp)
                .background(colors["bg-secondary"], RoundedCornerShape(12.dp))
                .verticalScroll(rememberScrollState()).padding(4.dp).onPreviewKeyEvent { event ->
                    val code = event.key
                    if (event.type != KeyEventType.KeyDown) false
                    else if (code == Key.Escape) { close(); true }
                    else if (selectable.isNotEmpty() && code in listOf(Key.DirectionDown, Key.DirectionUp, Key.MoveHome, Key.MoveEnd)) {
                        val index = selectable.indexOfFirst { it.value == active }.coerceAtLeast(0)
                        active = when (code) {
                            Key.MoveHome -> selectable.first().value
                            Key.MoveEnd -> selectable.last().value
                            else -> selectable[(index + (if (code == Key.DirectionDown) 1 else -1) + selectable.size) % selectable.size].value
                        }; true
                    } else false
                }) {
                items.forEach { item -> key(item.value) {
                    Row(Modifier.fillMaxWidth().focusRequester(requesters.getValue(item.value))
                        .onFocusChanged { if (it.isFocused) active = item.value }
                        .background(if (active == item.value) colors["fill-quaternary"] else Color.Transparent, RoundedCornerShape(4.dp))
                        .selectable(selected = item.value in value, enabled = !item.disabled,
                            role = if (multiple) Role.Checkbox else Role.RadioButton) {
                            onValueChange(if (!multiple) listOf(item.value) else if (item.value in value) value.filter { it != item.value } else value + item.value)
                            if (!multiple) close()
                        }.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        LabText(item.label, Modifier.weight(1f), style = style.copy(color = colors[when {
                            item.disabled -> "label-quaternary"
                            item.value in value -> "label-accent"
                            else -> "label-primary"
                        }]))
                        if (item.value in value) LabText("✓", Modifier.clearAndSetSemantics {}, style = style.copy(color = colors["label-accent"]))
                    }
                } }
            }
        }
    }
}

@Composable
private fun SelectChevron(expanded: Boolean, color: Color) {
    Canvas(Modifier.size(LabComponents.SelectChevronViewBox.dp).clearAndSetSemantics {}) {
        withTransform({
            scale(size.width / LabComponents.SelectChevronViewBox, size.height / LabComponents.SelectChevronViewBox, pivot = androidx.compose.ui.geometry.Offset.Zero)
            if (expanded) rotate(180f, pivot = androidx.compose.ui.geometry.Offset(LabComponents.SelectChevronViewBox / 2, LabComponents.SelectChevronViewBox / 2))
            translate(LabComponents.SelectChevronX, LabComponents.SelectChevronY)
        }) { drawPath(LabComponents.SelectChevronPath, color) }
    }
}
