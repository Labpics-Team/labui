import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import pics.lab.ui.*
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertTrue

class InstalledAvatarTest {
    @Test fun packagedMaterialsRenderAllModesAtTwoDensities() {
        val location = LabAvatarColor::class.java.protectionDomain.codeSource.location.toString()
        assertTrue(location.endsWith(".jar") && location.contains("0.1.0-avatar-material-final-20261119"), location)
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
}
