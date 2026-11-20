package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@OptIn(androidx.compose.ui.InternalComposeUiApi::class)
class AlertRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun settle(scene: ImageComposeScene, ready: AtomicBoolean): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (ready.get() && previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 4) return png
            previous = png; Thread.sleep(10)
        }
        error("Alert did not settle")
    }
    @Test fun allAuthoredVariantsKeepTheirAnatomyAtEveryThemeFontScaleAndMaterial() {
        val output = File("build/alert-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) for (material in LabMaterial.entries) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(510, 1800, Density(1f, scale)) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(
                        Brush.linearGradient(listOf(theme.colors["bg-primary"], theme.colors["fill-accent"])))) }) {
                        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            for (type in LabAlertType.entries) for (quantity in 1..3) {
                                LabAlert("Alert", {}, Modifier.width(450.dp).testTag("${type.name}-$quantity"),
                                    description = "Alert description that warning about something", type = type, quantity = quantity, material = material)
                            }
                        }
                    }
                }
            }
            try {
                val png = settle(scene, ready)
                val frames = nodes(scene).filter { it.config.getOrNull(SemanticsProperties.TestTag)?.contains('-') == true }
                assertEquals(6, frames.size)
                val frontHeight = frames.first().boundsInRoot.height
                for (frame in frames) {
                    val depth = frame.config[SemanticsProperties.TestTag].last().digitToInt() - 1
                    assertEquals(frontHeight, frame.boundsInRoot.height - 8 * depth, "Type and decorative depth must not squeeze the text surface")
                    assertTrue(frame.boundsInRoot.bottom <= 1776f, "Every variant must fit the capture canvas")
                    assertEquals(450f, frame.boundsInRoot.width)
                    if (scale == 1f) assertEquals(80f + 8 * (frame.config[SemanticsProperties.TestTag].last().digitToInt() - 1), frame.boundsInRoot.height)
                    val descendants = walk(frame)
                    val close = descendants.single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Закрыть уведомление") == true }
                    val text = descendants.first { it.config.getOrNull(SemanticsProperties.LiveRegion) != null }
                    assertTrue(text.boundsInRoot.right + 23.5f <= close.boundsInRoot.left ||
                        text.boundsInRoot.top >= close.boundsInRoot.bottom + 7.5f,
                        "Text and dismissal keep their space in either arrangement")
                    assertEquals(LiveRegionMode.Polite, text.config[SemanticsProperties.LiveRegion])
                    assertEquals(24f, close.boundsInRoot.width)
                }
                File(output, "native-${appearance.name.lowercase()}-${(scale * 100).toInt()}-${material.name.lowercase()}.png").writeBytes(png)
            } finally { scene.close() }
        }
    }

    @Test fun controlledDismissalKeepsContentUntilAcceptedAndKeyboardUsesTheRealButton() {
        val theme = LabThemeState(initialLabColors(LabPreferences()))
        val ready = AtomicBoolean(false)
        var open by mutableStateOf(true)
        var accepted by mutableStateOf(false)
        var showIcon by mutableStateOf(true)
        var description by mutableStateOf<String?>("Description")
        var requests = 0
        val scene = ImageComposeScene(450, 300) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) { LabScene(Modifier.fillMaxSize(), background = {}) {
                LabAlert("Saved", { requests++; if (accepted) open = false }, Modifier.width(450.dp).testTag("alert"),
                    open = open, showIcon = showIcon, description = description, announcement = LiveRegionMode.Assertive)
            } }
        }
        fun button() = nodes(scene).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Закрыть уведомление") == true }
        fun press(key: Key) { scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene, ready) }
        try {
            settle(scene, ready)
            assertTrue(nodes(scene).none { it.config.getOrNull(SemanticsProperties.Focused) == true })
            button().config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene, ready)
            press(Key.Enter); assertEquals(1, requests); assertTrue(open)
            press(Key.Escape); assertEquals(1, requests)
            showIcon = false; description = null; settle(scene, ready)
            val frame = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "alert" }
            assertEquals(56f, frame.boundsInRoot.height)
            assertTrue(nodes(scene).none { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text == "Description" } == true })
            accepted = true; press(Key.Spacebar); assertEquals(2, requests); assertTrue(!open)
            assertTrue(nodes(scene).none { it.config.contains(SemanticsActions.OnClick) })
        } finally { scene.close() }
    }

    @Test fun narrowLargeTextRetainsFullContentAndDoesNotGrowPastTheAvailableWidth() {
        val preferences = LabPreferences(reducedTransparency = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(280, 900, Density(1f, 2f)) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) { LabScene(Modifier.fillMaxSize(), background = {}) {
                LabAlert("Обновление сохранено", {}, Modifier.width(280.dp).testTag("narrow"),
                    description = "СледующаяВерсияПроектаДоступнаКоллегамВРабочемПространстве", quantity = 3, material = LabMaterial.Glass)
            } }
        }
        try {
            val png = settle(scene, ready)
            val frame = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "narrow" }
            assertEquals(280f, frame.boundsInRoot.width)
            assertTrue(frame.boundsInRoot.height > 96)
            val content = walk(frame).single { it.config.contains(SemanticsProperties.LiveRegion) }
            val close = walk(frame).single { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Закрыть уведомление") == true }
            assertEquals(248f, content.boundsInRoot.width, "Large text receives the full padded width")
            assertTrue(content.boundsInRoot.top >= close.boundsInRoot.bottom + 8f)
            for (text in walk(frame).filter { it.config.contains(SemanticsProperties.Text) }) {
                assertTrue(text.boundsInRoot.left >= frame.boundsInRoot.left)
                assertTrue(text.boundsInRoot.right <= frame.boundsInRoot.right)
                assertTrue(text.boundsInRoot.bottom <= frame.boundsInRoot.bottom)
            }
            File("build/alert-evidence").mkdirs()
            File("build/alert-evidence/native-narrow-200.png").writeBytes(png)
        } finally { scene.close() }
    }

    @Test fun unboundedParentKeepsTheSourceFrameAndFullStackWidth() {
        val preferences = LabPreferences(reducedTransparency = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(600, 160) {
            val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) { LabScene(Modifier.fillMaxSize(), background = {}) {
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    LabAlert("Alert", {}, Modifier.testTag("intrinsic"), quantity = 3,
                        description = "Alert description that warning about something")
                }
            } }
        }
        try {
            val png = settle(scene, ready)
            val frame = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "intrinsic" }
            assertEquals(450f, frame.boundsInRoot.width)
            assertEquals(96f, frame.boundsInRoot.height)
            val bitmap = javax.imageio.ImageIO.read(java.io.ByteArrayInputStream(png))
            for ((y, left, right) in listOf(Triple(84, 28, 422), Triple(92, 52, 398))) {
                assertTrue((bitmap.getRGB(left, y) ushr 24) > 0, "Stack start retains the source inset")
                assertTrue((bitmap.getRGB(right, y) ushr 24) > 0, "Stack end follows the same frame width")
            }
        } finally { scene.close() }
    }

    @Test fun stackMaterialsCaptureTheMovingSceneThroughTheirAuthoredOpacity() {
        val output = File("build/alert-evidence").apply { mkdirs() }
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        for (material in listOf(LabMaterial.Acrylic, LabMaterial.Glass)) {
            val ready = AtomicBoolean(false)
            var shift by mutableStateOf(0f)
            val scene = ImageComposeScene(450, 120) {
                val font = labFontFamily(); val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) { LabScene(Modifier.fillMaxSize(), background = {
                    Canvas(Modifier.fillMaxSize()) {
                        val palette = listOf(Color.Black, Color.White, Color(0xff0619e8), Color(0xfffe112a))
                        for (index in -2..8) drawRect(palette[index.mod(4)], Offset(index * 100f - 150f + shift, 0f), Size(100f, size.height))
                    }
                }) {
                    LabAlert("Alert", {}, Modifier.width(450.dp), description = "A moving backdrop", quantity = 3, material = material)
                } }
            }
            try {
                val first = settle(scene, ready)
                shift = 100f
                val second = settle(scene, ready)
                val before = javax.imageio.ImageIO.read(java.io.ByteArrayInputStream(first))
                val after = javax.imageio.ImageIO.read(java.io.ByteArrayInputStream(second))
                for (y in listOf(10, 84, 92)) assertTrue((80..350).any { before.getRGB(it, y) != after.getRGB(it, y) }, "Each material plane must follow the backdrop")
                File(output, "capture-native-${material.name.lowercase()}-0.png").writeBytes(first)
                File(output, "capture-native-${material.name.lowercase()}-100.png").writeBytes(second)
            } finally { scene.close() }
        }
    }
}
