package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BreadcrumbRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val bytes = scene.render().use { it.encodeToData()!!.use { data -> data.bytes } }
            equal = if (ready.get() && previous?.contentEquals(bytes) == true) equal + 1 else 0
            if (equal >= 4) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("Breadcrumb scene did not settle")
    }

    @Test fun disclosureKeepsEveryAncestorAndFocusInBothDirections() {
        val output = File("build/breadcrumb-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f))
            for (direction in LayoutDirection.entries) {
                val theme = LabThemeState(initialLabColors(LabPreferences(appearance = appearance)))
                val ready = AtomicBoolean(false)
                val visits = mutableListOf<String>()
                val labels = listOf("Home", "Team", "Projects", "Services", "Design")
                val items = labels.map { name -> LabBreadcrumbItem(name) { visits += name } }
                val scene = ImageComposeScene(640, 300, Density(1f, scale)) {
                    val font = labFontFamily()
                    val resolver = LocalFontFamilyResolver.current
                    LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                    LabTheme(theme, font) {
                        CompositionLocalProvider(LocalLayoutDirection provides direction) {
                            Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp)) {
                                LabBreadcrumb(items, Modifier.testTag("trail"))
                            }
                        }
                    }
                }
                try {
                    val stem = "${appearance.name.lowercase()}-${(scale * 100).toInt()}-${direction.name.lowercase()}"
                    File(output, "$stem.png").writeBytes(settle(scene, ready))
                    val before = nodes(scene)
                    assertEquals(listOf("Home", "Services", "Design"), before.flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }.map { it.text })
                    val disclosure = before.single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Показать все разделы") == true }
                    assertTrue(disclosure.config[SemanticsActions.OnClick].action!!.invoke())
                    File(output, "$stem-expanded.png").writeBytes(settle(scene, ready))
                    val after = nodes(scene)
                    assertEquals(labels, after.flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }.map { it.text })
                    val team = after.single { it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == "Team" } == true }
                    assertTrue(team.config.getOrNull(SemanticsProperties.Focused) == true)
                    team.config[SemanticsActions.OnClick].action!!.invoke()
                    assertEquals(listOf("Team"), visits)
                    val current = after.single { it.config.getOrNull(SemanticsProperties.Selected) == true }
                    assertFalse(current.config.contains(SemanticsActions.OnClick))
                } finally { scene.close() }
            }
    }

    @Test fun narrowTrailKeepsCompleteMultilineLabelsAtDoubleScale() {
        File("build/breadcrumb-render").mkdirs()
        val theme = LabThemeState(initialLabColors(LabPreferences()))
        val ready = AtomicBoolean(false)
        val labels = listOf("Все рабочие пространства", "Оченьдлинноеназваниепроектабезпробелов", "Исследования и проектирование интерфейсов")
        val scene = ImageComposeScene(320, 800, Density(1f, 2f)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) {
                Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp)) {
                    LabBreadcrumb(labels.map { LabBreadcrumbItem(it) }, maxItems = 0)
                }
            }
        }
        try {
            File("build/breadcrumb-render/narrow-200.png").writeBytes(settle(scene, ready))
            val layouts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }.flatMap { node ->
                mutableListOf<TextLayoutResult>().also { node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it) }
            }
            assertEquals(labels, layouts.map { it.layoutInput.text.text })
            for (layout in layouts) {
                assertFalse(layout.didOverflowHeight)
                assertFalse(layout.isLineEllipsized(layout.lineCount - 1))
                assertTrue(layout.lineCount > 1)
                for (line in 1 until layout.lineCount) assertTrue(layout.getLineBaseline(line) - layout.getLineBaseline(line - 1) >= 39f)
            }
        } finally { scene.close() }
    }
}
