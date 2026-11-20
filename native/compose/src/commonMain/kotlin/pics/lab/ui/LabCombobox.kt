package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.TextFieldDecorator
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import pics.lab.icons.Icon
import pics.lab.icons.symbols.checkmark
import kotlin.math.roundToInt

/** Editable choice. Text is a draft; only [value] is an accepted selection. */
@Composable
public fun LabCombobox(
    value: List<String>,
    onValueChange: (List<String>) -> Unit,
    items: List<LabSelectItem>,
    label: String,
    modifier: Modifier = Modifier,
    state: TextFieldState = rememberTextFieldState(),
    multiple: Boolean = false,
    size: LabControlSize = LabControlSize.Medium,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    helper: String? = null,
    error: String? = null,
    placeholder: String? = null,
    showOptionsLabel: String = "Показать варианты",
    hideOptionsLabel: String = "Скрыть варианты",
    emptyLabel: String = "Ничего не найдено",
    removeLabel: (String) -> String = { "Удалить $it" },
) {
    require(items.map { it.value }.distinct().size == items.size) { "Combobox item values must be unique" }
    require(value.distinct().size == value.size && (multiple || value.size <= 1)) { "Combobox needs unique selected values" }
    require(label.isNotBlank()) { "Combobox needs an accessible label" }
    val writable = enabled && !readOnly
    val colors = LocalLabTheme.current.colors
    val focus = remember { FocusRequester() }
    val composition = rememberInputCompositionGuard(state)
    var focused by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(false) }
    var querying by remember { mutableStateOf(false) }
    var observedText by remember(state) { mutableStateOf(state.text.toString()) }
    var request by remember { mutableStateOf<InputValuesRequest?>(null) }
    var active by remember { mutableStateOf<String?>(null) }
    var anchor by remember { mutableStateOf(IntRect.Zero) }
    val byValue = remember(items) { items.associateBy { it.value } }
    val selectedLabel = value.firstOrNull()?.let { byValue[it]?.label ?: it }.orEmpty()
    val query = if (querying) state.text.toString() else ""
    val visible = remember(items, query) { if (query.isBlank()) items else items.filter { it.label.contains(query, ignoreCase = true) } }
    val selectable = remember(visible) { visible.filterNot { it.disabled } }
    fun synchronize(text: String) {
        observedText = text
        if (state.text.toString() != text) state.setTextAndPlaceCursorAtEnd(text)
        querying = false
    }
    LaunchedEffect(value, selectedLabel, focused, state.composition, request) {
        if (state.composition != null) return@LaunchedEffect
        val accepted = request?.let { it.proposed == value && it.draft == state.text.toString() } == true
        if (!focused || accepted) {
            synchronize(if (multiple) "" else selectedLabel)
            if (accepted || !focused) request = null
        }
    }
    LaunchedEffect(state.text, focused, writable) {
        val text = state.text.toString()
        if (text != observedText) {
            observedText = text
            request = null
            if (focused && writable) { querying = true; expanded = true }
        }
        if (!focused || !writable) expanded = false
    }
    LaunchedEffect(visible, value, expanded) {
        if (selectable.none { it.value == active })
            active = selectable.firstOrNull { it.value in value }?.value ?: selectable.firstOrNull()?.value
    }
    fun open() {
        if (!writable || composition.active()) return
        querying = false
        active = items.firstOrNull { !it.disabled && it.value in value }?.value ?: items.firstOrNull { !it.disabled }?.value
        expanded = true
        focus.requestFocus()
    }
    fun choose(item: LabSelectItem) {
        if (!writable || item.disabled || composition.active()) return
        val proposed = if (!multiple) listOf(item.value)
            else if (item.value in value) value.filter { it != item.value } else value + item.value
        request = InputValuesRequest(proposed, state.text.toString())
        onValueChange(proposed)
        if (!multiple) expanded = false
        focus.requestFocus()
    }
    val fieldModifier = Modifier.focusRequester(focus).onFocusChanged { focused = it.isFocused }
        .onGloballyPositioned {
            val r = it.boundsInWindow()
            anchor = IntRect(r.left.roundToInt(), r.top.roundToInt(), r.right.roundToInt(), r.bottom.roundToInt())
        }.onPreviewKeyEvent { event ->
            if (!writable || event.type != KeyEventType.KeyDown || composition.active()) false
            else when (event.key) {
                Key.DirectionDown, Key.DirectionUp -> {
                    if (!expanded) open()
                    else if (selectable.isNotEmpty()) {
                        val index = selectable.indexOfFirst { it.value == active }
                        active = selectable[(index + if (event.key == Key.DirectionDown) 1 else -1).mod(selectable.size)].value
                    }
                    true
                }
                Key.MoveHome, Key.MoveEnd -> if (expanded && !event.isCtrlPressed) {
                    active = (if (event.key == Key.MoveHome) selectable.firstOrNull() else selectable.lastOrNull())?.value
                    true
                } else false
                Key.Enter, Key.NumPadEnter -> if (expanded) {
                    selectable.firstOrNull { it.value == active }?.let(::choose)
                    true
                } else false
                Key.Escape -> if (expanded) { expanded = false; true } else false
                Key.Tab -> { expanded = false; false }
                else -> false
            }
        }.semantics {
            stateDescription = if (expanded) visible.firstOrNull { it.value == active }?.label ?: emptyLabel
                else value.joinToString(", ") { byValue[it]?.label ?: it }
            if (writable) {
                if (expanded) collapse { expanded = false; true }
                else expand { open(); true }
            }
        }
    Box(modifier) {
        LabInput(state, label, enabled = enabled, readOnly = readOnly, helper = helper, error = error,
            size = size, placeholder = placeholder, inputModifier = fieldModifier,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            onKeyboardAction = KeyboardActionHandler { performDefaultAction ->
                if (!composition.active()) {
                    if (expanded) selectable.firstOrNull { it.value == active }?.let(::choose)
                    performDefaultAction()
                }
            },
            contentDecorator = if (!multiple) null else TextFieldDecorator { editor ->
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp),
                    verticalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp),
                    itemVerticalAlignment = Alignment.CenterVertically) {
                    value.forEach { selected ->
                        val item = byValue[selected] ?: LabSelectItem(selected, selected)
                        key(selected) {
                            LabChip(item.label, Modifier.focusProperties { canFocus = false }, mode = LabChipMode.Remove,
                                selected = true, size = LabChipSize.Small, sharp = true, enabled = enabled && !item.disabled,
                                readOnly = readOnly, accessibilityLabel = if (readOnly) item.label else removeLabel(item.label), onRemove = { choose(item) })
                        }
                    }
                    Box(Modifier.weight(1f).widthIn(min = if (writable) with(LocalDensity.current) { (size.inputMetrics().fontSize * 4).sp.toDp() } else 0.dp)) { editor() }
                }
            }, trailing = {
                InputAccessoryAction(if (expanded) hideOptionsLabel else showOptionsLabel, writable, size,
                    action = { if (expanded) expanded = false else open() }) { InputChevron(expanded, it) }
            })
        if (expanded && writable && anchor.width > 0) {
            val density = LocalDensity.current
            val gap = with(density) { LabComponents.MenuGap.dp.roundToPx() }
            val window = LocalWindowInfo.current.containerSize
            val ime = WindowInsets.ime.getBottom(density)
            val viewport = IntSize(window.width, (window.height - ime).coerceAtLeast(1))
            val availableHeight = maxOf(anchor.top - gap, viewport.height - anchor.bottom - gap).coerceAtLeast(1)
            val position = remember(anchor, gap, viewport) { object : PopupPositionProvider {
                override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset =
                    MenuPosition(LabMenuPlacement.BottomStart, gap).calculatePosition(anchor,
                        IntSize(minOf(viewport.width, windowSize.width), minOf(viewport.height, windowSize.height)), layoutDirection, popupContentSize)
            } }
            Popup(popupPositionProvider = position, onDismissRequest = { expanded = false }, properties = PopupProperties(focusable = false)) {
                val list = rememberLazyListState()
                LaunchedEffect(active, visible) {
                    val index = visible.indexOfFirst { it.value == active }
                    if (index >= 0) list.scrollToItem(index)
                }
                val style = LabType.body().withTypography(fontSize = LabComponents.MenuFontSize.sp,
                    lineHeight = LabComponents.MenuLineHeight.sp, fontWeight = FontWeight(LabComponents.MenuFontWeight.toInt()),
                    letterSpacing = LabComponents.MenuLetterSpacing.sp)
                LabSurface(LabComponents.MenuDropdownMaterial,
                    Modifier.width(with(density) { anchor.width.coerceAtMost((viewport.width - gap * 2).coerceAtLeast(1)).toDp() })
                        .heightIn(max = with(density) { availableHeight.toDp() })
                        .semantics { role = Role.DropdownList; contentDescription = label; collectionInfo = CollectionInfo(visible.size, 1); isTraversalGroup = true },
                    LabMaterial.Solid, RoundedCornerShape(LabComponents.MenuRadius.dp), LabComponents.MenuDropdownShadow,
                    LabComponents.MenuStrokeWidth.dp, colors[LabComponents.MenuRolesBorder]) {
                    if (visible.isEmpty()) LabText(emptyLabel, Modifier.padding(LabComponents.MenuHeaderPadding.dp), style.copy(color = colors["label-secondary"]))
                    else LazyColumn(state = list, contentPadding = PaddingValues(LabComponents.MenuPadding.dp)) {
                        itemsIndexed(visible, key = { _, item -> item.value }) { index, item ->
                            Row(Modifier.fillMaxWidth().focusProperties { canFocus = false }
                                .background(if (active == item.value) colors[LabComponents.MenuRolesHighlight] else Color.Transparent,
                                    RoundedCornerShape(LabComponents.MenuRowRadius.dp))
                                .selectable(item.value in value, enabled = !item.disabled) { choose(item) }
                                .semantics { collectionItemInfo = CollectionItemInfo(index, 1, 0, 1) }
                                .padding(horizontal = LabComponents.MenuRowPaddingX.dp, vertical = LabComponents.MenuRowPaddingY.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                LabText(item.label, Modifier.weight(1f), style.copy(color = colors[
                                    if (item.disabled) LabComponents.MenuRolesDisabled else LabComponents.MenuRolesLabel]))
                                if (item.value in value) Icon(checkmark, colors[LabComponents.MenuRolesAccent],
                                    modifier = Modifier.padding(start = LabComponents.MenuRowLabelGap.dp).clearAndSetSemantics {}, size = LabComponents.MenuRowIconSize.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}
