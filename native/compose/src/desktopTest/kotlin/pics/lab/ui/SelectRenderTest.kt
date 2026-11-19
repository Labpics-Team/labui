package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SelectRenderTest {
    private val items = listOf(LabSelectItem("", "Empty key"), LabSelectItem("b", "Chip label"),
        LabSelectItem("disabled", "Disabled", true), LabSelectItem("c", "Chip 2"), LabSelectItem("d", "Chip 3"))
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun named(scene: ImageComposeScene, name: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.singleOrNull() == name }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var previous: ByteArray? = null
        var equal = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            equal = if (previous?.contentEquals(png) == true) equal + 1 else 0
            if (equal >= 4) return png
            previous = png; Thread.sleep(10)
        }
        error("Select scene did not settle")
    }
    private fun theme(appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(preferences), preferences)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    private fun press(scene: ImageComposeScene, key: Key) {
        scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyDown)); scene.sendKeyEvent(KeyEvent(key, KeyEventType.KeyUp)); settle(scene)
    }
    @Test fun chipsKeepAcceptedValueAfterRefusalDelayAndResetIncludingEmptyKeys() {
        var values by mutableStateOf(listOf("", "b"))
        var accept = false
        var request = emptyList<String>()
        var currentItems by mutableStateOf(items)
        val scene = ImageComposeScene(420, 160) { LabTheme(theme()) {
            LabSelect(values, { request = it; if (accept) values = it }, currentItems, "Team", Modifier.width(400.dp), multiple = true, showLabel = false)
        } }
        try {
            settle(scene)
            named(scene, "Remove Empty key").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(listOf("b"), request); assertEquals(listOf("", "b"), values)
            assertEquals(true, named(scene, "Team").config.getOrNull(SemanticsProperties.Focused))
            values = request; settle(scene)
            assertFalse(nodes(scene).any { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Remove Empty key") == true })
            accept = true
            named(scene, "Remove Chip label").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertTrue(values.isEmpty())
            values = listOf("", "b"); settle(scene)
            currentItems = emptyList(); settle(scene)
            assertEquals(listOf("", "b"), values)
            assertTrue(nodes(scene).any { it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains("Remove b") == true })
        } finally { scene.close() }
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun popupNavigatesSkipsDisabledKeepsRefusalAndRestoresTriggerFocus() {
        for (rtl in listOf(false, true)) {
            var values by mutableStateOf(listOf("b"))
            var request = emptyList<String>()
            var accept = false
            val scene = ImageComposeScene(420, 340) { LabTheme(theme()) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    LabSelect(values, { request = it; if (accept) values = it }, items, "Team", Modifier.width(400.dp))
                }
            } }
            try {
                settle(scene); named(scene, "Team").config[SemanticsActions.RequestFocus].action!!.invoke(); settle(scene)
                press(scene, Key.DirectionDown); press(scene, Key.DirectionDown); press(scene, Key.Enter)
                assertEquals(listOf("c"), request); assertEquals(listOf("b"), values)
                assertEquals(true, named(scene, "Team").config.getOrNull(SemanticsProperties.Focused))
                accept = true; press(scene, Key.DirectionDown); press(scene, Key.MoveEnd); press(scene, Key.Enter)
                assertEquals(listOf("d"), values)
                press(scene, Key.DirectionDown); press(scene, Key.Escape)
                assertEquals(true, named(scene, "Team").config.getOrNull(SemanticsProperties.Focused))
            } finally { scene.close() }
        }
    }
    @Test fun authoredSizesAndChipsRenderAtEveryTextScaleInBothThemes() {
        val output = File("build/select-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val scene = ImageComposeScene(840, 1400, Density(2f, scale)) { LabTheme(theme(appearance)) {
                Column(Modifier.fillMaxSize().background(if (appearance == LabAppearance.Light) Color.White else Color(0xFF101012)).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    LabControlSize.entries.forEach { size ->
                        LabSelect(listOf("b"), {}, listOf(LabSelectItem("b", "Label")), "Size ${size.name}", size = size)
                    }
                    LabSelect(listOf("b", "c", "d"), {}, items, "Label", Modifier.width(384.dp), multiple = true)
                    LabSelect(emptyList(), {}, items, "No caption", Modifier.width(384.dp), multiple = true, showLabel = false, enabled = false)
                    LabSelect(listOf("long"), {}, listOf(LabSelectItem("long", "An unusually long selected option that still needs its removal action")),
                        "Long selection", Modifier.width(280.dp), multiple = true)
                }
            } }
            try {
                File(output, "native-${appearance.name.lowercase()}-$scale.png").writeBytes(settle(scene))
                if (scale == 1f) {
                    for ((size, height) in listOf(LabControlSize.Small to 32f, LabControlSize.Medium to 48f, LabControlSize.Large to 56f))
                        assertEquals(height * 2, named(scene, "Size ${size.name}").boundsInRoot.height)
                    assertEquals(56f, named(scene, "Remove Chip label").boundsInRoot.height)
                }
                assertTrue(named(scene, "Remove An unusually long selected option that still needs its removal action").boundsInRoot.width <= 560f)
                assertEquals(768f, named(scene, "Label").boundsInRoot.width)
                assertEquals(768f, named(scene, "No caption").boundsInRoot.width)
                assertTrue(named(scene, "No caption").boundsInRoot.height >= (24f * scale + 24f) * 2)
                assertEquals("Select…", named(scene, "No caption").config[SemanticsProperties.StateDescription])
                assertTrue(named(scene, "No caption").config.contains(SemanticsProperties.Disabled))
            } finally { scene.close() }
        }
    }
}
