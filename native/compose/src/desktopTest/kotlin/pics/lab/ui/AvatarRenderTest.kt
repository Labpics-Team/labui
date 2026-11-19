package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.sun.net.httpserver.HttpServer
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.InetSocketAddress
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AvatarRenderTest {
    private fun theme(appearance: LabAppearance = LabAppearance.Light): LabThemeState {
        val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
        return LabThemeState(initialLabColors(prefs), prefs)
    }
    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null
        var count = 0
        repeat(200) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            count = if (ready() && previous?.contentEquals(bytes) == true) count + 1 else 0
            if (count >= 3) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("Avatar scene did not settle")
    }
    private fun nodes(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::nodes)
    private fun images(scene: ImageComposeScene) = scene.semanticsOwners.flatMap { nodes(it.rootSemanticsNode) }
        .filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Image }
    private fun pixel(scene: ImageComposeScene, x: Int = 16, y: Int = 16): Int = scene.render().use { image ->
        org.jetbrains.skia.Bitmap.makeFromImage(image).use { it.getColor(x, y) }
    }

    @Test fun authoredTexturePaintsEveryPaletteModeAtNormalAndDoubleDensity() {
        val output = File("build/avatar-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (contrast in listOf(false, true)) for (density in listOf(1f, 2f)) {
            val prefs = LabPreferences(appearance = appearance, increasedContrast = contrast)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val scene = ImageComposeScene((720 * density).toInt(), (208 * density).toInt(), Density(density)) {
                LabTheme(theme) { Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    for (size in listOf(LabControlSize.Medium, LabControlSize.Large)) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        for (color in LabAvatarColor.entries) LabAvatar(color.name, fallback = LabAvatarFallback.Texture,
                            size = size, color = color, status = LabAvatarStatus.Online)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        LabAvatar("Даниил", initials = "Д", status = LabAvatarStatus.Online)
                        LabAvatar("Команда", fallback = LabAvatarFallback.Texture, status = LabAvatarStatus.Away)
                    }
                } }
            }
            try {
                val bytes = settle(scene)
                File(output, "avatar-texture-${appearance.name.lowercase()}-${if (contrast) "more" else "normal"}-${(density * 100).toInt()}.png").writeBytes(bytes)
                assertEquals(22, images(scene).size)
                val rendered = ImageIO.read(bytes.inputStream())
                for (index in 0..9) {
                    val colors = mutableSetOf<Int>()
                    for (y in 8..23) for (x in 8..23) colors += rendered.getRGB(
                        ((24 + index * 48 + x) * density).toInt(), ((24 + y) * density).toInt())
                    assertTrue(colors.size > 150, "Texture ${LabAvatarColor.entries[index]} must retain the authored material, not a flat fill")
                }
            } finally { scene.close() }
        }
    }

    @Test fun authoredLetterMastersRenderInBothThemesAndAtDoubleTextScale() {
        val output = File("build/avatar-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val theme = theme(appearance)
            val loaded = AtomicBoolean(false)
            val scene = ImageComposeScene((720 * scale).toInt(), (240 * scale).toInt(), Density(1f, scale)) {
                val font = labAvatarFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); loaded.set(true) }
                LabTheme(theme) { Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    for (size in LabControlSize.entries) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        for (color in LabAvatarColor.entries) LabAvatar("Даниил", initials = "Д", size = size, color = color, status = LabAvatarStatus.Online)
                    }
                } }
            }
            try {
                File(output, "avatar-letters-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(settle(scene) { loaded.get() })
                assertEquals(30, images(scene).size)
                for ((index, node) in images(scene).withIndex()) {
                    val diameter = listOf(24f, 32f, 48f)[index / 10] * scale
                    assertEquals(diameter, node.boundsInRoot.width, "Every authored avatar must keep its full diameter")
                    assertEquals(diameter, node.boundsInRoot.height)
                }
            } finally { scene.close() }
        }
    }

    @Test fun nameAndPresenceFormOneImageAndDecorationHasNoSemantics() {
        var decorative by mutableStateOf(false)
        val scene = ImageComposeScene(64, 64) { LabTheme(theme()) {
            LabAvatar("Даниил", initials = "Д", status = LabAvatarStatus.Online, decorative = decorative)
        } }
        try {
            settle(scene)
            val image = images(scene).single()
            assertEquals(listOf("Даниил, В сети"), image.config[SemanticsProperties.ContentDescription])
            assertEquals(null, image.config.getOrNull(SemanticsProperties.Text))
            decorative = true
            settle(scene)
            assertTrue(images(scene).isEmpty())
        } finally { scene.close() }
    }

    @Test fun initialsPreserveUnicodeGraphemesAndExplicitOverrides() {
        assertEquals("ДИ", labAvatarInitials("Даниил Иванов", null))
        assertEquals("ÉД", labAvatarInitials("Émile Дюпон", null))
        assertEquals("A\u0301Д", labAvatarInitials("A\u0301 Д", null))
        assertEquals("👩🏽‍💻Д", labAvatarInitials("👩🏽‍💻 Д", null))
        assertEquals("Д", labAvatarInitials("Иное имя", "д"))
        assertEquals("", labAvatarInitials("Даниил", ""))
    }

    @Test fun realImageRequestsKeepFallbackUntilSuccessAndCancelStaleResults() {
        fun png(color: Int): ByteArray {
            val image = BufferedImage(8, 8, BufferedImage.TYPE_INT_ARGB)
            for (y in 0..7) for (x in 0..7) image.setRGB(x, y, color)
            return ByteArrayOutputStream().also { ImageIO.write(image, "png", it) }.toByteArray()
        }
        val blue = 0xff123456.toInt()
        val red = 0xffcc2211.toInt()
        val bluePng = png(blue)
        val redPng = png(red)
        val transparentPng = png(0)
        val release = CountDownLatch(1)
        val requested = CountDownLatch(1)
        val executor = Executors.newCachedThreadPool { runnable -> Thread(runnable, "avatar-test-http").apply { isDaemon = true } }
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            this.executor = executor
            createContext("/") { exchange ->
                try {
                    val path = exchange.requestURI.path
                    if (path == "/slow") { requested.countDown(); release.await(5, TimeUnit.SECONDS) }
                    val bytes = when (path) { "/slow" -> redPng; "/transparent" -> transparentPng; else -> bluePng }
                    if (path == "/error") exchange.sendResponseHeaders(404, -1)
                    else { exchange.responseHeaders.add("Content-Type", "image/png"); exchange.sendResponseHeaders(200, bytes.size.toLong()); exchange.responseBody.write(bytes) }
                } catch (_: java.io.IOException) { /* A cancelled URL may close before the response. */ }
                finally { exchange.close() }
            }
            start()
        }
        val base = "http://127.0.0.1:${server.address.port}"
        var src by mutableStateOf<String?>(null)
        val scene = ImageComposeScene(32, 32) { LabTheme(theme()) { LabAvatar("Даниил", src = src, initials = "Д") } }
        fun waitFor(color: Int) {
            repeat(400) { if (pixel(scene) == color) return; Thread.sleep(10) }
            error("Avatar did not paint loaded image $color; current=${pixel(scene)}")
        }
        try {
            settle(scene)
            val fallback = pixel(scene)
            src = "$base/slow"
            repeat(100) { scene.render().close(); if (requested.count > 0) Thread.sleep(10) }
            assertEquals(0, requested.count, "The test must reach a real network request")
            assertEquals(fallback, pixel(scene), "Loading must preserve the fallback")
            src = "$base/blue"
            waitFor(blue)
            release.countDown()
            repeat(30) { scene.render().close(); Thread.sleep(5) }
            assertEquals(blue, pixel(scene), "The old red URL must not replace the current blue image")
            src = "$base/error"
            settle(scene)
            assertEquals(fallback, pixel(scene), "A failed new image must restore the fallback")
            src = "$base/blue"
            waitFor(blue)
            src = "$base/transparent"
            waitFor(0)
            assertEquals(listOf("Даниил"), images(scene).single().config[SemanticsProperties.ContentDescription])
        } finally { release.countDown(); scene.close(); server.stop(0); executor.shutdownNow() }
    }
}
