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
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.platform.LocalFontFamilyResolver
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
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 1.25f, 2f)) {
            val preferences = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val loaded = AtomicBoolean(false)
            val scene = ImageComposeScene(640, 320, Density(1f, scale)) {
                CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                    val font = labFontFamily()
                    val resolver = LocalFontFamilyResolver.current
                    LaunchedEffect(font) { resolver.preload(font); loaded.set(true) }
                    LabTheme(theme, font) {
                        LabScene(Modifier.fillMaxSize(), background = {
                            Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]))
                        }) {
                            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                                LabSnackbar("The file.png was deleted", actionLabel = "Undo", onAction = {})
                                LabSnackbar("Настройки сохранены", durationMillis = 0,
                                    actionLabel = "Отменить", onAction = {})
                            }
                        }
                    }
                }
            }
            try {
                val file = File(evidence, "snackbar-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png")
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
            } finally { scene.close() }
        }
    }
}
