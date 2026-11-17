package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.jetbrains.compose.resources.Font
import pics.lab.ui.resources.Res
import pics.lab.ui.resources.geist_regular
import pics.lab.ui.resources.geist_medium
import pics.lab.ui.resources.geist_semibold

public enum class LabAppearance { Light, Dark }

@Immutable
public data class LabPreferences(
    public val appearance: LabAppearance = LabAppearance.Light,
    public val increasedContrast: Boolean = false,
    public val reducedMotion: Boolean = false,
    public val reducedTransparency: Boolean = false,
)

/** A platform adapter owns one Colors Program. Components only receive resolved output roles. */
public interface ColorProgramHost : AutoCloseable {
    /** Return the full output of one accepted update, independently of diagnostic feasibility. */
    public suspend fun resolve(preferences: LabPreferences): LabColorOutput
}

@Immutable
public class LabColorOutput(colors: Map<String, Color>) {
    private val roles = colors.toMap()
    init {
        require(roles.isNotEmpty()) { "Colors Program returned no output roles" }
        require(roles.values.all { it != Color.Unspecified }) { "Colors Program returned an unspecified color" }
    }
    public operator fun get(role: String): Color = requireNotNull(roles[role]) { "Missing Colors output role: $role" }
}

/** Failed or superseded updates retain the last complete, usable theme. */
@Stable
public class LabThemeState(initialColors: LabColorOutput, initialPreferences: LabPreferences = LabPreferences()) {
    public var colors: LabColorOutput by mutableStateOf(initialColors)
        private set
    public var preferences: LabPreferences by mutableStateOf(initialPreferences)
        private set
    private var revision = 0L

    public suspend fun update(host: ColorProgramHost, next: LabPreferences) {
        val request = ++revision
        val output = host.resolve(next)
        if (request == revision) {
            colors = output
            preferences = next
        }
    }
}

internal val LocalLabTheme = staticCompositionLocalOf<LabThemeState> { error("Wrap content in LabTheme") }
internal val LocalLabFont = staticCompositionLocalOf<FontFamily> { FontFamily.Default }

@Composable
public fun LabTheme(state: LabThemeState, fontFamily: FontFamily = labFontFamily(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLabTheme provides state, LocalLabFont provides fontFamily, content = content)
}

@Composable
public fun labFontFamily(): FontFamily = FontFamily(
    Font(Res.font.geist_regular, FontWeight.Normal),
    Font(Res.font.geist_medium, FontWeight.Medium),
    Font(Res.font.geist_semibold, FontWeight.SemiBold),
)

internal object LabType {
    @Composable
    fun body(): TextStyle = TextStyle(
        color = LocalLabTheme.current.colors["label-primary"], fontFamily = LocalLabFont.current,
        fontSize = LabTokens.FontSizeMd.sp, lineHeight = (LabTokens.FontSizeMd * LabTokens.LineHeightMd).sp,
        letterSpacing = (LabTokens.FontSizeMd * LabTokens.LetterSpacingMd).sp,
    )
    @Composable
    fun caption(): TextStyle = body().copy(
        fontSize = LabTokens.FontSizeXs.sp,
        lineHeight = (LabTokens.FontSizeXs * LabTokens.LineHeightMd).sp,
        letterSpacing = (LabTokens.FontSizeXs * LabTokens.LetterSpacingXs).sp,
    )
    @Composable
    fun title(): TextStyle = body().copy(fontSize = LabTokens.FontSizeXl.sp,
        lineHeight = (LabTokens.FontSizeXl * 1.2f).sp, fontWeight = FontWeight.SemiBold)
}
