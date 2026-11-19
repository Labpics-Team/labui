package pics.lab.ui.sample

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*
import pics.lab.ui.*

class SliderConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    @Test fun installedSlidersChangeTheImageSettings() {
        val state = LabThemeState(initialLabColors(LabPreferences()))
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(460, 640, Density(1f, 2f)) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(state, font) { Box(Modifier.fillMaxSize().background(state.colors["bg-primary"]).padding(20.dp)) { SliderImageExample() } }
        }
        fun settle() { repeat(20) { scene.render().close(); Thread.sleep(5) }; assertTrue(ready.get()) }
        fun nodes() = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        fun progress(name: String, value: Float) {
            val node = nodes().single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(name) == true }
            assertTrue(node.config[SemanticsActions.SetProgress].action!!.invoke(value)); settle()
        }
        try {
            settle()
            progress("Яркость", 70f); progress("Тени", 30f); progress("Света", 90f); progress("Поворот", 180f)
            assertTrue(nodes().flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }
                .any { it.text == "Яркость 70 · диапазон 30–90 · поворот 180°" })
            val output = File("build/slider-consumer").apply { mkdirs() }
            scene.render().use { image -> image.encodeToData()!!.use { File(output, "installed-font-2.png").writeBytes(it.bytes) } }
        } finally { scene.close() }
    }
}
