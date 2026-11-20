package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import java.io.File
import kotlin.test.*

/** Real platform dialog and popup scenes, rendered without windows or audio. */
class DialogFamilyRenderTest {
    private val title = "Are you absolutely sure?"
    private val description = "This action cannot be undone. This will permanently delete your account and remove your data from our servers."
    private fun walk(n: SemanticsNode): List<SemanticsNode> = listOf(n) + n.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun named(scene: ImageComposeScene, text: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.Text)?.any { s -> s.text == text } == true &&
            it.config.getOrNull(SemanticsActions.OnClick)?.action != null
    }
    private fun settle(scene: ImageComposeScene): ByteArray {
        var last: ByteArray? = null
        var stable = 0
        repeat(120) {
            val png = scene.render(System.nanoTime()).use { it.encodeToData()!!.use { it.bytes } }
            stable = if (last?.contentEquals(png) == true) stable + 1 else 0
            if (stable >= 4) return png
            last = png
            Thread.sleep(10)
        }
        error("Dialog scene did not settle")
    }
    private fun theme(appearance: LabAppearance) = LabPreferences(appearance = appearance, reducedMotion = true).let {
        LabThemeState(initialLabColors(it), it)
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun confirmationKeepsIntentAndReturnsFocusToTheTrigger() {
        var open by mutableStateOf(false)
        var confirms = 0
        val scene = ImageComposeScene(900, 600) {
            LabTheme(theme(LabAppearance.Light)) {
                val focus = remember { FocusRequester() }
                LabScene(Modifier.fillMaxSize().background(LocalLabTheme.current.colors["bg-primary"]), background = {}) {
                    LabAlertDialogHost(open, title, description, { confirms++ }, { open = false }, focus,
                        Modifier.fillMaxSize(), material = LabMaterial.Solid,
                        confirmLabel = "Continue", cancelLabel = "Cancel") {
                        LabButton("Open", { open = true }, Modifier.focusRequester(focus))
                    }
                }
            }
        }
        try {
            settle(scene); named(scene, "Open").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertTrue(open)
            assertTrue(named(scene, "Cancel").config[SemanticsProperties.Focused])
            named(scene, "Continue").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals(1, confirms); assertTrue(open)
            scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyUp)); settle(scene)
            assertFalse(open)
            assertTrue(named(scene, "Open").config[SemanticsProperties.Focused])
        } finally { scene.close() }
    }
    @Test fun authoredConfirmationThemesMaterialsAndScaleRender() {
        val output = File("build/dialog-family-evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (material in LabMaterial.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val width = if (scale == 1f) 900 else 390
            val scene = ImageComposeScene(width, 800, Density(1f, scale)) {
                LabTheme(theme(appearance)) {
                    val focus = remember { FocusRequester() }
                    LabScene(Modifier.fillMaxSize().background(LocalLabTheme.current.colors["bg-primary"]), background = {}) {
                        LabAlertDialogHost(true, title, description, {}, {}, focus, Modifier.fillMaxSize(),
                            material = material, confirmLabel = "Continue", cancelLabel = "Cancel") {
                            LabButton("Open", {}, Modifier.focusRequester(focus))
                        }
                    }
                }
            }
            try {
                val png = settle(scene)
                output.resolve("alert-${appearance.name}-${material.name}-$scale.png").writeBytes(png)
                val cancel = named(scene, "Cancel")
                assertTrue(cancel.boundsInRoot.width > 0)
                assertTrue(cancel.boundsInRoot.height >= 48)
                if (scale == 2f) {
                    val confirm = named(scene, "Continue")
                    assertTrue(cancel.boundsInRoot.top >= confirm.boundsInRoot.bottom, "large text stacks actions without breaking their words")
                }
            } finally { scene.close() }
        }
    }
    @Test fun anchoredPositionsFlipAndRespectDirection() {
        val a = IntRect(80, 2, 120, 32)
        val ltr = PopoverPosition({ a }, LabPopoverPlacement.TopStart, 8, 16)
            .calculatePosition(a, IntSize(300, 200), LayoutDirection.Ltr, IntSize(100, 56))
        val rtl = PopoverPosition({ a }, LabPopoverPlacement.TopStart, 8, 16)
            .calculatePosition(a, IntSize(300, 200), LayoutDirection.Rtl, IntSize(100, 56))
        assertEquals(IntOffset(80, 40), ltr)
        assertEquals(IntOffset(20, 40), rtl)
    }
    @Test fun taskAndAnchoredPanelsRenderAtOrdinaryAndEnlargedText() {
        val output = File("build/dialog-family-evidence").apply { mkdirs() }
        for (popover in listOf(false, true)) for (scale in listOf(1f, 2f)) {
            val width = if (scale == 1f) 900 else 390
            val scene = ImageComposeScene(width, 800, Density(1f, scale)) {
                LabTheme(theme(LabAppearance.Light)) {
                    val focus = remember { FocusRequester() }
                    LabScene(Modifier.fillMaxSize().background(LocalLabTheme.current.colors["bg-primary"]), background = {}) {
                        if (popover) LabPopoverHost(true, "Дополнительные настройки", {}, focus,
                            Modifier.fillMaxSize(), description = "Изменения применятся к текущему виду.",
                            material = LabMaterial.Solid, closable = true,
                            content = { anchor -> Box(Modifier.fillMaxSize().padding(48.dp)) { LabButton("Open", {}, anchor) } },
                            popover = { LabButton("Выбрать", {}) })
                        else LabDialogHost(true, "Настройки пространства", {}, focus, Modifier.fillMaxSize(),
                            description = "Изменения сохранятся после подтверждения.", material = LabMaterial.Solid,
                            actions = { LabButton("Сохранить", {}, Modifier.fillMaxWidth()) },
                            content = { LabButton("Open", {}, Modifier.focusRequester(focus)) },
                            dialog = { LabText("Моё пространство") })
                    }
                }
            }
            try { output.resolve("${if (popover) "popover" else "dialog"}-$scale.png").writeBytes(settle(scene)) }
            finally { scene.close() }
        }
    }
    @OptIn(androidx.compose.ui.InternalComposeUiApi::class)
    @Test fun popoverReturnsFocusAndPreservesApplicationDraft() {
        var open by mutableStateOf(false)
        var draft by mutableStateOf("Draft")
        val scene = ImageComposeScene(900, 600) {
            LabTheme(theme(LabAppearance.Light)) {
                val focus = remember { FocusRequester() }
                LabScene(Modifier.fillMaxSize().background(LocalLabTheme.current.colors["bg-primary"]), background = {}) {
                    LabPopoverHost(open, "Edit", { open = false }, focus, Modifier.fillMaxSize(),
                        material = LabMaterial.Solid,
                        content = { anchor -> LabButton("Open", { open = true }, anchor) },
                        popover = { LabButton(draft, { draft = "Updated" }) })
                }
            }
        }
        try {
            settle(scene); named(scene, "Open").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            named(scene, "Draft").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertEquals("Updated", draft)
            scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyDown))
            scene.sendKeyEvent(KeyEvent(Key.Escape, KeyEventType.KeyUp)); settle(scene)
            assertFalse(open); assertTrue(named(scene, "Open").config[SemanticsProperties.Focused])
            named(scene, "Open").config[SemanticsActions.OnClick].action!!.invoke(); settle(scene)
            assertTrue(named(scene, "Updated").boundsInRoot.width > 0)
        } finally { scene.close() }
    }
}
