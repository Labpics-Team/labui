package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlinx.datetime.*
import java.io.File
import java.io.ByteArrayInputStream
import javax.imageio.ImageIO
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*

@OptIn(androidx.compose.ui.InternalComposeUiApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class)
class CalendarRenderTest {
    private val may = LocalDate(2025, 5, 1)
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun action(scene: ImageComposeScene, prefix: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.any { name -> name.startsWith(prefix) } == true &&
            it.config.getOrNull(SemanticsActions.OnClick)?.action != null
    }
    private fun day(scene: ImageComposeScene, date: LocalDate, locale: String = "en-US") = action(scene, calendarLocale(locale).date(date))
    private data class Fixture(val scene: ImageComposeScene, val ready: AtomicBoolean)
    private fun fixture(width: Int = 440, height: Int = 700, scale: Float = 1f,
        appearance: LabAppearance = LabAppearance.Light, rtl: Boolean = false, content: @Composable () -> Unit): Fixture {
        val ready = AtomicBoolean(false)
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        val theme = LabThemeState(initialLabColors(prefs), prefs)
        val scene = ImageComposeScene(width, height, Density(1f, scale)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                LabTheme(theme, font) {
                    LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(theme.colors["bg-secondary"])) }) {
                        Column(Modifier.fillMaxSize().padding(16.dp)) { content() }
                    }
                }
            }
        }
        return Fixture(scene, ready)
    }
    private fun Fixture.settle(): ByteArray {
        var previous: ByteArray? = null
        var stable = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            stable = if (ready.get() && previous?.contentEquals(png) == true) stable + 1 else 0
            if (stable >= 4) return png
            previous = png; Thread.sleep(10)
        }
        error("Calendar did not settle")
    }
    private fun Fixture.key(key: Key, shift: Boolean = false) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown, isShiftPressed = shift))
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp, isShiftPressed = shift))
        settle()
    }
    private fun Fixture.click(date: LocalDate) {
        val bounds = day(scene, date).boundsInRoot
        scene.sendPointerEvent(PointerEventType.Press, bounds.center)
        scene.sendPointerEvent(PointerEventType.Release, bounds.center)
        settle()
    }

    @Test fun controlledSelectionAndMonthNeverChangeUntilTheParentAccepts() {
        var value by mutableStateOf(emptyList<LocalDate>())
        var month by mutableStateOf(may)
        var accept = false
        var selectionRequests = 0
        var monthRequests = 0
        val f = fixture { LabCalendar(value, { selectionRequests++; if (accept) value = it }, month,
            { monthRequests++; if (accept) month = it }, today = may) }
        try {
            f.settle(); f.click(LocalDate(2025, 5, 6))
            assertTrue(value.isEmpty()); assertEquals(1, selectionRequests)
            assertEquals(false, day(f.scene, LocalDate(2025, 5, 6)).config[SemanticsProperties.Selected])
            action(f.scene, "Next month").config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertEquals(may, month); assertEquals(1, monthRequests)
            accept = true; f.click(LocalDate(2025, 5, 6))
            assertEquals(listOf(LocalDate(2025, 5, 6)), value)
            action(f.scene, "Next month").config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertEquals(LocalDate(2025, 6, 1), month)
        } finally { f.scene.close() }
    }

    @Test fun keyboardCrossesMonthAndLeapYearWithOneDateTabStopAndRtlDirection() {
        for (rtl in listOf(false, true)) {
            var month by mutableStateOf(LocalDate(2024, 1, 1))
            var value by mutableStateOf(listOf(LocalDate(2024, 1, 31)))
            val f = fixture(rtl = rtl) {
                LabCalendar(value, { value = it }, month, { month = it }, today = null)
                Box(Modifier.size(40.dp).clickable {}.semantics { contentDescription = "After calendar" })
            }
            try {
                f.settle()
                assertTrue(day(f.scene, value[0]).config[SemanticsActions.RequestFocus].action!!.invoke())
                f.settle(); f.key(Key.PageDown)
                assertEquals(LocalDate(2024, 2, 1), month)
                f.key(Key.Enter); assertEquals(listOf(LocalDate(2024, 2, 29)), value)
                f.key(if (rtl) Key.DirectionLeft else Key.DirectionRight)
                assertEquals(LocalDate(2024, 3, 1), month)
                f.key(Key.Spacebar); assertEquals(listOf(LocalDate(2024, 3, 1)), value)
                f.key(Key.PageUp, shift = true); f.key(Key.Enter)
                assertEquals(listOf(LocalDate(2023, 3, 1)), value)
                f.key(Key.Tab)
                assertEquals(true, action(f.scene, "After calendar").config[SemanticsProperties.Focused])
            } finally { f.scene.close() }
        }
    }

    @Test fun rangesRespectInteriorUnavailabilityAndReadonlyKeepsNavigation() {
        var value by mutableStateOf(emptyList<LocalDate>())
        var month by mutableStateOf(may)
        var readOnly by mutableStateOf(false)
        val f = fixture { LabCalendar(value, { value = it }, month, { month = it }, selection = LabCalendarSelection.Range,
            today = null, min = may, max = LocalDate(2025, 6, 30), readOnly = readOnly,
            isDateUnavailable = { it == LocalDate(2025, 5, 7) },
            events = mapOf(LocalDate(2025, 5, 8) to LabCalendarEvents(12, "12 appointments"))) }
        try {
            f.settle(); f.click(LocalDate(2025, 5, 9)); f.click(LocalDate(2025, 5, 5))
            assertEquals(listOf(LocalDate(2025, 5, 9)), value)
            f.click(LocalDate(2025, 5, 8)); assertEquals(listOf(LocalDate(2025, 5, 8), LocalDate(2025, 5, 9)), value)
            assertTrue(day(f.scene, LocalDate(2025, 5, 7)).config.contains(SemanticsProperties.Disabled))
            assertTrue(day(f.scene, LocalDate(2025, 5, 8)).config[SemanticsProperties.ContentDescription].single().contains("12 appointments"))
            readOnly = true; f.settle(); f.click(LocalDate(2025, 5, 15))
            assertEquals(2, value.size)
            action(f.scene, "Next month").config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertEquals(LocalDate(2025, 6, 1), month)
        } finally { f.scene.close() }
    }

    @Test fun adjacentDatesAreDisabledUntilNavigationReachesTheirMonth() {
        val adjacent = LocalDate(2025, 6, 1)
        var month by mutableStateOf(may)
        var value by mutableStateOf(listOf(LocalDate(2025, 5, 31)))
        var selectionRequests = 0
        var monthRequests = 0
        val f = fixture {
            LabCalendar(value, { selectionRequests++; value = it }, month,
                { monthRequests++; month = it }, today = null)
        }
        try {
            f.settle()
            val disabledAdjacent = day(f.scene, adjacent)
            assertTrue(disabledAdjacent.config.contains(SemanticsProperties.Disabled))
            f.click(adjacent)
            disabledAdjacent.config[SemanticsActions.OnClick].action!!.invoke(); f.settle()
            assertEquals(0, selectionRequests)
            assertEquals(0, monthRequests)
            assertEquals(listOf(LocalDate(2025, 5, 31)), value)
            day(f.scene, value[0]).config[SemanticsActions.RequestFocus].action!!.invoke(); f.settle()
            f.key(Key.DirectionRight)
            assertEquals(LocalDate(2025, 6, 1), month)
            assertEquals(1, monthRequests)
            assertFalse(day(f.scene, adjacent).config.contains(SemanticsProperties.Disabled))
            f.key(Key.Enter)
            assertEquals(listOf(adjacent), value)
            assertEquals(1, selectionRequests)
        } finally { f.scene.close() }
    }

    @Test fun localeUsesPlatformNamesAndWeekRulesAndDateFormattingIgnoresSystemTimezone() {
        assertEquals(DayOfWeek.SUNDAY, calendarLocale("en-US").firstDay)
        assertEquals(DayOfWeek.MONDAY, calendarLocale("ru-RU").firstDay)
        assertTrue(calendarLocale("ru-RU").month(may).contains("май"))
        val old = TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Kiritimati"))
            val east = calendarLocale("en-US").date(LocalDate(2025, 3, 9))
            TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
            assertEquals(east, calendarLocale("en-US").date(LocalDate(2025, 3, 9)))
        } finally { TimeZone.setDefault(old) }
    }

    @Test fun authoredSizesThemesRangesAndLargeTextRenderWithoutEscapingTheSurface() {
        val output = File("build/calendar-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (size in LabCalendarSize.entries) {
            val f = fixture(width = if (size == LabCalendarSize.Small) 352 else 432, height = 540, appearance = appearance) {
                LabCalendar(listOf(LocalDate(2025, 5, 13), LocalDate(2025, 5, 17)), {}, may, {}, size = size,
                    selection = LabCalendarSelection.Range, today = LocalDate(2025, 5, 23), firstDayOfWeek = DayOfWeek.MONDAY,
                    min = LocalDate(2025, 5, 2), events = (1..28).associate { LocalDate(2025, 5, it) to LabCalendarEvents(it % 7, "$it events") },
                    markers = setOf(LocalDate(2025, 5, 13), LocalDate(2025, 5, 23)))
            }
            try {
                File(output, "${size.name.lowercase()}-${appearance.name.lowercase()}-range.png").writeBytes(f.settle())
                val root = nodes(f.scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription) == listOf("Calendar") }
                assertEquals(if (size == LabCalendarSize.Small) 320f else 400f, root.boundsInRoot.width)
                val cell = day(f.scene, LocalDate(2025, 5, 13)).boundsInRoot
                assertEquals(cell.width, cell.height, 1f) // Pixel allocation distributes the 7-column remainder.
                val days = nodes(f.scene).filter { it.config.contains(SemanticsProperties.Selected) }
                assertEquals(42, days.size)
                assertEquals(5, days.count { it.config[SemanticsProperties.Selected] })
            } finally { f.scene.close() }
        }
        val f = fixture(width = 320, height = 950, scale = 2f, appearance = LabAppearance.Dark) {
            LabCalendar(listOf(LocalDate(2025, 5, 15)), {}, may, {}, today = null, size = LabCalendarSize.Medium, localeTag = "ru-RU")
        }
        try {
            File(output, "medium-narrow-dark-200.png").writeBytes(f.settle())
            val days = nodes(f.scene).filter { it.config.contains(SemanticsProperties.Selected) }
            assertTrue(days.filter { it.boundsInRoot.width > 0 }.all { it.boundsInRoot.height >= 64 })
            assertEquals(42, days.size)
            val viewport = nodes(f.scene).single { it.config.contains(SemanticsProperties.HorizontalScrollAxisRange) }
            assertTrue(viewport.boundsInRoot.left >= 16 && viewport.boundsInRoot.right <= 304)
            assertTrue(viewport.config[SemanticsProperties.HorizontalScrollAxisRange].maxValue() > 0)
            day(f.scene, LocalDate(2025, 5, 15), "ru-RU").config[SemanticsActions.RequestFocus].action!!.invoke(); f.settle()
            repeat(3) { f.key(Key.DirectionRight) }
            val focused = day(f.scene, LocalDate(2025, 5, 18), "ru-RU")
            assertEquals(true, focused.config[SemanticsProperties.Focused])
            assertEquals(64f, focused.boundsInRoot.width)
            File(output, "medium-narrow-dark-200-focus-scroll.png").writeBytes(f.settle())
        } finally { f.scene.close() }
    }

    @Test fun singleHoverFocusDisabledAndMaterialsUseTheSameAuthoredCells() {
        val output = File("build/calendar-evidence").apply { mkdirs() }
        for (state in listOf("default", "single", "hover", "focus", "disabled")) {
            val selected = if (state == "single" || state == "disabled") listOf(LocalDate(2025, 5, 15)) else emptyList()
            val f = fixture(width = 352, height = 430) {
                LabCalendar(selected, {}, may, {}, enabled = state != "disabled", today = LocalDate(2025, 5, 15),
                    events = mapOf(LocalDate(2025, 5, 15) to LabCalendarEvents(9, "9 events")))
            }
            try {
                f.settle()
                val date = day(f.scene, LocalDate(2025, 5, 15))
                if (state == "hover") f.scene.sendPointerEvent(PointerEventType.Move, date.boundsInRoot.center)
                if (state == "focus") date.config[SemanticsActions.RequestFocus].action!!.invoke()
                File(output, "small-$state.png").writeBytes(f.settle())
                if (state == "disabled") assertTrue(date.config.contains(SemanticsProperties.Disabled))
                if (state == "focus") assertEquals(true, day(f.scene, LocalDate(2025, 5, 15)).config[SemanticsProperties.Focused])
            } finally { f.scene.close() }
        }
        for (material in LabMaterial.entries) {
            val f = fixture(width = 352, height = 430, appearance = LabAppearance.Dark, rtl = true) {
                LabCalendar(listOf(LocalDate(2025, 5, 12), LocalDate(2025, 5, 15)), {}, may, {}, material = material,
                    selection = LabCalendarSelection.Range, localeTag = "ar-EG", today = null)
            }
            try { File(output, "small-rtl-${material.name.lowercase()}.png").writeBytes(f.settle()) }
            finally { f.scene.close() }
        }
    }

    @Test fun rangeFocusKeepsInteriorEdgesOpenAndOnlyRoundsTheExternalEndpoint() {
        val output = File("build/calendar-evidence").apply { mkdirs() }
        for (size in LabCalendarSize.entries) for (rtl in listOf(false, true)) {
            val f = fixture(width = if (size == LabCalendarSize.Small) 352 else 432, height = 540, rtl = rtl) {
                LabCalendar(listOf(LocalDate(2025, 5, 13), LocalDate(2025, 5, 17)), {}, may, {},
                    selection = LabCalendarSelection.Range, size = size, today = null, firstDayOfWeek = DayOfWeek.MONDAY)
            }
            try {
                val baseline = ImageIO.read(ByteArrayInputStream(f.settle()))
                day(f.scene, LocalDate(2025, 5, 13)).config[SemanticsActions.RequestFocus].action!!.invoke(); f.settle()
                for ((index, name) in listOf("start", "center", "end").withIndex()) {
                    if (index > 0) repeat(2) { f.key(if (rtl) Key.DirectionLeft else Key.DirectionRight) }
                    val date = LocalDate(2025, 5, 13 + index * 2)
                    val bounds = day(f.scene, date).boundsInRoot
                    assertEquals(true, day(f.scene, date).config[SemanticsProperties.Focused])
                    val focused = ImageIO.read(ByteArrayInputStream(f.settle()))
                    fun added(x: Int, top: Boolean): Boolean {
                        val edge = if (top) bounds.top.toInt() else bounds.bottom.toInt()
                        val rows = if (top) (edge - 3 until edge) else (edge until edge + 3)
                        return rows.any { y -> baseline.getRGB(x, y) != focused.getRGB(x, y) }
                    }
                    val left = bounds.left.toInt() + 2
                    val right = bounds.right.toInt() - 3
                    val roundsLeft = if (rtl) name == "end" else name == "start"
                    val roundsRight = if (rtl) name == "start" else name == "end"
                    for (top in listOf(true, false)) {
                        // Straight focus strokes reach each open interior corner; an all-rounded
                        // outline leaves these pixels empty and fails this real paint check.
                        assertEquals(!roundsLeft, added(left, top), "$size rtl=$rtl $name left top=$top")
                        assertEquals(!roundsRight, added(right, top), "$size rtl=$rtl $name right top=$top")
                    }
                    val x = bounds.left.toInt() - 12
                    val y = bounds.top.toInt() - 12
                    ImageIO.write(focused.getSubimage(x, y, bounds.width.toInt() + 24, bounds.height.toInt() + 24), "png",
                        File(output, "range-focus-${size.name.lowercase()}-${if (rtl) "rtl" else "ltr"}-$name.png"))
                }
            } finally { f.scene.close() }
        }
    }
}
