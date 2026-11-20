package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.key.utf16CodePoint
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.isSecondaryPressed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.round
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import pics.lab.icons.Icon
import pics.lab.icons.symbols.checkmark
import pics.lab.icons.symbols.chevronForward

/** Authored dropdown menu. Apply the supplied modifier and toggle to the actual trigger control.
 * Non-null [open] and [checkedValues] are strictly controlled; callbacks only request changes.
 */
@Composable
public fun LabMenu(
    items: List<LabMenuItem>, label: String,
    modifier: Modifier = Modifier,
    open: Boolean? = null, defaultOpen: Boolean = false, onOpenChange: (Boolean) -> Unit = {},
    checkedValues: List<String>? = null, defaultCheckedValues: List<String> = emptyList(),
    onCheckedValuesChange: (List<String>) -> Unit = {}, onSelect: (String) -> Unit = {},
    heading: String? = null, enabled: Boolean = true,
    placement: LabMenuPlacement = LabMenuPlacement.BottomStart,
    material: LabMaterial = LabMaterial.Acrylic,
    trigger: @Composable (Modifier, () -> Unit) -> Unit = { control, toggle -> LabButton(label, toggle, control, enabled = enabled) },
) {
    MenuAnchor(items, label, modifier, open, defaultOpen, onOpenChange, checkedValues,
        defaultCheckedValues, onCheckedValuesChange, onSelect, heading, enabled, placement, material, false, trigger)
}

/** Secondary click, long press, Menu key and Shift+F10 open the same local menu. */
@Composable
public fun LabContextMenu(
    items: List<LabMenuItem>, label: String,
    modifier: Modifier = Modifier,
    open: Boolean? = null, defaultOpen: Boolean = false, onOpenChange: (Boolean) -> Unit = {},
    checkedValues: List<String>? = null, defaultCheckedValues: List<String> = emptyList(),
    onCheckedValuesChange: (List<String>) -> Unit = {}, onSelect: (String) -> Unit = {},
    enabled: Boolean = true, material: LabMaterial = LabMaterial.Acrylic,
    content: @Composable (Modifier) -> Unit,
) {
    MenuAnchor(items, label, modifier, open, defaultOpen, onOpenChange, checkedValues,
        defaultCheckedValues, onCheckedValuesChange, onSelect, null, enabled,
        LabMenuPlacement.BottomStart, material, true) { control, _ -> content(control) }
}

@Composable
private fun MenuAnchor(
    items: List<LabMenuItem>, label: String, modifier: Modifier,
    open: Boolean?, defaultOpen: Boolean, onOpenChange: (Boolean) -> Unit,
    checkedValues: List<String>?, defaultCheckedValues: List<String>, onCheckedValuesChange: (List<String>) -> Unit,
    onSelect: (String) -> Unit, heading: String?, enabled: Boolean, placement: LabMenuPlacement,
    material: LabMaterial, context: Boolean, trigger: @Composable (Modifier, () -> Unit) -> Unit,
) {
    require(label.isNotBlank()) { "Menu needs an accessible label" }
    val model = remember(items) { MenuModel(items) }
    var localOpen by remember { mutableStateOf(defaultOpen) }
    var localChecked by remember { mutableStateOf(defaultCheckedValues) }
    val expanded = enabled && (open ?: localOpen)
    val selected = model.checked(checkedValues ?: localChecked)
    val requester = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    var restore by remember { mutableStateOf(false) }
    var advance by remember { mutableStateOf<Boolean?>(null) }
    var last by remember { mutableStateOf(false) }
    var focusInitial by remember { mutableStateOf(false) }
    var point by remember { mutableStateOf<IntOffset?>(null) }
    val setOpen: (Boolean) -> Unit = { next ->
        if (enabled) { if (open == null) localOpen = next; onOpenChange(next) }
    }
    val close: () -> Unit = { restore = true; setOpen(false) }
    LaunchedEffect(expanded) { if (!expanded && restore) {
        if (enabled) { requester.requestFocus(); advance?.let { focusManager.moveFocus(if (it) FocusDirection.Previous else FocusDirection.Next) } }
        restore = false; advance = null
    } }
    val showAt by rememberUpdatedState<(Offset?) -> Unit> { at -> point = at?.round(); last = false; focusInitial = false; setOpen(true) }
    var control = Modifier.focusRequester(requester).onPreviewKeyEvent { event ->
        if (!enabled || event.type != KeyEventType.KeyDown) false
        else if (context && (event.key == Key.Menu || (event.key == Key.F10 && event.isShiftPressed))) {
            point = null; last = false; focusInitial = true; setOpen(true); true
        } else if (!context && (event.key == Key.DirectionDown || event.key == Key.DirectionUp)) {
            last = event.key == Key.DirectionUp; focusInitial = true; setOpen(true); true
        } else if (!context && (event.key == Key.Enter || event.key == Key.Spacebar)) {
            last = false; focusInitial = true; setOpen(!expanded); true
        } else false
    }.semantics { stateDescription = if (expanded) "Expanded" else "Collapsed" }
    if (context) control = control.pointerInput(enabled) {
        if (enabled) awaitPointerEventScope {
            while (true) {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                if (event.type == PointerEventType.Press && event.buttons.isSecondaryPressed) {
                    showAt(event.changes.first().position); event.changes.forEach { it.consume() }
                }
            }
        }
    }.pointerInput(enabled) { if (enabled) detectTapGestures(onLongPress = { showAt(it) }) }
        .semantics { if (enabled) onLongClick(label) { showAt(null); true } }.focusable(enabled)
    Box(modifier) {
        trigger(control) { if (enabled) { last = false; focusInitial = false; setOpen(!expanded) } }
        if (expanded) MenuPopup(items, label, heading, context, selected, material, placement,
            point = point, initiallyLast = last, focusInitial = focusInitial, close = close, leave = { backwards -> advance = backwards; close() }, select = { item ->
                if (item is LabMenuItem.Check || item is LabMenuItem.Radio) {
                    val changed = model.select(selected, item.value)
                    if (checkedValues == null) localChecked = changed
                    if (changed != selected) onCheckedValuesChange(changed)
                }
                onSelect(item.value)
                if (item.closeOnSelect) close()
            })
    }
}

/** Controlled menubar: null explicitly means that every root menu is closed. */
@Composable
public fun LabMenubar(
    menus: List<LabMenubarItem>, value: String?, onValueChange: (String?) -> Unit,
    modifier: Modifier = Modifier, label: String = "Menu bar",
    checkedValues: List<String>? = null, defaultCheckedValues: List<String> = emptyList(),
    onCheckedValuesChange: (List<String>) -> Unit = {}, onSelect: (String) -> Unit = {},
    material: LabMaterial = LabMaterial.Acrylic,
) {
    Menubar(menus, value, onValueChange, modifier, label, checkedValues, defaultCheckedValues,
        onCheckedValuesChange, onSelect, material)
}

/** Local open state. Use the controlled overload when the application owns the active root. */
@Composable
public fun LabMenubar(
    menus: List<LabMenubarItem>, modifier: Modifier = Modifier, label: String = "Menu bar",
    defaultValue: String? = null,
    checkedValues: List<String>? = null, defaultCheckedValues: List<String> = emptyList(),
    onCheckedValuesChange: (List<String>) -> Unit = {}, onSelect: (String) -> Unit = {},
    material: LabMaterial = LabMaterial.Acrylic,
) {
    var value by remember { mutableStateOf(defaultValue) }
    Menubar(menus, value, { value = it }, modifier, label, checkedValues, defaultCheckedValues,
        onCheckedValuesChange, onSelect, material)
}

@Composable
private fun Menubar(
    menus: List<LabMenubarItem>, value: String?, onValueChange: (String?) -> Unit,
    modifier: Modifier, label: String, checkedValues: List<String>?, defaultCheckedValues: List<String>,
    onCheckedValuesChange: (List<String>) -> Unit, onSelect: (String) -> Unit, material: LabMaterial,
) {
    require(label.isNotBlank()) { "Menubar needs an accessible label" }
    require(menus.map { it.value }.distinct().size == menus.size && menus.all { it.value.isNotEmpty() && it.label.isNotBlank() }) {
        "Menubar entries need unique values and nonblank labels"
    }
    val model = remember(menus) { MenuModel(menus.flatMap { it.items }) }
    var localChecked by remember { mutableStateOf(defaultCheckedValues) }
    val selected = model.checked(checkedValues ?: localChecked)
    val enabled = menus.filterNot { it.disabled }
    val keys = menus.map { it.value }
    val requesters = remember(keys) { keys.associateWith { FocusRequester() } }
    val triggerBounds = remember { mutableMapOf<String, Rect>() }
    var active by remember { mutableStateOf(value ?: enabled.firstOrNull()?.value) }
    var initiallyLast by remember { mutableStateOf(false) }
    var focusInitial by remember { mutableStateOf(false) }
    var restore by remember { mutableStateOf<String?>(null) }
    var advance by remember { mutableStateOf<Boolean?>(null) }
    val focusManager = LocalFocusManager.current
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    LaunchedEffect(value, enabled) {
        if (active !in enabled.map { it.value }) active = enabled.firstOrNull()?.value
        restore?.let { target -> if (value == null) {
            requesters[target]?.requestFocus()
            advance?.let { focusManager.moveFocus(if (it) FocusDirection.Previous else FocusDirection.Next) }
            restore = null; advance = null
        } }
    }
    val changeRoot: (Int) -> Unit = { delta ->
        if (enabled.isNotEmpty()) {
            val current = enabled.indexOfFirst { it.value == (value ?: active) }.coerceAtLeast(0)
            val target = enabled[(current + delta + enabled.size) % enabled.size].value
            active = target; initiallyLast = false; focusInitial = true
            if (value != null) onValueChange(target) else requesters[target]?.requestFocus()
        }
    }
    val colors = LocalLabTheme.current.colors
    LabSurface(LabComponents.MenuMenubarMaterial, modifier, material,
        RoundedCornerShape(LabComponents.MenuMenubarRadius.dp),
        strokeWidth = LabComponents.MenuStrokeWidth.dp, strokeColor = colors[LabComponents.MenuRolesBorder]) {
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(LabComponents.MenuMenubarPadding.dp).semantics { contentDescription = label }) {
            for (menu in menus) key(menu.value) {
                val expanded = menu.value == value && !menu.disabled
                val interaction = remember { MutableInteractionSource() }
                val hovered by interaction.collectIsHoveredAsState()
                var focused by remember { mutableStateOf(false) }
                LaunchedEffect(hovered) { if (hovered && !menu.disabled && value != null && value != menu.value) { active = menu.value; focusInitial = false; onValueChange(menu.value) } }
                val shape = RoundedCornerShape((if (expanded) LabComponents.MenuMenubarActiveRadius else LabComponents.MenuMenubarItemRadius).dp)
                Box {
                    LabText(menu.label, Modifier.onGloballyPositioned { triggerBounds[menu.value] = it.boundsInWindow() }
                        .focusRequester(requesters.getValue(menu.value))
                        .focusProperties { canFocus = !menu.disabled && active == menu.value }
                        .onFocusChanged { focused = it.isFocused; if (it.isFocused) active = menu.value }
                        .onPreviewKeyEvent { event ->
                            if (event.type != KeyEventType.KeyDown || menu.disabled) false
                            else when (event.key) {
                                Key.DirectionLeft, Key.DirectionRight -> { changeRoot(if ((event.key == Key.DirectionRight) != rtl) 1 else -1); true }
                                Key.MoveHome, Key.MoveEnd -> { active = (if (event.key == Key.MoveHome) enabled.firstOrNull() else enabled.lastOrNull())?.value; active?.let { requesters[it]?.requestFocus() }; true }
                                Key.DirectionDown, Key.DirectionUp -> { initiallyLast = event.key == Key.DirectionUp; focusInitial = true; onValueChange(menu.value); true }
                                Key.Enter, Key.Spacebar -> { initiallyLast = false; focusInitial = true; onValueChange(if (expanded) null else menu.value); true }
                                else -> false
                            }
                        }.drawWithContent {
                            if (focused && !menu.disabled && !expanded) {
                                val width = LabTokens.FocusRingWidth.dp.toPx()
                                val expansion = LabTokens.FocusRingOffset.dp.toPx() + width / 2
                                drawRoundRect(colors["border-focus"], topLeft = Offset(-expansion, -expansion),
                                    size = Size(size.width + expansion * 2, size.height + expansion * 2),
                                    cornerRadius = CornerRadius(LabComponents.MenuMenubarItemRadius.dp.toPx() + expansion), style = Stroke(width))
                            }
                            drawContent()
                        }.then(if (expanded) Modifier.labShadow(shape, LabComponents.MenuMenubarActiveShadow) else Modifier)
                        .background(when { expanded -> colors[LabComponents.MenuRolesActiveBackground]; hovered && !menu.disabled -> colors[LabComponents.MenuRolesHighlight]; else -> Color.Transparent }, shape)
                        .clickable(enabled = !menu.disabled, role = Role.Button, interactionSource = interaction, indication = null) {
                            active = menu.value; initiallyLast = false; focusInitial = false; onValueChange(if (expanded) null else menu.value)
                        }.semantics { stateDescription = if (expanded) "Expanded" else "Collapsed" }
                        .padding(horizontal = LabComponents.MenuMenubarPaddingX.dp, vertical = LabComponents.MenuMenubarPaddingY.dp),
                        style = menuTextStyle(colors[when { menu.disabled -> LabComponents.MenuRolesDisabled; expanded -> LabComponents.MenuRolesActiveLabel; else -> LabComponents.MenuRolesLabel }]))
                    if (expanded) MenuPopup(menu.items, menu.label, menu.heading, true, selected, material,
                        anchorPadding = LabComponents.MenuMenubarPadding.dp,
                        initiallyLast = initiallyLast, focusInitial = focusInitial, close = { restore = menu.value; onValueChange(null) },
                        rootArrow = changeRoot, leave = { backwards -> advance = backwards; restore = menu.value; onValueChange(null) },
                        outsidePointer = { position, event ->
                            val target = enabled.firstOrNull { triggerBounds[it.value]?.contains(position) == true }
                            if (target == null) false else {
                                if ((event == PointerEventType.Move || event == PointerEventType.Enter) && target.value != value) { active = target.value; focusInitial = false; onValueChange(target.value) }
                                if (event == PointerEventType.Press) { active = target.value; focusInitial = false; onValueChange(if (target.value == value) null else target.value) }
                                true
                            }
                        }, select = { item ->
                            if (item is LabMenuItem.Check || item is LabMenuItem.Radio) {
                                val changed = model.select(selected, item.value)
                                if (checkedValues == null) localChecked = changed
                                if (changed != selected) onCheckedValuesChange(changed)
                            }
                            onSelect(item.value)
                            if (item.closeOnSelect) { restore = menu.value; onValueChange(null) }
                        })
                }
            }
        }
    }
}

@Composable
private fun menuTextStyle(color: Color) = LabType.body().withTypography(color = color,
    fontSize = LabComponents.MenuFontSize.sp, lineHeight = LabComponents.MenuLineHeight.sp,
    fontWeight = FontWeight(LabComponents.MenuFontWeight.toInt()), letterSpacing = LabComponents.MenuLetterSpacing.sp)

@Composable
private fun MenuPopup(
    items: List<LabMenuItem>, label: String, heading: String?, context: Boolean, selected: List<String>,
    material: LabMaterial, placement: LabMenuPlacement = LabMenuPlacement.BottomStart,
    point: IntOffset? = null, initiallyLast: Boolean = false, focusInitial: Boolean = true,
    anchorPadding: Dp = 0.dp,
    close: () -> Unit, rootArrow: ((Int) -> Unit)? = null,
    leave: (Boolean) -> Unit = { close() },
    outsidePointer: (Offset, PointerEventType) -> Boolean = { _, _ -> false },
    select: (LabMenuItem.Entry) -> Unit,
) {
    val density = LocalDensity.current
    val gap = with(density) { LabComponents.MenuGap.dp.roundToPx() }
    var anchor by remember { mutableStateOf<IntRect?>(null) }
    Layout({}, Modifier.onGloballyPositioned { coordinates ->
        coordinates.parentLayoutCoordinates?.let { anchor = it.boundsInWindow().menuRect() }
    }) { _, _ -> layout(0, 0) {} }
    val measuredAnchor = anchor ?: return
    val padding = with(density) { anchorPadding.roundToPx() }
    val rootAnchor = IntRect(measuredAnchor.left - padding, measuredAnchor.top - padding, measuredAnchor.right + padding, measuredAnchor.bottom + padding)
    // One platform popup keeps the whole cascade interactive, including its parent panels.
    // Independent focusable Popup windows consume clicks outside the deepest child on Android.
    Popup(popupPositionProvider = MenuViewportPosition, onDismissRequest = close, properties = PopupProperties(focusable = true)) {
        var path by remember { mutableStateOf<List<LabMenuItem.Submenu>>(emptyList()) }
        val rowBounds = remember { mutableStateMapOf<String, IntRect>() }
        val panelBounds = remember { mutableMapOf<Int, IntRect>() }
        val outside by rememberUpdatedState(outsidePointer)
        val dismiss by rememberUpdatedState(close)
        val viewport = LocalWindowInfo.current.containerSize
        LaunchedEffect(items) {
            var level = items
            val valid = mutableListOf<LabMenuItem.Submenu>()
            for (entry in path) {
                val next = level.filterIsInstance<LabMenuItem.Submenu>().find { it.value == entry.value && !it.disabled } ?: break
                valid.add(next); level = next.items
            }
            path = valid
        }
        Layout(modifier = Modifier.size(with(density) { viewport.width.toDp() }, with(density) { viewport.height.toDp() })
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val position = event.changes.firstOrNull()?.position ?: continue
                        if (panelBounds.values.none { it.contains(position.round()) }) {
                            if (outside(position, event.type)) event.changes.forEach { it.consume() }
                            else if (event.type == PointerEventType.Press) { dismiss(); event.changes.forEach { it.consume() } }
                        }
                    }
                }
            }, content = {
                for (index in 0..path.size) key(if (index == 0) "root" else path[index - 1].value) {
                    val parent = path.getOrNull(index - 1)
                    MenuPanel(parent?.items ?: items, parent?.label ?: label, if (index == 0) heading else null,
                        index != 0 || context, selected, material, if (index == 0) initiallyLast else false,
                        close, if (index == 0) null else { { path = path.take(index - 1) } }, rootArrow, leave,
                        focusInitial = index != 0 || focusInitial,
                        expandedValue = path.getOrNull(index)?.value,
                        changeSubmenu = { child -> path = path.take(index) + listOfNotNull(child) },
                        rowPlaced = { value, bounds -> if (rowBounds[value] != bounds) rowBounds[value] = bounds }, select = select)
                }
            }) { measurables, constraints ->
            val size = IntSize(constraints.maxWidth, constraints.maxHeight)
            val panelConstraints = Constraints(maxWidth = maxOf(1, size.width - gap * 2), maxHeight = maxOf(1, size.height - gap * 2))
            val measured = measurables.map { it.measure(panelConstraints) }
            layout(size.width, size.height) {
                panelBounds.clear()
                measured.forEachIndexed { index, panel ->
                    val parent = path.getOrNull(index - 1)
                    val row = parent?.let { rowBounds[it.value] }
                    val previous = panelBounds[index - 1]
                    val origin = if (row == null || previous == null) rootAnchor else IntRect(previous.left, row.top, previous.right, row.bottom)
                    val position = MenuPosition(placement, gap, if (index == 0) point else null, nested = index != 0)
                        .calculatePosition(origin, size, layoutDirection, IntSize(panel.width, panel.height))
                    panelBounds[index] = IntRect(position, IntSize(panel.width, panel.height))
                    panel.place(position.x, position.y)
                }
            }
        }
    }
}

private fun Rect.menuRect() = IntRect(left.roundToInt(), top.roundToInt(), right.roundToInt(), bottom.roundToInt())
private object MenuViewportPosition : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize) = IntOffset.Zero
}

@Composable
internal fun MenuPanel(
    items: List<LabMenuItem>, label: String, heading: String?, context: Boolean, selected: List<String>,
    material: LabMaterial, initiallyLast: Boolean = false, close: () -> Unit,
    closeLevel: (() -> Unit)? = null, rootArrow: ((Int) -> Unit)? = null,
    leave: (Boolean) -> Unit = { close() }, expandedValue: String? = null, focusInitial: Boolean = true,
    changeSubmenu: (LabMenuItem.Submenu?) -> Unit = {}, rowPlaced: (String, IntRect) -> Unit = { _, _ -> },
    select: (LabMenuItem.Entry) -> Unit,
) {
    val entries = items.filterIsInstance<LabMenuItem.Entry>()
    val enabled = entries.filterNot { it.disabled }
    val keys = entries.map { it.value }
    val requesters = remember(keys) { keys.associateWith { FocusRequester() } }
    val panelFocus = remember { FocusRequester() }
    var active by remember { mutableStateOf(if (focusInitial) (if (initiallyLast) enabled.lastOrNull() else enabled.firstOrNull())?.value else null) }
    var search by remember { mutableStateOf("") }
    var hover by remember { mutableStateOf<String?>(null) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    LaunchedEffect(active, enabled) {
        if (active != null && active !in enabled.map { it.value }) active = enabled.firstOrNull()?.value
        if (active == null) panelFocus.requestFocus() else requesters[active]?.requestFocus()
    }
    var previouslyExpanded by remember { mutableStateOf(expandedValue) }
    LaunchedEffect(expandedValue) {
        if (previouslyExpanded != null && expandedValue == null) active?.let { requesters[it]?.requestFocus() }
        previouslyExpanded = expandedValue
    }
    LaunchedEffect(search) { if (search.isNotEmpty()) { delay(700); search = "" } }
    LaunchedEffect(hover) {
        val item = enabled.find { it.value == hover }
        if (item != null) { delay(150); changeSubmenu(item as? LabMenuItem.Submenu) }
    }
    val back: () -> Unit = { if (closeLevel != null) closeLevel() else close() }
    val keyHandler: (KeyEvent) -> Boolean = { event ->
        if (event.type != KeyEventType.KeyDown) false
        else when {
            event.key == Key.Escape -> { back(); true }
            event.key == Key.Tab -> { leave(event.isShiftPressed); true }
            event.key == Key.DirectionDown || event.key == Key.DirectionUp || event.key == Key.MoveHome || event.key == Key.MoveEnd -> {
                if (enabled.isNotEmpty()) {
                    val index = enabled.indexOfFirst { it.value == active }
                    active = when (event.key) {
                        Key.MoveHome -> enabled.first().value
                        Key.MoveEnd -> enabled.last().value
                        else -> if (index < 0) (if (event.key == Key.DirectionDown) enabled.first() else enabled.last()).value
                            else enabled[(index + (if (event.key == Key.DirectionDown) 1 else -1) + enabled.size) % enabled.size].value
                    }
                    changeSubmenu(null)
                }; true
            }
            event.key == (if (rtl) Key.DirectionLeft else Key.DirectionRight) -> {
                val item = enabled.find { it.value == active }
                if (item is LabMenuItem.Submenu) changeSubmenu(item) else rootArrow?.invoke(1)
                true
            }
            event.key == (if (rtl) Key.DirectionRight else Key.DirectionLeft) -> {
                if (closeLevel != null) closeLevel() else rootArrow?.invoke(-1)
                true
            }
            event.key == Key.Enter || event.key == Key.Spacebar -> {
                enabled.find { it.value == active }?.let { if (it is LabMenuItem.Submenu) changeSubmenu(it) else select(it) }; true
            }
            else -> {
                val character = event.utf16CodePoint.toChar()
                if (character.isLetterOrDigit() && !event.isCtrlPressed && !event.isAltPressed && !event.isMetaPressed) {
                    val query = search + character.lowercaseChar()
                    search = query
                    val prefix = if (query.all { it == query.first() }) query.first().toString() else query
                    val start = enabled.indexOfFirst { it.value == active }
                    val ordered = if (enabled.isEmpty()) enabled else (1..enabled.size).map { enabled[(start + it).mod(enabled.size)] }
                    ordered.firstOrNull { it.label.startsWith(prefix, ignoreCase = true) }?.let { active = it.value; changeSubmenu(null) }
                    true
                } else false
            }
        }
    }
    val colors = LocalLabTheme.current.colors
    val height = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.height.toDp() } - LabComponents.MenuGap.dp * 2
    LabSurface(if (context) LabComponents.MenuContextMaterial else LabComponents.MenuDropdownMaterial,
        Modifier.width(LabComponents.MenuWidth.dp * maxOf(1f, LocalDensity.current.fontScale)).heightIn(max = height.coerceAtLeast(1.dp))
            .focusRequester(panelFocus).onPreviewKeyEvent(keyHandler).focusable()
            .semantics { paneTitle = label }, material, RoundedCornerShape(LabComponents.MenuRadius.dp),
        if (context) LabComponents.MenuContextShadow else LabComponents.MenuDropdownShadow,
        LabComponents.MenuStrokeWidth.dp, colors[LabComponents.MenuRolesBorder]) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(LabComponents.MenuPadding.dp)) {
            if (heading != null) {
                LabText(heading, Modifier.padding(LabComponents.MenuHeaderPadding.dp), style = menuTextStyle(colors[LabComponents.MenuRolesLabel]).withTypography(
                    fontWeight = FontWeight(LabComponents.MenuHeaderFontWeight.toInt()), letterSpacing = LabComponents.MenuHeaderLetterSpacing.sp))
                MenuSeparator(gap = false)
            }
            for (item in items) key(item.value) {
                if (item is LabMenuItem.Separator) MenuSeparator()
                else if (item is LabMenuItem.Entry) {
                    val interaction = remember { MutableInteractionSource() }
                    val hovered by interaction.collectIsHoveredAsState()
                    LaunchedEffect(hovered) { if (hovered && !item.disabled) { hover = item.value; active = item.value } }
                    Box(Modifier.padding(top = if (context) LabComponents.MenuContextRowGap.dp else 0.dp)) {
                        MenuRow(item, item.value in selected, active == item.value, context, expandedValue == item.value,
                            Modifier.onGloballyPositioned { rowPlaced(item.value, it.boundsInWindow().menuRect()) }
                                .focusRequester(requesters.getValue(item.value)).onFocusChanged { if (it.isFocused) active = item.value }, interaction) {
                            if (item is LabMenuItem.Submenu) changeSubmenu(item) else select(item)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuSeparator(gap: Boolean = true) {
    val colors = LocalLabTheme.current.colors
    Spacer(Modifier.padding(top = if (gap) LabComponents.MenuRowSeparatorGap.dp else 0.dp).fillMaxWidth()
        .height(LabComponents.MenuStrokeWidth.dp).background(colors[LabComponents.MenuRolesBorder]))
}

@Composable
private fun MenuRow(
    item: LabMenuItem.Entry, checked: Boolean, highlighted: Boolean, context: Boolean, expanded: Boolean,
    modifier: Modifier, interaction: MutableInteractionSource, activate: () -> Unit,
) {
    val colors = LocalLabTheme.current.colors
    val labelColor = colors[when { item.disabled -> LabComponents.MenuRolesDisabled; item.tone == LabMenuTone.Danger -> LabComponents.MenuRolesDanger; else -> LabComponents.MenuRolesLabel }]
    val iconColor = if (item.tone == LabMenuTone.Accent && !item.disabled) colors[LabComponents.MenuRolesAccent] else labelColor
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val selectable = when (item) {
        is LabMenuItem.Check -> Modifier.toggleable(value = checked, enabled = !item.disabled, role = Role.Checkbox, interactionSource = interaction, indication = null) { activate() }
        is LabMenuItem.Radio -> Modifier.selectable(selected = checked, enabled = !item.disabled, role = Role.RadioButton, interactionSource = interaction, indication = null, onClick = activate)
        else -> Modifier.clickable(interaction, null, !item.disabled, role = Role.Button, onClick = activate)
    }
    val icon = LabComponents.MenuRowIconSize.dp
    val leading = item.icon != null || item is LabMenuItem.Check || item is LabMenuItem.Radio
    Row(modifier.fillMaxWidth().background(if (highlighted && !item.disabled) colors[LabComponents.MenuRolesHighlight] else Color.Transparent,
        RoundedCornerShape(LabComponents.MenuRowRadius.dp)).then(selectable)
        .semantics { if (item is LabMenuItem.Submenu) stateDescription = if (expanded) "Expanded" else "Collapsed" }
        .padding(start = if (context && !leading) LabComponents.MenuContextLabelInset.dp else LabComponents.MenuRowPaddingX.dp,
            end = LabComponents.MenuRowPaddingX.dp, top = LabComponents.MenuRowPaddingY.dp, bottom = LabComponents.MenuRowPaddingY.dp),
        verticalAlignment = Alignment.CenterVertically) {
        if (leading) Box(Modifier.size(icon).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
            when {
                item is LabMenuItem.Check && checked -> Icon(checkmark, iconColor, size = icon)
                item is LabMenuItem.Radio && checked -> Canvas(Modifier.size(icon)) {
                    val radius = LabComponents.MenuRadioDotSize.dp.toPx() / 2
                    drawCircle(iconColor, radius)
                    drawCircle(Brush.verticalGradient(
                        listOf(colors[LabComponents.MenuRadioHighlightRole].copy(alpha = LabComponents.MenuRadioHighlightOpacity), Color.Transparent),
                        startY = center.y - radius, endY = center.y + radius), radius)
                }
                item.icon != null -> Icon(item.icon!!, iconColor, variant = item.iconVariant, size = icon)
            }
        }
        if (leading) Spacer(Modifier.width(LabComponents.MenuRowLabelGap.dp))
        LabText(item.label, Modifier.weight(1f), style = menuTextStyle(labelColor))
        if (!item.disabled && (item.shortcut.isNotEmpty() || item.iconEnd != null || item is LabMenuItem.Submenu)) Row(Modifier.padding(start = LabComponents.MenuRowAccessoryGap.dp).clearAndSetSemantics {}, verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(LabComponents.MenuRowAccessoryGap.dp)) {
            if (item.shortcut.isNotEmpty()) LabKbd(item.shortcut)
            item.iconEnd?.let { Icon(it, iconColor, variant = item.iconEndVariant, size = icon) }
            if (item is LabMenuItem.Submenu) Icon(chevronForward, iconColor,
                Modifier.graphicsLayer { scaleX = if (rtl) -1f else 1f }, size = icon)
        }
    }
}

/** Placement uses the real anchor and flips before clamping; start/end follow layout direction. */
internal class MenuPosition(
    private val placement: LabMenuPlacement, private val gap: Int,
    private val point: IntOffset? = null, private val nested: Boolean = false,
) : PopupPositionProvider {
    override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize, layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
        val a = anchorBounds; val p = popupContentSize
        val rtl = layoutDirection == LayoutDirection.Rtl
        val end = placement == LabMenuPlacement.BottomEnd || placement == LabMenuPlacement.TopEnd
        val top = placement == LabMenuPlacement.TopStart || placement == LabMenuPlacement.TopEnd
        var x = when {
            point != null -> a.left + point.x
            nested -> if (rtl) a.left - p.width - gap else a.right + gap
            end != rtl -> a.right - p.width
            else -> a.left
        }
        var y = when { point != null -> a.top + point.y; nested -> a.top; top -> a.top - p.height - gap; else -> a.bottom + gap }
        if (nested && (x < gap || x + p.width > windowSize.width - gap)) x = if (rtl) a.right + gap else a.left - p.width - gap
        if (!nested && point == null && (y < gap || y + p.height > windowSize.height - gap)) {
            val opposite = if (top) a.bottom + gap else a.top - p.height - gap
            if (opposite >= gap && opposite + p.height <= windowSize.height - gap) y = opposite
        }
        return IntOffset(x.coerceIn(gap, maxOf(gap, windowSize.width - p.width - gap)), y.coerceIn(gap, maxOf(gap, windowSize.height - p.height - gap)))
    }
}
