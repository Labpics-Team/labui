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

public enum class LabAppearance { Light, Dark }

@Immutable
public data class LabPreferences(
    public val appearance: LabAppearance = LabAppearance.Light,
    public val increasedContrast: Boolean = false,
    public val reducedMotion: Boolean = false,
    public val reducedTransparency: Boolean = false,
)

/** A platform adapter owns Colors Programs for one theme scope. Components only receive output roles. */
public interface ColorProgramHost : AutoCloseable {
    /** Return the full output of one accepted update, independently of diagnostic feasibility. */
    @Throws(Exception::class)
    public suspend fun resolve(preferences: LabPreferences): LabColorOutput

    /** Known solid backdrops for this scope; a host must never silently ignore them. */
    @Throws(Exception::class)
    public suspend fun resolve(preferences: LabPreferences, context: LabColorContext?): LabColorOutput {
        require(context == null) { "This Colors host does not support surface contexts" }
        return resolve(preferences)
    }
}

/** An encoded, opaque sRGB color observed on the actual painted surface. */
@Immutable
public class LabSrgb8 @Throws(IllegalArgumentException::class) constructor(
    public val red: Int, public val green: Int, public val blue: Int,
) {
    init { require(red in 0..255 && green in 0..255 && blue in 0..255) { "Expected sRGB8 channels" } }
    override fun equals(other: Any?): Boolean = other is LabSrgb8 && red == other.red && green == other.green && blue == other.blue
    override fun hashCode(): Int = (red * 31 + green) * 31 + blue
    override fun toString(): String = "LabSrgb8($red, $green, $blue)"
}

/** Alternative observations of one surface, not separate layers or samples of an unknown field. */
@Immutable
public class LabColorContext @Throws(IllegalArgumentException::class) constructor(backgrounds: List<LabSrgb8>) {
    private val observations = backgrounds.toList()
    /** A caller-owned copy, including for Java and Swift consumers. */
    public val backgrounds: List<LabSrgb8> get() = observations.toList()
    init { require(observations.size in 1..64) { "Expected 1–64 known solid backgrounds" } }
    public fun encoded(): ByteArray = ByteArray(observations.size * 3) { index ->
        val color = observations[index / 3]
        when (index % 3) { 0 -> color.red; 1 -> color.green; else -> color.blue }.toByte()
    }
    override fun equals(other: Any?): Boolean = other is LabColorContext && observations == other.observations
    override fun hashCode(): Int = observations.hashCode()
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
public class LabThemeState(initialColors: LabColorOutput, initialPreferences: LabPreferences = LabPreferences(),
    initialContext: LabColorContext? = null) {
    public var colors: LabColorOutput by mutableStateOf(initialColors)
        private set
    public var preferences: LabPreferences by mutableStateOf(initialPreferences)
        private set
    public var context: LabColorContext? by mutableStateOf(initialContext)
        private set
    private var revision = 0L

    /** Report rejected updates to Swift as NSError while retaining the last accepted state. */
    @Throws(Exception::class)
    public suspend fun update(host: ColorProgramHost, next: LabPreferences, context: LabColorContext? = this.context) {
        val request = ++revision
        val output = host.resolve(next, context)
        if (request == revision) {
            colors = output
            preferences = next
            this.context = context
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
public expect fun labFontFamily(): FontFamily

internal object LabType {
    @Composable
    fun body(): TextStyle = LabTextStyles.Body.withTypography(
        color = LocalLabTheme.current.colors["label-primary"], fontFamily = LocalLabFont.current,
    )
    @Composable
    fun emphasized(): TextStyle = LabTextStyles.BodyEmphasized.withTypography(
        color = LocalLabTheme.current.colors["label-primary"], fontFamily = LocalLabFont.current,
    )
    @Composable
    fun caption(): TextStyle = LabTextStyles.CaptionXs.withTypography(
        color = LocalLabTheme.current.colors["label-primary"], fontFamily = LocalLabFont.current,
    )
    @Composable
    fun title(): TextStyle = LabTextStyles.Headline.withTypography(
        color = LocalLabTheme.current.colors["label-primary"], fontFamily = LocalLabFont.current,
    )
}
