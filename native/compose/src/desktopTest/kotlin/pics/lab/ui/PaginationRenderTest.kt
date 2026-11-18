package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.io.ByteArrayInputStream
import javax.imageio.ImageIO
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PaginationRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val bytes = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
            equal = if (ready.get() && previous?.contentEquals(bytes) == true) equal + 1 else 0
            if (equal >= 4) return bytes
            previous = bytes; Thread.sleep(10)
        }
        error("Pagination scene did not settle")
    }
    @Test fun rangeAllocationStaysBoundedAndPreservesEndpoints() {
        for (total in listOf(0, 1, 2, 7, 8, 20, Int.MAX_VALUE)) {
            for (page in listOf(1, total / 2, total).map { it.coerceAtLeast(1) }) for (siblings in 0..4) {
                val range = paginationPages(page, total, siblings, false)
                assertTrue(range.size <= siblings * 2 + 5)
                if (total > 0) { assertEquals(1, range.first()); assertEquals(total, range.last()); assertTrue(range.contains(page)) }
                val compact = paginationPages(page, total, siblings, true)
                assertTrue(compact.size <= 5)
                if (total > 0) assertTrue(compact.contains(page))
            }
        }
    }
    @Test fun authoredFramesAndRequestsReachTheDataWithoutChangingRejectedSelection() {
        val output = File("build/pagination-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) for (direction in LayoutDirection.entries) {
            val ready = AtomicBoolean(false)
            val theme = LabThemeState(initialLabColors(LabPreferences(appearance = appearance)))
            var page by mutableStateOf(3)
            var accept by mutableStateOf(false)
            var total by mutableStateOf(200)
            val requests = mutableListOf<Int>()
            val scene = ImageComposeScene(760, 440, Density(1f, scale)) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    CompositionLocalProvider(LocalLayoutDirection provides direction) {
                        Column(Modifier.fillMaxSize().background(theme.colors["bg-grouped-primary"]).padding(24.dp)) {
                            BasicText("Records ${(page - 1) * 10 + 1}–${page * 10}", style = LabType.body())
                            LabPagination(page, { requests += it; if (accept) page = it }, total)
                            LabPagination(page, { page = it }, 60, variant = LabPaginationVariant.Compact, progress = .6f)
                        }
                    }
                }
            }
            try {
                val stem = "${appearance.name.lowercase()}-${(scale * 100).toInt()}-${direction.name.lowercase()}"
                File(output, "$stem.png").writeBytes(settle(scene, ready))
                fun next() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Next page") == true }
                next().config[SemanticsActions.OnClick].action!!.invoke(); settle(scene, ready)
                assertEquals(listOf(4), requests); assertEquals(3, page)
                accept = true; settle(scene, ready)
                next().config[SemanticsActions.OnClick].action!!.invoke(); settle(scene, ready)
                assertEquals(4, page)
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == "Records 31–40" } == true })
                total = 10; settle(scene, ready)
                assertTrue(next().config.contains(SemanticsProperties.Disabled))
                total = 0; settle(scene, ready)
                assertTrue(next().config.contains(SemanticsProperties.Disabled))
            } finally { scene.close() }
        }
    }

    @Test fun compactAndAmbientUseTheAuthoredDotAndTrackWidths() {
        val output = File("build/pagination-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val ready = AtomicBoolean(false)
            val theme = LabThemeState(initialLabColors(LabPreferences(appearance = appearance)))
            val scene = ImageComposeScene(360, 240, Density(1f, scale)) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    LabScene(Modifier.fillMaxSize(), background = {
                        Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(theme.colors["bg-grouped-primary"], theme.colors["fill-brand-tertiary"])) ))
                    }) {
                        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            LabPagination(1, {}, 2, pageSize = 1, variant = LabPaginationVariant.Compact, label = "Dots")
                            LabPagination(1, {}, 2, pageSize = 1, variant = LabPaginationVariant.Compact, ambient = true, label = "Ambient")
                            LabPagination(1, {}, 2, pageSize = 1, variant = LabPaginationVariant.Compact, ambient = true, progress = .6f, label = "Media")
                        }
                    }
                }
            }
            try {
                File(output, "compact-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(settle(scene, ready))
                for ((name, width) in listOf("Dots" to 40, "Ambient" to 40, "Media" to 52)) {
                    val node = nodes(scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(name) == true }
                    assertEquals(width * scale, node.boundsInRoot.width)
                    assertEquals(24 * scale, node.boundsInRoot.height)
                }
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun compactKeyboardKeepsOneTabStopAndCannotOverflowPageBounds() {
        for (direction in LayoutDirection.entries) {
            val ready = AtomicBoolean(false)
            val theme = LabThemeState(initialLabColors(LabPreferences()))
            var page by mutableStateOf(3)
            var accept by mutableStateOf(false)
            val requests = mutableListOf<Int>()
            val scene = ImageComposeScene(360, 160) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    CompositionLocalProvider(LocalLayoutDirection provides direction) {
                        Column {
                            LabPagination(page, { requests += it; if (accept) page = it }, Int.MAX_VALUE,
                                pageSize = 1, variant = LabPaginationVariant.Compact)
                            LabButton("Outside", {})
                        }
                    }
                }
            }
            fun current() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }
            fun press(key: Key) {
                scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
                scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp))
                settle(scene, ready)
            }
            try {
                settle(scene, ready)
                current().config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene, ready)
                val forward = if (direction == LayoutDirection.Rtl) Key.DirectionLeft else Key.DirectionRight
                press(forward)
                assertEquals(listOf(4), requests); assertEquals(3, page)
                assertTrue(current().config.getOrNull(SemanticsProperties.Focused) == true)
                accept = true; settle(scene, ready)
                press(Key.MoveEnd); assertEquals(Int.MAX_VALUE, page)
                press(forward); assertEquals(Int.MAX_VALUE, page)
                assertEquals(listOf(4, Int.MAX_VALUE), requests)
                press(Key.MoveHome); assertEquals(1, page)
                press(if (direction == LayoutDirection.Rtl) Key.DirectionRight else Key.DirectionLeft)
                assertEquals(1, page)
                press(Key.Tab)
                assertTrue(nodes(scene).single { it.config.getOrNull(SemanticsProperties.Focused) == true }
                    .config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Outside" } == true,
                    "Tab must leave Compact instead of visiting inactive dots")
            } finally { scene.close() }
        }
    }

    @Test fun chevronsUseTheAuthoredHoverRoleAndKeepDisabledColor() {
        for (appearance in LabAppearance.entries) {
            val ready = AtomicBoolean(false)
            val theme = LabThemeState(initialLabColors(LabPreferences(appearance = appearance)))
            var disabled by mutableStateOf(false)
            val scene = ImageComposeScene(2000, 300, Density(3f, 1f)) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Box(Modifier.fillMaxSize().background(theme.colors["bg-grouped-primary"])) {
                        LabPagination(3, {}, 200, disabled = disabled)
                    }
                }
            }
            fun control(label: String) = nodes(scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(label) == true }
            fun assertGlyph(label: String, role: String, hover: Boolean) {
                val image = ImageIO.read(ByteArrayInputStream(settle(scene, ready)))
                val center = control(label).boundsInRoot.center
                val background = if (hover && !disabled) theme.colors[LabComponents.PaginationRolesHover].compositeOver(theme.colors["bg-grouped-primary"])
                    else theme.colors["bg-grouped-primary"]
                val expected = theme.colors[role].compositeOver(background).toArgb()
                val pixels = (-24..23).sumOf { y -> (-24..23).count { x ->
                    val actual = image.getRGB(center.x.toInt() + x, center.y.toInt() + y)
                    // Skia's 8-bit alpha compositing can round a channel by one level.
                    listOf(0, 8, 16, 24).all { shift -> kotlin.math.abs((actual ushr shift and 255) - (expected ushr shift and 255)) <= 1 }
                } }
                assertTrue(pixels > 0, "$appearance $label must paint $role (hover=$hover, disabled=$disabled)")
                if (label == "Previous page") {
                    val rect = control(label).boundsInRoot
                    val output = File("build/pagination-render").apply { mkdirs() }
                    ImageIO.write(image.getSubimage(rect.left.toInt(), rect.top.toInt(), rect.width.toInt(), rect.height.toInt()),
                        "png", File(output, "chevron-${appearance.name.lowercase()}-${if (hover) "hover" else "default"}.png"))
                }
            }
            try {
                settle(scene, ready)
                for (label in listOf("Previous page", "Next page")) {
                    assertGlyph(label, LabComponents.PaginationRolesChevron, false)
                    scene.sendPointerEvent(PointerEventType.Move, control(label).boundsInRoot.center)
                    assertGlyph(label, LabComponents.PaginationRolesLabel, true)
                    scene.sendPointerEvent(PointerEventType.Move, Offset(1999f, 299f))
                    assertGlyph(label, LabComponents.PaginationRolesChevron, false)
                }
                disabled = true; settle(scene, ready)
                scene.sendPointerEvent(PointerEventType.Move, control("Next page").boundsInRoot.center)
                assertGlyph("Next page", LabComponents.PaginationRolesDisabled, true)
            } finally { scene.close() }
        }
    }

    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun delayedCompactAcceptancePreservesFocusOnlyWhileTheUserRemainsInside() {
        val ready = AtomicBoolean(false)
        val theme = LabThemeState(initialLabColors(LabPreferences()))
        var page by mutableStateOf(3)
        var requested = 3
        var progress by mutableStateOf(.6f)
        val scene = ImageComposeScene(360, 160) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) { Column {
                LabPagination(page, { requested = it }, 20, pageSize = 1,
                    variant = LabPaginationVariant.Compact, progress = progress)
                LabButton("Outside", { progress += .1f })
            } }
        }
        fun current() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }
        fun outside() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == "Outside" } == true }
        fun press(key: Key) {
            scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp))
            settle(scene, ready)
        }
        try {
            settle(scene, ready)
            current().config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene, ready)
            press(Key.MoveEnd); assertEquals(20, requested); assertEquals(3, page)
            page = requested; settle(scene, ready)
            assertTrue(current().config.getOrNull(SemanticsProperties.Focused) == true)
            press(Key.DirectionLeft); assertEquals(19, requested)
            page = requested; settle(scene, ready)
            assertTrue(current().config.getOrNull(SemanticsProperties.Focused) == true)
            press(Key.MoveHome); assertEquals(1, requested)
            press(Key.Tab); assertTrue(outside().config.getOrNull(SemanticsProperties.Focused) == true)
            page = requested; settle(scene, ready)
            assertTrue(outside().config.getOrNull(SemanticsProperties.Focused) == true)
            progress += .1f; settle(scene, ready)
            assertTrue(outside().config.getOrNull(SemanticsProperties.Focused) == true)
        } finally { scene.close() }
    }
}
