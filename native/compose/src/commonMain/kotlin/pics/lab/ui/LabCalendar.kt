package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.focus.*
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import kotlinx.datetime.*
import pics.lab.icons.Icon
import pics.lab.icons.symbols.*

/**
 * Inline Gregorian calendar. value and month are controlled, ISO date-only values (years 1–9999).
 * Range values contain zero, one (anchor), or two inclusive, ascending endpoints.
 * Rejected callbacks leave the supplied value/month intact. localeTag changes presentation only.
 * today defaults to the current UTC date; supply it explicitly for the application's time zone.
 */
@Composable
public fun LabCalendar(
    value: List<LocalDate>,
    onValueChange: (List<LocalDate>) -> Unit,
    month: LocalDate,
    onMonthChange: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
    selection: LabCalendarSelection = LabCalendarSelection.Single,
    size: LabCalendarSize = LabCalendarSize.Small,
    localeTag: String = "en-US",
    firstDayOfWeek: DayOfWeek? = null,
    today: LocalDate? = calendarToday(),
    min: LocalDate? = null,
    max: LocalDate? = null,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    isDateUnavailable: ((LocalDate) -> Boolean)? = null,
    events: Map<LocalDate, LabCalendarEvents> = emptyMap(),
    markers: Set<LocalDate> = emptySet(),
    strings: LabCalendarStrings = LabCalendarStrings(),
    material: LabMaterial = LabMaterial.Acrylic,
) {
    require(month in calendarFirst..calendarLast && value.all { it in calendarFirst..calendarLast }
        && (min == null || min in calendarFirst..calendarLast) && (max == null || max in calendarFirst..calendarLast)) { "Calendar dates require ISO years 1–9999" }
    require(value.size <= if (selection == LabCalendarSelection.Single) 1 else 2) { "Invalid calendar selection size" }
    require(value.size < 2 || value[0] <= value[1]) { "Range endpoints must be ascending" }
    require(min == null || max == null || min <= max) { "Minimum date must not exceed maximum date" }
    val current = month.calendarMonth()
    val locale = remember(localeTag) { calendarLocale(localeTag) }
    val firstDay = firstDayOfWeek ?: locale.firstDay
    val days = remember(current, firstDay) { calendarDays(current, firstDay) }
    val colors = LocalLabTheme.current.colors
    val density = LocalDensity.current
    val scale = density.fontScale
    val textMeasurer = rememberTextMeasurer()
    val small = size == LabCalendarSize.Small
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val metrics = if (small) LabComponents.CalendarS else LabComponents.CalendarM
    val padding = metrics.padding.dp
    var retainedFocus by remember { mutableStateOf(value.firstOrNull()?.takeIf { it.calendarMonth() == current }
        ?: today?.takeIf { it.calendarMonth() == current } ?: current) }
    var pendingFocus by remember { mutableStateOf<LocalDate?>(null) }
    var focusWithin by remember { mutableStateOf(false) }
    var moveFocus by remember { mutableStateOf(false) }
    val requesters = remember(days) { days.filterNotNull().associateWith { FocusRequester() } }
    // Resolve the destination before composition attaches the requester. Moving the date in
    // another effect can target the old cell and let its onFocusChanged overwrite the request.
    val focused = pendingFocus?.takeIf { it.calendarMonth() == current }
        ?: retainedFocus.takeIf { it.calendarMonth() == current }
        ?: value.firstOrNull()?.takeIf { it.calendarMonth() == current } ?: current
    LaunchedEffect(current, focused, moveFocus) {
        val acceptedMonth = pendingFocus?.calendarMonth() == current
        if (enabled && (moveFocus || acceptedMonth || focusWithin)) {
            // Complete the new month's layout before focusing its newly attached cell.
            withFrameNanos { }
            requesters.getValue(focused).requestFocus()
            retainedFocus = focused
            if (acceptedMonth) pendingFocus = null
            moveFocus = false
        }
    }
    fun move(date: LocalDate) {
        val destination = date.coerceIn(min ?: calendarFirst, max ?: calendarLast)
        if (destination.calendarMonth() == current) { pendingFocus = null; retainedFocus = destination; moveFocus = true }
        else { pendingFocus = destination; onMonthChange(destination.calendarMonth()) }
    }
    fun pick(date: LocalDate) {
        if (!enabled || readOnly || date.calendarMonth() != current) return
        pendingFocus = null
        calendarSelect(value, date, selection, min, max, isDateUnavailable)?.let(onValueChange) ?: return
    }
    fun navigate(delta: Int) {
        pendingFocus = null
        val next = current.calendarShiftMonths(delta).calendarMonth()
        if (next != current) onMonthChange(next)
    }
    val previousEnabled = enabled && current > calendarFirst && (min == null || current > min.calendarMonth())
    val nextEnabled = enabled && current < calendarLast.calendarMonth() && (max == null || current < max.calendarMonth())
    val root = modifier.widthIn(max = metrics.maxWidth.dp).width(metrics.width.dp)
        .semantics { isTraversalGroup = true; contentDescription = strings.label }
    LabSurface(LabComponents.CalendarMaterial, root, material, RoundedCornerShape(LabComponents.CalendarRadius.dp),
        strokeWidth = LabComponents.CalendarStroke.dp, strokeColor = colors[LabComponents.CalendarRolesBorder]) {
        Column {
            Row(Modifier.fillMaxWidth().background(colors[LabComponents.CalendarRolesHeader]).padding(padding),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(LabComponents.CalendarGap.dp)) {
                if (small) CalendarNavigation(strings.previousMonth, previousEnabled, size, previous = true, rtl = rtl) { navigate(-1) }
                LabText(locale.month(current), Modifier.weight(1f).semantics { heading(); liveRegion = LiveRegionMode.Polite },
                    style = LabType.body().withTypography(fontSize = (if (small) LabComponents.CalendarTypographySTitleFontSize else LabComponents.CalendarTypographyMTitleFontSize).sp,
                        lineHeight = (if (small) LabComponents.CalendarTypographySTitleLineHeight else LabComponents.CalendarTypographyMTitleLineHeight).sp, fontWeight = FontWeight((if (small) LabComponents.CalendarTypographySTitleFontWeight else LabComponents.CalendarTypographyMTitleFontWeight).toInt()),
                        letterSpacing = (if (small) LabComponents.CalendarTypographySTitleLetterSpacing else LabComponents.CalendarTypographyMTitleLetterSpacing).sp, color = colors[LabComponents.CalendarRolesLabel])
                        .copy(textAlign = if (small) TextAlign.Center else TextAlign.Start))
                if (!small) CalendarNavigation(strings.previousMonth, previousEnabled, size, previous = true, rtl = rtl) { navigate(-1) }
                CalendarNavigation(strings.nextMonth, nextEnabled, size, previous = false, rtl = rtl) { navigate(1) }
            }
            BoxWithConstraints(Modifier.fillMaxWidth().padding(start = padding, end = padding, bottom = padding, top = metrics.areaTop.dp)) {
                // A calendar is two-dimensional: at large text sizes scroll the grid instead of
                // shrinking the user's text or letting adjacent date glyphs overlap.
                val dayFont = if (small) LabComponents.CalendarTypographySDayFontSize else LabComponents.CalendarTypographyMDayFontSize
                val gridWidth = maxOf(maxWidth, (dayFont * scale * 2 * 7).dp)
                val cellHeight = gridWidth / 7
                val weekdayStyle = LabType.body().withTypography(
                    fontSize = (if (small) LabComponents.CalendarTypographySWeekdayFontSize else LabComponents.CalendarTypographyMWeekdayFontSize).sp,
                    lineHeight = (if (small) LabComponents.CalendarTypographySWeekdayLineHeight else LabComponents.CalendarTypographyMWeekdayLineHeight).sp,
                    fontWeight = FontWeight((if (small) LabComponents.CalendarTypographySWeekdayFontWeight else LabComponents.CalendarTypographyMWeekdayFontWeight).toInt()),
                    letterSpacing = (if (small) LabComponents.CalendarTypographySWeekdayLetterSpacing else LabComponents.CalendarTypographyMWeekdayLetterSpacing).sp,
                    color = colors[LabComponents.CalendarRolesSecondary])
                val weekdayWidth = with(density) { (cellHeight - LabComponents.CalendarGap.dp).toPx() }
                val narrowWeekdays = DayOfWeek.entries.any { textMeasurer.measure(locale.weekday(it, false), weekdayStyle).size.width > weekdayWidth }
                Column(Modifier.horizontalScroll(rememberScrollState()).width(gridWidth)
                    .onFocusChanged { focusWithin = it.hasFocus }.focusGroup()
                    .semantics { collectionInfo = CollectionInfo(7, 7) }
                    .onPreviewKeyEvent { event ->
                        if (!enabled || event.type != KeyEventType.KeyDown) false else {
                            val offset = (focused.dayOfWeek.isoDayNumber - firstDay.isoDayNumber + 7) % 7
                            val target = when (event.key) {
                                Key.DirectionLeft -> focused.calendarShiftDays(if (rtl) 1 else -1)
                                Key.DirectionRight -> focused.calendarShiftDays(if (rtl) -1 else 1)
                                Key.DirectionUp -> focused.calendarShiftDays(-7)
                                Key.DirectionDown -> focused.calendarShiftDays(7)
                                Key.MoveHome -> focused.calendarShiftDays(-offset)
                                Key.MoveEnd -> focused.calendarShiftDays(6 - offset)
                                Key.PageUp -> focused.calendarShiftMonths(if (event.isShiftPressed) -12 else -1)
                                Key.PageDown -> focused.calendarShiftMonths(if (event.isShiftPressed) 12 else 1)
                                else -> null
                            }
                            if (target != null) { move(target); true }
                            else if (event.key == Key.Enter || event.key == Key.Spacebar) { pick(focused); true }
                            else false
                        }
                    }) {
                    Row {
                        repeat(7) { index ->
                            val day = DayOfWeek.entries[(firstDay.ordinal + index) % 7]
                            Box(Modifier.weight(1f).height(cellHeight).clearAndSetSemantics {
                                contentDescription = locale.weekday(day, true)
                                collectionItemInfo = CollectionItemInfo(0, 1, index, 1); heading()
                            }, contentAlignment = Alignment.Center) {
                                LabText(locale.weekday(day, false, narrowWeekdays), style = weekdayStyle, maxLines = 1, softWrap = false)
                            }
                        }
                    }
                    repeat(6) { row ->
                        Row {
                            repeat(7) { column ->
                                val date = days[row * 7 + column]
                                if (date == null) Box(Modifier.weight(1f).height(cellHeight))
                                else key(date) {
                                    val inMonth = date.calendarMonth() == current
                                    val available = inMonth && calendarAvailable(date, min, max, isDateUnavailable)
                                    val active = inMonth && if (value.size == 2) date >= value[0] && date <= value[1] else date in value
                                    val range = value.size == 2 && value[0] != value[1] && active
                                    val rangeStart = range && date == value[0]
                                    val rangeEnd = range && date == value[1]
                                    val entry = events[date]
                                    val name = buildList {
                                        add(locale.date(date))
                                        if (date == today) add(strings.today)
                                        if (!available) add(strings.unavailable)
                                        if (rangeStart) add(strings.rangeStart)
                                        if (rangeEnd) add(strings.rangeEnd)
                                        if (entry != null && entry.count > 0) add(entry.label)
                                        if (date in markers) add(strings.marked)
                                    }.joinToString(", ")
                                    CalendarCell(locale.day(date), name, size, active, !enabled || !available,
                                        date.calendarMonth() != current, range, rangeStart, rangeEnd, entry?.count ?: 0, date in markers,
                                        modifier = Modifier.weight(1f).height(cellHeight)
                                            .focusProperties { canFocus = enabled && date == focused }
                                            .focusRequester(requesters.getValue(date))
                                            .onFocusChanged { if (it.isFocused) retainedFocus = date }
                                            .semantics { collectionItemInfo = CollectionItemInfo(row + 1, 1, column, 1) },
                                        interactive = enabled, readOnly = readOnly, onClick = { pick(date) })
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarNavigation(label: String, enabled: Boolean, size: LabCalendarSize, previous: Boolean, rtl: Boolean, onClick: () -> Unit) {
    val colors = LocalLabTheme.current.colors
    val small = size == LabCalendarSize.Small
    val interaction = remember { MutableInteractionSource() }
    val hover by interaction.collectIsHoveredAsState()
    val focused by interaction.collectIsFocusedAsState()
    val metrics = if (small) LabComponents.CalendarS else LabComponents.CalendarM
    val shape = RoundedCornerShape(metrics.navRadius.dp)
    Box(Modifier.size(metrics.navSize.dp)
        .background(if (hover && enabled) colors[LabComponents.CalendarRolesHover] else Color.Transparent, shape)
        .border(LabComponents.CalendarStroke.dp, colors[if (focused) LabComponents.CalendarRolesFocus else LabComponents.CalendarRolesBorder], shape)
        .clickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
        .semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Icon(if (!small) { if (previous) chevronDown else chevronUp }
            else if (previous != rtl) chevronBack else chevronForward,
            tint = colors[if (enabled) LabComponents.CalendarRolesSecondary else LabComponents.CalendarRolesDisabled], size = LabComponents.CalendarIcon.dp)
    }
}

@Composable
private fun CalendarCell(text: String, label: String, size: LabCalendarSize, active: Boolean, disabled: Boolean,
    outside: Boolean, range: Boolean, rangeStart: Boolean, rangeEnd: Boolean, eventCount: Int, marked: Boolean,
    modifier: Modifier, interactive: Boolean, readOnly: Boolean, onClick: () -> Unit) {
    val colors = LocalLabTheme.current.colors
    val small = size == LabCalendarSize.Small
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val interaction = remember { MutableInteractionSource() }
    val hover by interaction.collectIsHoveredAsState()
    val focus by interaction.collectIsFocusedAsState()
    val metrics = if (small) LabComponents.CalendarS else LabComponents.CalendarM
    val radius = metrics.cellRadius.dp
    val shape = if (!range) RoundedCornerShape(radius) else RoundedCornerShape(
        topStart = if (rangeStart) radius else 0.dp, bottomStart = if (rangeStart) radius else 0.dp,
        topEnd = if (rangeEnd) radius else 0.dp, bottomEnd = if (rangeEnd) radius else 0.dp)
    val foreground = colors[when { active -> LabComponents.CalendarRolesActiveLabel; disabled || outside -> LabComponents.CalendarRolesDisabled; else -> LabComponents.CalendarRolesLabel }]
    val edgeShift = (LabComponents.CalendarRangeEdgePadding - LabComponents.CalendarRangeInnerPadding) / 2
    val shift = if (rangeStart) edgeShift.dp else if (rangeEnd) (-edgeShift).dp else 0.dp
    Box(modifier
        .background(if (active) colors[LabComponents.CalendarRolesActive] else if (hover && !disabled && !readOnly) colors[LabComponents.CalendarRolesHover] else Color.Transparent, shape)
        .drawWithCache {
            val inset = LabComponents.CalendarFocusOffset.dp.toPx()
            val left = -inset
            val top = -inset
            val right = this.size.width + inset
            val bottom = this.size.height + inset
            val corner = radius.toPx() + inset
            val roundLeft = if (rtl) rangeEnd else rangeStart
            val roundRight = if (rtl) rangeStart else rangeEnd
            // A range's focus follows its continuous surface: only the external endpoint
            // edge closes. Center cells have two independent, straight horizontal strokes.
            val rangeOutline = if (range && focus) Path().apply {
                moveTo(if (roundLeft) left + corner else left, top)
                lineTo(if (roundRight) right - corner else right, top)
                if (roundRight) {
                    arcTo(Rect(right - 2 * corner, top, right, top + 2 * corner), -90f, 90f, false)
                    lineTo(right, bottom - corner)
                    arcTo(Rect(right - 2 * corner, bottom - 2 * corner, right, bottom), 0f, 90f, false)
                } else moveTo(right, bottom)
                lineTo(if (roundLeft) left + corner else left, bottom)
                if (roundLeft) {
                    arcTo(Rect(left, bottom - 2 * corner, left + 2 * corner, bottom), 90f, 90f, false)
                    lineTo(left, top + corner)
                    arcTo(Rect(left, top, left + 2 * corner, top + 2 * corner), 180f, 90f, false)
                }
            } else null
            onDrawWithContent {
                drawContent()
                if (rangeStart || rangeEnd) {
                    val x = if (roundLeft) LabComponents.CalendarRangeMarkerInset.dp.toPx() else this.size.width - LabComponents.CalendarRangeMarkerInset.dp.toPx()
                    val halfHeight = LabComponents.CalendarRangeMarkerHeight.dp.toPx() / 2
                    drawLine(foreground, Offset(x, this.size.height / 2 - halfHeight), Offset(x, this.size.height / 2 + halfHeight), LabComponents.CalendarRangeMarkerStroke.dp.toPx())
                }
                if (focus) {
                    val stroke = Stroke(LabComponents.CalendarFocusWidth.dp.toPx())
                    if (rangeOutline != null) drawPath(rangeOutline, colors[LabComponents.CalendarRolesFocus], style = stroke)
                    else drawRoundRect(colors[LabComponents.CalendarRolesFocus], Offset(left, top),
                        Size(right - left, bottom - top), CornerRadius(corner), style = stroke)
                }
            }
        }
        .clickable(interactionSource = interaction, indication = null, enabled = interactive, role = Role.Button) {
            if (!disabled && !readOnly) onClick()
        }
        .semantics(mergeDescendants = true) {
            contentDescription = label; selected = active
            if (disabled || readOnly) disabled()
        }, contentAlignment = Alignment.Center) {
        LabText(text, Modifier.offset(x = shift).clearAndSetSemantics {}, style = LabType.body().withTypography(
            fontSize = (if (small) LabComponents.CalendarTypographySDayFontSize else LabComponents.CalendarTypographyMDayFontSize).sp,
            lineHeight = (if (small) LabComponents.CalendarTypographySDayLineHeight else LabComponents.CalendarTypographyMDayLineHeight).sp,
            fontWeight = FontWeight((if (small) LabComponents.CalendarTypographySDayFontWeight else LabComponents.CalendarTypographyMDayFontWeight).toInt()),
            letterSpacing = (if (small) LabComponents.CalendarTypographySDayLetterSpacing else LabComponents.CalendarTypographyMDayLetterSpacing).sp, color = foreground), softWrap = false, maxLines = 1)
        if (eventCount > 0) LabCalendarStatusDots(eventCount,
            Modifier.align(Alignment.BottomCenter).padding(bottom = metrics.dotsBottom.dp), active, disabled || outside)
        if (marked) Box(Modifier.align(Alignment.BottomCenter).offset(x = shift, y = (-LabComponents.CalendarMarkerBottom).dp).size(LabComponents.CalendarMarkerSize.dp)
            .background(colors[if (active) LabComponents.CalendarMarkerActiveSurfaceRole else LabComponents.CalendarMarkerSurfaceRole], RoundedCornerShape(100))
            .border(LabComponents.CalendarMarkerStroke.dp, colors[if (active) LabComponents.CalendarMarkerActiveBorderRole else LabComponents.CalendarRolesBorder], RoundedCornerShape(100)).clearAndSetSemantics {},
            contentAlignment = Alignment.Center) {
            Icon(checkmark, tint = colors[if (active) LabComponents.CalendarMarkerActiveLabelRole else LabComponents.CalendarMarkerLabelRole], size = (LabComponents.CalendarMarkerSize - 2 * LabComponents.CalendarMarkerPadding).dp)
        }
    }
}

/** Authored five-dot indicator. Put an event description on the containing date, not on each dot. */
@Composable
public fun LabCalendarStatusDots(count: Int, modifier: Modifier = Modifier, active: Boolean = false, disabled: Boolean = false) {
    val colors = LocalLabTheme.current.colors
    val color = colors[if (active) LabComponents.CalendarDotsRolesActive else if (disabled) LabComponents.CalendarDotsRolesDisabled else LabComponents.CalendarDotsRolesDefault]
    val tail = LabComponents.CalendarDotsGlyphPath
    Canvas(modifier.size(LabComponents.CalendarDotsWidth.dp, LabComponents.CalendarDotsSize.dp).clearAndSetSemantics {}) {
        val visible = count.coerceIn(0, LabComponents.CalendarDotsCount.toInt())
        val unit = 1.dp.toPx()
        val diameter = LabComponents.CalendarDotsSize * unit
        val step = (LabComponents.CalendarDotsSize + LabComponents.CalendarDotsGap) * unit
        val offset = (this.size.width - visible * diameter - (visible - 1).coerceAtLeast(0) * LabComponents.CalendarDotsGap * unit) / 2
        if (visible > 0) drawCircle(color, diameter / 2, Offset(offset + diameter / 2, diameter / 2))
        for (index in 1 until visible) translate(offset + index * step, 0f) {
            withTransform({ scale(unit, unit, Offset.Zero) }) { drawPath(tail, color) }
        }
    }
}
