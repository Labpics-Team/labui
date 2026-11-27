package pics.lab.ui.sample

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors
import pics.lab.ui.labFontFamily

class PaginationConsumerTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    @Test fun installedPaginationChangesTheVisibleRecords() {
        val theme = LabThemeState(initialLabColors(LabPreferences()))
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(480, 560, Density(1f, 2f)) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) { PaginationRecordsExample() }
        }
        fun nodes() = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
        fun settle() { repeat(20) { scene.render().close(); Thread.sleep(10) }; assertTrue(ready.get()) }
        fun records() = nodes().flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }.map { it.text }.filter { it.startsWith("Исследование ") }
        try {
            settle(); assertEquals(listOf("Исследование 1", "Исследование 2", "Исследование 3"), records())
            nodes().single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Следующая страница") == true }
                .config[SemanticsActions.OnClick].action!!.invoke()
            settle(); assertEquals(listOf("Исследование 4", "Исследование 5", "Исследование 6"), records())
        } finally { scene.close() }
    }
}
