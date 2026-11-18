package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
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
}
