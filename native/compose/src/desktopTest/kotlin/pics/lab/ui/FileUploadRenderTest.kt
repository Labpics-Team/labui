package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import io.github.vinceglb.filekit.PlatformFile
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.*

@OptIn(androidx.compose.ui.InternalComposeUiApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class)
class FileUploadRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
    private fun nodes(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
    private fun action(scene: ImageComposeScene, name: String) = nodes(scene).single {
        it.config.getOrNull(SemanticsProperties.ContentDescription)?.contains(name) == true &&
            it.config.getOrNull(SemanticsActions.OnClick)?.action != null
    }
    private data class Fixture(val scene: ImageComposeScene, val ready: AtomicBoolean)
    private fun fixture(width: Int = 480, height: Int = 640, scale: Float = 1f,
        appearance: LabAppearance = LabAppearance.Light, content: @Composable () -> Unit): Fixture {
        val ready = AtomicBoolean(false)
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        val theme = LabThemeState(initialLabColors(prefs), prefs)
        val scene = ImageComposeScene(width, height, Density(1f, scale)) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) {
                LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) }) {
                    Column(Modifier.fillMaxSize()) { content() }
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
        error("File Upload did not settle")
    }

    @Test fun controlledRemovalUsesRealComponentAndDoesNotInventAnAcceptedValue() {
        val file = File.createTempFile("lab-upload-render-", ".txt")
        var value by mutableStateOf(listOf(PlatformFile(file)))
        var accept = false
        var requests = 0
        val f = fixture { LabFileUpload(value, { requests++; if (accept) value = it }, "Files") }
        try {
            f.settle()
            action(f.scene, "Remove ${file.name}").config[SemanticsActions.OnClick].action!!.invoke()
            f.settle()
            assertEquals(1, value.size)
            assertEquals(1, requests)
            accept = true
            action(f.scene, "Remove ${file.name}").config[SemanticsActions.OnClick].action!!.invoke()
            f.settle()
            assertTrue(value.isEmpty())
            assertEquals(2, requests)
        } finally { f.scene.close(); file.delete() }
    }

    @Test fun compactPickerIsKeyboardReachableAndDisabledActionsStayDisabled() {
        var enabled by mutableStateOf(true)
        var opened = 0
        val f = fixture { LabFileUploadBody(emptyList(), "Files", enabled = enabled, onBrowse = { opened++ }, onRemove = {}) }
        try {
            f.settle()
            action(f.scene, "Files: No file chosen").config[SemanticsActions.RequestFocus].action!!.invoke()
            f.settle()
            f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyDown))
            f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyUp)); f.settle()
            assertEquals(1, opened)
            enabled = false; f.settle()
            assertTrue(action(f.scene, "Files: No file chosen").config.contains(SemanticsProperties.Disabled))
            f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyDown))
            f.scene.sendKeyEvent(KeyEvent(Key.Enter, KeyEventType.KeyUp)); f.settle()
            assertEquals(1, opened)
        } finally { f.scene.close() }
    }

    @Test fun selectedFilesAndRemovalStayTogetherWithoutRepeatingTheFirstFilename() {
        val output = File("build/file-upload-evidence").apply { mkdirs() }
        for (variant in LabFileUploadVariant.entries) {
            var names by mutableStateOf(listOf("First document.txt", "Second document.txt"))
            var removed = -1
            val f = fixture(width = 440, height = 620, appearance = LabAppearance.Dark) {
                LabFileUploadBody(names, "Files", variant = variant, onBrowse = {},
                    onRemove = { index -> removed = index; names = names.filterIndexed { i, _ -> i != index } })
            }
            try {
                File(output, "${variant.name.lowercase()}-multiple-dark.png").writeBytes(f.settle())
                val all = nodes(f.scene)
                val texts = all.flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }.map { it.text }
                for (name in names) assertEquals(1, texts.count { it == name }, "$variant must render $name once")
                val nameBounds = names.map { name -> all.single {
                    it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == name } == true
                }.boundsInRoot }
                assertEquals(nameBounds[0].left, nameBounds[1].left, "$variant keeps file names on one reading edge")
                val panel = all.filter { node ->
                    val descriptions = walk(node).flatMap { it.config.getOrNull(SemanticsProperties.ContentDescription).orEmpty() }
                    names.all { "Remove $it" in descriptions }
                }.minBy { walk(it).size }
                assertEquals(true, panel.config.getOrNull(SemanticsProperties.IsTraversalGroup),
                    "$variant groups the selected files and their actions")
                val groupedActions = walk(panel).mapNotNull { it.config.getOrNull(SemanticsProperties.ContentDescription) }.flatten()
                for (name in names) {
                    assertTrue("Remove $name" in groupedActions, "$variant removal belongs to the selected-file group")
                    val bounds = action(f.scene, "Remove $name").boundsInRoot
                    assertTrue(bounds.left >= panel.boundsInRoot.left && bounds.right <= panel.boundsInRoot.right)
                    assertTrue(bounds.top >= panel.boundsInRoot.top && bounds.bottom <= panel.boundsInRoot.bottom)
                }
                action(f.scene, "Remove Second document.txt").config[SemanticsActions.OnClick].action!!.invoke()
                f.settle()
                assertEquals(1, removed)
                assertEquals(listOf("First document.txt"), names)
                action(f.scene, "Remove First document.txt").config[SemanticsActions.OnClick].action!!.invoke()
                f.settle()
                assertTrue(names.isEmpty())
            } finally { f.scene.close() }
        }
    }

    @Test fun authoredAreaRendersAllStatesAndNarrowTextGrowsWithoutOverflow() {
        val output = File("build/file-upload-evidence").apply { mkdirs() }
        for (appearance in listOf(LabAppearance.Light, LabAppearance.Dark))
        for (state in listOf("default", "hover", "selected", "disabled", "drag")) {
            val f = fixture(width = 1200, height = 450, appearance = appearance) {
                LabFileUploadBody(if (state == "selected") listOf("Document.docx") else emptyList(), "Files",
                    variant = LabFileUploadVariant.Area, enabled = state != "disabled", dragging = state == "drag", onBrowse = {}, onRemove = {})
            }
            try {
                f.settle()
                if (state == "hover") f.scene.sendPointerEvent(PointerEventType.Move, Offset(600f, 190f))
                val suffix = if (appearance == LabAppearance.Dark) "-dark" else ""
                File(output, "area-$state$suffix.png").writeBytes(f.settle())
            } finally { f.scene.close() }
        }
        val f = fixture(width = 280, height = 1000, scale = 2f, appearance = LabAppearance.Dark) {
            LabFileUploadBody(listOf("A very long localized document filename with spaces.docx"), "Files",
                variant = LabFileUploadVariant.Area, error = "The file is too large. Choose a smaller file.", onBrowse = {}, onRemove = {})
        }
        try {
            File(output, "area-narrow-dark-200.png").writeBytes(f.settle())
            val text = nodes(f.scene).first { it.config.getOrNull(SemanticsProperties.Text)?.any { it.text.startsWith("A very long") } == true }
            assertTrue(text.boundsInRoot.width <= 280)
            assertTrue(text.boundsInRoot.height > 48)
            assertTrue(nodes(f.scene).any { it.config.getOrNull(SemanticsProperties.LiveRegion) == LiveRegionMode.Polite })
        } finally { f.scene.close() }
    }

    @Test fun compactSizesMatchAuthoredGeometryAndPickerOnlyPlatformsGiveAnHonestInstruction() {
        val output = File("build/file-upload-evidence").apply { mkdirs() }
        for ((size, height) in listOf(LabControlSize.Small to 40, LabControlSize.Medium to 48, LabControlSize.Large to 56)) {
            val f = fixture(width = 440, height = 100) {
                LabFileUploadBody(emptyList(), "Files", size = size, onBrowse = {}, onRemove = {})
            }
            try {
                File(output, "input-${size.name.lowercase()}.png").writeBytes(f.settle())
                assertEquals(height.toFloat(), action(f.scene, "Files: No file chosen").boundsInRoot.height)
            } finally { f.scene.close() }
        }
        val f = fixture {
            LabFileUploadBody(emptyList(), "Files", variant = LabFileUploadVariant.Area, dropSupported = false,
                onBrowse = {}, onRemove = {})
        }
        try {
            f.settle()
            val texts = nodes(f.scene).flatMap { it.config.getOrNull(SemanticsProperties.Text).orEmpty() }.map { it.text }
            assertTrue("Choose files to upload" in texts)
            assertFalse("Drag and drop files here" in texts)
        } finally { f.scene.close() }
    }
}
