package pics.lab.ui.sample

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
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabBreadcrumb
import pics.lab.ui.LabBreadcrumbItem
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors
import pics.lab.ui.labFontFamily

class BreadcrumbConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean) {
        var previous: ByteArray? = null
        var equal = 0
        repeat(100) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (ready.get() && previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 4) return
            previous = png
            Thread.sleep(10)
        }
        error("Installed Breadcrumb did not settle")
    }

    @Test fun installedNavigationChangesTheApplicationRoute() {
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) for (direction in LayoutDirection.entries) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val ready = AtomicBoolean(false)
            var route by mutableStateOf(4)
            val labels = listOf("Home", "Team", "Projects", "Services", "Design")
            val scene = ImageComposeScene(320, 600, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    CompositionLocalProvider(LocalLayoutDirection provides direction) {
                        Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp)) {
                            LabBreadcrumb(labels.take(route + 1).mapIndexed { index, label -> LabBreadcrumbItem(label) { route = index } })
                            BasicText("Раздел: ${labels[route]}")
                        }
                    }
                }
            }
            try {
                settle(scene, ready)
                val expand = nodes(scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Показать все разделы") == true }
                assertTrue(expand.config[SemanticsActions.OnClick].action!!.invoke())
                settle(scene, ready)
                val ancestors = nodes(scene).filter { it.config.contains(SemanticsActions.OnClick) }
                assertEquals(4, ancestors.size)
                val firstRevealed = ancestors.single { it.config.getOrNull(SemanticsProperties.Text)?.firstOrNull()?.text == "Team" }
                assertEquals(true, firstRevealed.config.getOrNull(SemanticsProperties.Focused))
                val current = nodes(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }
                assertFalse(current.config.contains(SemanticsActions.OnClick))
                for (item in ancestors) {
                    assertTrue(item.boundsInRoot.left >= 0)
                    assertTrue(item.boundsInRoot.right <= 320)
                }
                firstRevealed.config[SemanticsActions.OnClick].action!!.invoke()
                settle(scene, ready)
                assertEquals(1, route)
                assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == "Раздел: Team" } == true })
                assertEquals("Team", nodes(scene).single { it.config.getOrNull(SemanticsProperties.Selected) == true }.config[SemanticsProperties.Text].single().text)
            } finally { scene.close() }
        }
    }
}
