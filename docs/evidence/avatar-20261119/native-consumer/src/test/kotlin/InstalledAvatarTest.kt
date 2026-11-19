import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import org.jetbrains.compose.resources.Font
import pics.lab.ui.resources.Res
import pics.lab.ui.resources.avatar_rounded_extrabold
import java.util.concurrent.atomic.AtomicBoolean
import pics.lab.ui.*
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertTrue

class InstalledAvatarTest {
    @Test fun packagedMaterialsRenderAllModesAtTwoDensities() {
        val location = LabAvatarColor::class.java.protectionDomain.codeSource.location.toString()
        assertTrue(location.endsWith(".jar") && location.contains(System.getProperty("uiVersion")), location)
        val output = File("build/evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (contrast in listOf(false, true)) for (scale in listOf(1f, 2f, 4f)) {
            val prefs = LabPreferences(appearance = appearance, increasedContrast = contrast)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val scene = ImageComposeScene((720 * scale).toInt(), (152 * scale).toInt(), Density(scale)) {
                LabTheme(theme) { Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    for (size in listOf(LabControlSize.Medium, LabControlSize.Large)) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        for (color in LabAvatarColor.entries) LabAvatar(color.name, fallback = LabAvatarFallback.Texture, size = size, color = color, status = LabAvatarStatus.Online)
                    }
                } }
            }
            try {
                repeat(15) { scene.render().close(); Thread.sleep(10) }
                val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
                File(output, "installed-${appearance.name.lowercase()}-${if (contrast) "more" else "normal"}-${(scale * 100).toInt()}.png").writeBytes(bytes)
                val image = ImageIO.read(bytes.inputStream())
                for (index in 0..9) {
                    val colors = mutableSetOf<Int>()
                    for (y in 8..23) for (x in 8..23) colors += image.getRGB(((24+index*48+x)*scale).toInt(),((24+y)*scale).toInt())
                    assertTrue(colors.size > 150, "Material must be present in installed package")
                }
            } finally { scene.close() }
        }
    }

    @Test fun authoredLettersRenderBesideCurrentTypographyAtBothTextScales() {
        val output = File("build/evidence").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val prefs = LabPreferences(appearance = appearance, reducedMotion = true)
            val theme = LabThemeState(initialLabColors(prefs), prefs)
            val loaded = AtomicBoolean(false)
            val scene = ImageComposeScene((640 * scale).toInt(), (200 * scale).toInt(), Density(1f, scale)) {
                val family = labFontFamily()
                val avatarFamily = FontFamily(Font(Res.font.avatar_rounded_extrabold, FontWeight.ExtraBold))
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(family, avatarFamily) {
                    resolver.preload(family); resolver.preload(avatarFamily); loaded.set(true)
                }
                LabTheme(theme) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        LabText("Даниил — Ångström, office, ffi")
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            for (size in LabControlSize.entries) {
                                LabAvatar("Даниил", initials = "Д", size = size, status = LabAvatarStatus.Online)
                                LabAvatar("Anna Karenina", initials = "AK", size = size, color = LabAvatarColor.Pink)
                            }
                            LabButton("Команда", onClick = {})
                        }
                    }
                }
            }
            try {
                var bytes = byteArrayOf()
                var stable = 0
                for (frame in 0..200) {
                    val next = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
                    stable = if (loaded.get() && next.contentEquals(bytes)) stable + 1 else 0
                    bytes = next
                    if (stable >= 3) break
                    Thread.sleep(10)
                }
                assertTrue(stable >= 3, "Installed fonts and text must settle before capture")
                File(output, "letters-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png").writeBytes(bytes)
                val image = ImageIO.read(bytes.inputStream())
                fun nodes(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::nodes)
                val avatars = scene.semanticsOwners.flatMap { nodes(it.rootSemanticsNode) }
                    .filter { it.config.getOrNull(SemanticsProperties.Role) == Role.Image }
                assertTrue(avatars.size == 6)
                for (avatar in avatars) {
                    val box = avatar.boundsInRoot
                    var letterPixels = 0
                    for (y in (box.top + box.height / 4).toInt() until (box.bottom - box.height / 4).toInt())
                        for (x in (box.left + box.width / 4).toInt() until (box.right - box.width / 4).toInt()) {
                            val rgb = image.getRGB(x, y)
                            if ((rgb shr 16 and 255) > 240 && (rgb shr 8 and 255) > 240 && (rgb and 255) > 240) letterPixels++
                        }
                    assertTrue(letterPixels > 2, "Avatar initials must paint inside their colored disc: $box")
                }
            } finally { scene.close() }
        }
    }
}
