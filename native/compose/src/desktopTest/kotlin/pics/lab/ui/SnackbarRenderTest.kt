package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.assertEquals

/** CPU raster snapshots: ImageComposeScene never creates an OS window. */
class SnackbarRenderTest {
    private fun nodes(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::nodes)

    @Test fun allTimerPosesFollowTheSourceArcDirection() {
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val owner = object : LifecycleOwner {
            override val lifecycle = LifecycleRegistry.createUnsafe(this)
                .apply { currentState = Lifecycle.State.RESUMED }
        }
        val scene = ImageComposeScene(400, 100) {
            CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                LabTheme(theme, labFontFamily()) {
                    LabScene(Modifier.fillMaxSize(), background = {
                        Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]))
                    }) {
                        LabSnackbar("The file.png was deleted", Modifier.padding(12.dp),
                            actionLabel = "Undo", onAction = {})
                    }
                }
            }
        }
        val directory = File("build/snackbar-render").apply { mkdirs() }
        try {
            for (pose in 5 downTo 1) {
                val until = System.nanoTime() + (if (pose == 5) 150L else 1000L) * 1_000_000
                do { scene.render().close(); Thread.sleep(10) } while (System.nanoTime() < until)
                scene.render().use { image ->
                    image.encodeToData()!!.use { File(directory, "snackbar-timer-$pose.png").writeBytes(it.bytes) }
                    if (pose == 1) {
                        val bitmap = org.jetbrains.skia.Bitmap.makeFromImage(image)
                        try {
                            val left = bitmap.getColor(30, 28)
                            val right = bitmap.getColor(50, 28)
                            assertTrue(((left shr 16) and 255) > ((left shr 8) and 255) + 50,
                                "The remaining danger arc must occupy the upper-left quadrant")
                            assertTrue(kotlin.math.abs(((right shr 16) and 255) - ((right shr 8) and 255)) < 10,
                                "The upper-right quadrant must be empty in the last source pose")
                        } finally { bitmap.close() }
                    }
                }
            }
        } finally { scene.close() }
    }

    @Test fun actionFocusPausesDeadlineAndReturnsToTheInitiator() {
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val owner = object : LifecycleOwner {
            override val lifecycle = LifecycleRegistry.createUnsafe(this)
                .apply { currentState = Lifecycle.State.RESUMED }
        }
        val trigger = FocusRequester()
        var open by mutableStateOf(true)
        var actions = 0
        var dismissals = 0
        val scene = ImageComposeScene(640, 200) {
            CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                LabTheme(theme) {
                    LabScene(Modifier.fillMaxSize(), background = {}) {
                        Column {
                            LabButton("Редактировать", {}, Modifier.focusRequester(trigger))
                            LabSnackbar("Сохранено", open = open, durationMillis = 500,
                                actionLabel = "Отменить", onAction = { actions++ },
                                onDismiss = { dismissals++; open = false }, restoreFocus = trigger)
                        }
                    }
                }
            }
        }
        fun pump(milliseconds: Long) {
            val until = System.nanoTime() + milliseconds * 1_000_000
            do { scene.render().close(); Thread.sleep(10) } while (System.nanoTime() < until)
        }
        fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)
        fun named(text: String) = scene.semanticsOwners.flatMap { walk(it.rootSemanticsNode) }
            .first { node -> node.config.getOrNull(SemanticsProperties.Text)?.any { it.text == text } == true }
        try {
            pump(100)
            val action = named("Отменить")
            assertTrue(action.config[SemanticsActions.RequestFocus].action!!.invoke())
            pump(700)
            assertEquals(0, dismissals, "Keyboard focus must pause the actual timeout")
            assertTrue(action.config[SemanticsActions.OnClick].action!!.invoke())
            pump(100)
            assertEquals(1, actions)
            assertEquals(1, dismissals)
            assertEquals(true, named("Редактировать").config.getOrNull(SemanticsProperties.Focused))
        } finally { scene.close() }
    }

    @Test fun hoverAndInactiveTimePauseTheActualComponentDeadline() {
        val preferences = LabPreferences(reducedMotion = true)
        val theme = LabThemeState(initialLabColors(preferences), preferences)
        val owner = object : LifecycleOwner {
            override val lifecycle = LifecycleRegistry.createUnsafe(this)
                .apply { currentState = Lifecycle.State.RESUMED }
        }
        var notification by mutableStateOf(0)
        var dismissals = 0
        val scene = ImageComposeScene(640, 200) {
            CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                LabTheme(theme) {
                    LabScene(Modifier.fillMaxSize(), background = {}) {
                        LabSnackbar("Сохранено", durationMillis = 800,
                            notificationKey = notification, onDismiss = { dismissals++ })
                    }
                }
            }
        }
        fun pump(milliseconds: Long) {
            val until = System.nanoTime() + milliseconds * 1_000_000
            do { scene.render().close(); Thread.sleep(10) } while (System.nanoTime() < until)
        }
        try {
            pump(100)
            scene.sendPointerEvent(PointerEventType.Move, Offset(10f, 20f))
            pump(1000)
            assertEquals(0, dismissals, "Pointer hover must preserve time")
            notification++
            pump(900)
            assertEquals(0, dismissals, "An identical new notification must remain paused")
            scene.sendPointerEvent(PointerEventType.Exit, Offset(-1f, -1f))
            pump(300)
            owner.lifecycle.currentState = Lifecycle.State.STARTED
            pump(900)
            assertEquals(0, dismissals, "An inactive host must preserve remaining time")
            owner.lifecycle.currentState = Lifecycle.State.RESUMED
            pump(650)
            assertEquals(1, dismissals, "Resume must expire the remaining deadline once")
        } finally { scene.close() }
    }

    @Test fun authoredSnackbarInBothThemesAndTextScales() {
        val evidence = File("build/snackbar-render").apply { mkdirs() }
        val owner = object : LifecycleOwner {
            override val lifecycle = LifecycleRegistry.createUnsafe(this)
                .apply { currentState = Lifecycle.State.STARTED }
        }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) for (width in listOf(640, 360)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val loaded = AtomicBoolean(false)
            val scene = ImageComposeScene(width, if (width == 360) 800 else 320, Density(1f, scale)) {
                CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                    val font = labFontFamily()
                    val resolver = LocalFontFamilyResolver.current
                    LaunchedEffect(font) { resolver.preload(font); loaded.set(true) }
                    LabTheme(theme, font) {
                        LabScene(Modifier.fillMaxSize(), background = {
                            Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]))
                        }) {
                            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                                LabSnackbar(if (width == 360) "Изменения сохранены" else "The file.png was deleted",
                                    actionLabel = if (width == 360) "Отменить" else "Undo", onAction = {})
                                LabSnackbar("Настройки сохранены", durationMillis = 0,
                                    actionLabel = "Отменить", onAction = {})
                            }
                        }
                    }
                }
            }
            try {
                val file = File(evidence, "snackbar-${appearance.name.lowercase()}-${(scale * 100).toInt()}${if (width == 360) "-narrow" else ""}.png")
                var previous: ByteArray? = null
                var unchanged = 0
                for (frame in 0 until 80) {
                    val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
                    unchanged = if (loaded.get() && previous?.contentEquals(bytes) == true) unchanged + 1 else 0
                    if (unchanged >= 4) { file.writeBytes(bytes); break }
                    previous = bytes
                    Thread.sleep(25)
                }
                assertTrue(unchanged >= 4, "Fonts and actual pixels must settle")
                assertTrue(file.length() > 1000, "The CPU renderer must produce actual pixels")
                if (width == 360) {
                    val message = scene.semanticsOwners.flatMap { nodes(it.rootSemanticsNode) }.first {
                        it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == "Изменения сохранены" } == true
                    }
                    val layouts = mutableListOf<TextLayoutResult>()
                    assertTrue(message.config[SemanticsActions.GetTextLayoutResult].action!!.invoke(layouts))
                    assertTrue(layouts.single().lineCount <= 2,
                        "Two short words must remain readable in at most two lines on a phone: $appearance/$scale")
                }
            } finally { scene.close() }
        }
    }
}
