package pics.lab.ui

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import com.github.ajalt.colormath.model.HSL
import com.github.ajalt.colormath.model.HSV
import com.github.ajalt.colormath.model.LCHabColorSpaces.LCHab50
import com.github.ajalt.colormath.model.RGB
import com.github.ajalt.colormath.model.RGBColorSpace
import com.github.ajalt.colormath.model.RGBColorSpaces
import com.github.ajalt.colormath.model.XYZColorSpaces
import com.github.ajalt.colormath.transform.converterTo
import kotlin.math.round
import kotlin.math.roundToInt
import kotlin.math.abs

public enum class LabColorSpace(internal val cssName: String) { Srgb("srgb"), Hsl("hsl"), Hsv("hsv"), Lch("lch") }
public enum class LabColorModel { Hex, Hsb, Hsl, Rgb, Lch }
public enum class LabColorPickerVariant { Grid, Spectrum, Sliders }

/** Accepted color coordinates are binary64. LCH means CSS CIELCH D50, not OKLCH or D65. */
@Immutable
public class LabColorValue(public val space: LabColorSpace, coords: List<Double>, public val alpha: Double = 1.0) {
    private val coordinates = coords.toList()
    public val coords: List<Double> get() = coordinates.toList()
    init { require(coordinates.size == 3 && coordinates.all { it.isFinite() } && alpha.isFinite() && alpha in 0.0..1.0) }
    public constructor(space: LabColorSpace, first: Double, second: Double, third: Double, alpha: Double = 1.0) : this(space, listOf(first, second, third), alpha)
    internal operator fun get(index: Int): Double = coordinates[index]
    public fun copy(space: LabColorSpace = this.space, coords: List<Double> = coordinates, alpha: Double = this.alpha): LabColorValue = LabColorValue(space, coords, alpha)
    override fun equals(other: Any?): Boolean = other is LabColorValue && space == other.space && coordinates == other.coordinates && alpha == other.alpha
    override fun hashCode(): Int = (space.hashCode() * 31 + coordinates.hashCode()) * 31 + alpha.hashCode()
    override fun toString(): String = "LabColorValue(${space.cssName}, $coordinates, $alpha)"
    public companion object { public val Orange: LabColorValue = LabColorValue(LabColorSpace.Srgb, 1.0, 2.0 / 3.0, 0.0) }
}

/** Optional native form state. Reset restores the exact initial value without a value-change event. */
@Stable
public class LabColorPickerState(defaultValue: LabColorValue? = LabColorValue.Orange) {
    internal val initial = defaultValue
    public var value: LabColorValue? by mutableStateOf(defaultValue)
    internal var resetRevision: Int by mutableIntStateOf(0)
        private set
    public fun reset() { value = initial; resetRevision++ }
    public fun formValue(): String = value?.let(::serializeLabColorValue) ?: ""
    public fun isMissing(required: Boolean, enabled: Boolean = true, readOnly: Boolean = false): Boolean = required && enabled && !readOnly && value == null
}

@Composable
public fun rememberLabColorPickerState(defaultValue: LabColorValue? = LabColorValue.Orange): LabColorPickerState =
    rememberSaveable(saver = ColorPickerStateSaver) { LabColorPickerState(defaultValue) }

internal val ColorPickerStateSaver = listSaver<LabColorPickerState, Any>(
    save = { state -> buildList {
        for (color in listOf(state.initial, state.value)) {
            add(color?.space?.name ?: "")
            for (index in 0..2) add(color?.get(index) ?: 0.0)
            add(color?.alpha ?: 1.0)
        }
    } },
    restore = { saved ->
        fun color(offset: Int): LabColorValue? = (saved[offset] as String).takeIf { it.isNotEmpty() }?.let { name ->
            LabColorValue(LabColorSpace.valueOf(name), (1..3).map { saved[offset + it] as Double }, saved[offset + 4] as Double)
        }
        LabColorPickerState(color(0)).apply { value = color(5) }
    },
)

/** The structured form format retains every Double digit, including alpha and out-of-gamut channels. */
public fun serializeLabColorValue(value: LabColorValue): String =
    "{\"space\":\"${value.space.cssName}\",\"coords\":[${value.coords.joinToString(",")}],\"alpha\":${value.alpha}}"

/** Codec projection only. The colormath Float result never replaces the accepted Double value. */
internal object ColorPickerCodec {
    private class CssRgbSpace(base: RGBColorSpace, override val name: String, override val transferFunctions: RGBColorSpace.TransferFunctions) : RGBColorSpace by base {
        override fun invoke(r: Float, g: Float, b: Float, alpha: Float): RGB = RGB(r, g, b, alpha, this)
    }
    // CSS extends sRGB/P3 symmetrically below zero. Reuse the library's positive
    // transfer function; its built-in negative branch otherwise stays linear.
    private val extendedSrgbTransfer = object : RGBColorSpace.TransferFunctions {
        private val standard = RGBColorSpaces.SRGB.transferFunctions
        override fun eotf(x: Float): Float = standard.eotf(abs(x)) * if (x < 0) -1 else 1
        override fun oetf(x: Float): Float = standard.oetf(abs(x)) * if (x < 0) -1 else 1
    }
    private val cssSrgb = CssRgbSpace(RGBColorSpaces.SRGB, "Extended CSS sRGB", extendedSrgbTransfer)
    private val cssP3 = CssRgbSpace(RGBColorSpaces.DisplayP3, "Extended CSS Display P3", extendedSrgbTransfer)
    private val cssRec2020 = CssRgbSpace(RGBColorSpaces.BT2020, "CSS Rec.2020 (BT.1886)", RGBColorSpace.GammaTransferFunctions(2.4))
    private val toP3 = cssSrgb.converterTo(cssP3)
    private val toRec2020 = cssSrgb.converterTo(cssRec2020)
    // CSS Color 4 requires Bradford adaptation. colormath's default is CAT02;
    // use its documented adaptTo(matrix) API with the standard Bradford matrix.
    private val bradford = floatArrayOf(.8951f,.2664f,-.1614f,-.7502f,1.7135f,.0367f,.0389f,-.0685f,1.0296f)
    private fun standard(value: LabColorValue): com.github.ajalt.colormath.Color = when (value.space) {
        LabColorSpace.Srgb -> RGB(value[0], value[1], value[2], value.alpha)
        LabColorSpace.Hsl -> HSL(value[0], value[1] / 100, value[2] / 100, value.alpha)
        LabColorSpace.Hsv -> HSV(value[0], value[1] / 100, value[2] / 100, value.alpha)
        // colormath 3.7.1 shortcuts all L=0 Lab colors to XYZ black, losing nonzero
        // chroma. The smallest positive Float bypasses only that shortcut; the
        // added luminance underflows to zero, while its public conversion keeps a/b.
        LabColorSpace.Lch -> LCHab50(if (value[0] == 0.0 && value[1] != 0.0) Float.MIN_VALUE.toDouble() else value[0], value[1], value[2], value.alpha)
    }
    fun coords(value: LabColorValue, space: LabColorSpace): List<Double> {
        if (value.space == space) return value.coords
        val result = when (space) {
            LabColorSpace.Srgb -> rgbStandard(value).let { listOf(it.r.toDouble(), it.g.toDouble(), it.b.toDouble()) }
            LabColorSpace.Hsl -> rgbStandard(value).copy(space = RGBColorSpaces.SRGB).toHSL().let {
                // CSS canonicalizes negative HSL saturation by rotating its hue.
                // https://github.com/w3c/csswg-drafts/issues/9222
                listOf(if (it.s < 0) (it.h.toDouble() + 180) % 360 else it.h.toDouble(), abs(it.s.toDouble()) * 100, it.l.toDouble() * 100)
            }
            LabColorSpace.Hsv -> rgbStandard(value).copy(space = RGBColorSpaces.SRGB).toHSV().let { listOf(it.h.toDouble(), it.s.toDouble() * 100, it.v.toDouble() * 100) }
            LabColorSpace.Lch -> rgbStandard(value).toXYZ().adaptTo(XYZColorSpaces.XYZ50, bradford).toLCHab().let { listOf(it.l.toDouble(), it.c.toDouble(), it.h.toDouble()) }
        }
        return result.map { if (it.isNaN()) 0.0 else it }
    }
    fun rgb(value: LabColorValue, gamut: ColorPickerGamut): List<Double> {
        if (gamut == ColorPickerGamut.Srgb) return coords(value, LabColorSpace.Srgb)
        val color = (if (gamut == ColorPickerGamut.P3) toP3 else toRec2020).convert(rgbStandard(value))
        return listOf(color.r.toDouble(), color.g.toDouble(), color.b.toDouble())
    }
    /** One projection per raster sample; gamut converters cache their library matrices. */
    fun sample(value: LabColorValue, p3: Boolean, rec2020: Boolean): ColorPickerSample {
        val color = rgbStandard(value)
        fun contains(rgb: RGB): Boolean = rgb.r in 0f..1f && rgb.g in 0f..1f && rgb.b in 0f..1f
        val gamut = when {
            contains(color) -> 1
            p3 && contains(toP3.convert(color)) -> 2
            rec2020 && contains(toRec2020.convert(color)) -> 3
            else -> 0
        }
        if (gamut == 0) return ColorPickerSample(0, 0)
        fun byte(channel: Float): Int = (channel.coerceIn(0f, 1f) * 255 + .5f).toInt()
        return ColorPickerSample((255 shl 24) or (byte(color.r) shl 16) or (byte(color.g) shl 8) or byte(color.b), gamut)
    }
    private fun rgbStandard(value: LabColorValue): RGB = if (value.space == LabColorSpace.Lch)
        standard(value).toXYZ().adaptTo(XYZColorSpaces.XYZ65, bradford).toRGB(cssSrgb) else standard(value).toSRGB().copy(space = cssSrgb)
    fun inGamut(value: LabColorValue, gamut: ColorPickerGamut): Boolean = rgb(value, gamut).all { it in 0.0..1.0 }
    fun paint(value: LabColorValue): Color = coords(value, LabColorSpace.Srgb).let { rgb ->
        fun channel(index: Int) = rgb[index].let { if (it.isNaN()) 0f else it.coerceIn(0.0, 1.0).toFloat() }
        Color(channel(0), channel(1), channel(2), value.alpha.toFloat())
    }
    fun hex(value: LabColorValue, includeAlpha: Boolean = false): String {
        val bytes = coords(value, LabColorSpace.Srgb).map { (it.coerceIn(0.0, 1.0) * 255).roundToInt() }.toMutableList()
        if (includeAlpha && value.alpha != 1.0) bytes.add((value.alpha * 255).roundToInt())
        return "#" + bytes.joinToString("") { it.toString(16).padStart(2, '0') }.uppercase()
    }
}

internal data class ColorPickerSample(val argb: Int, val gamut: Int)

internal enum class ColorPickerGamut { Srgb, P3, Rec2020 }
internal fun colorModelSpace(model: LabColorModel): LabColorSpace = when (model) {
    LabColorModel.Hex, LabColorModel.Rgb -> LabColorSpace.Srgb
    LabColorModel.Hsb -> LabColorSpace.Hsv
    LabColorModel.Hsl -> LabColorSpace.Hsl
    LabColorModel.Lch -> LabColorSpace.Lch
}
internal fun colorNumber(value: Double): String {
    val scaled = value * 100
    val display = if (scaled.isFinite()) round(scaled) / 100 else value
    return if (display == 0.0) "0" else display.toString().removeSuffix(".0")
}
internal fun colorFieldText(value: LabColorValue, model: LabColorModel): String = if (model == LabColorModel.Hex) ColorPickerCodec.hex(value)
    else "lch(${ColorPickerCodec.coords(value, LabColorSpace.Lch).joinToString(" ", transform = ::colorNumber)})"
internal fun colorCopyText(value: LabColorValue, model: LabColorModel): String = when (model) {
    LabColorModel.Hex -> ColorPickerCodec.hex(value, true)
    LabColorModel.Lch -> "lch(${ColorPickerCodec.coords(value, LabColorSpace.Lch).joinToString(" ")} / ${value.alpha})"
    else -> "color(srgb ${ColorPickerCodec.coords(value, LabColorSpace.Srgb).joinToString(" ")} / ${value.alpha})"
}

/** Only the two authored text formats are parsed here; channel editing accepts ordinary finite Double text. */
internal fun parseColorField(text: String, model: LabColorModel, alpha: Double): LabColorValue? {
    val trimmed = text.trim()
    if (trimmed.length > 1024) return null
    if (model == LabColorModel.Hex) {
        val hex = trimmed.removePrefix("#")
        if (hex.length !in listOf(3, 4, 6, 8) || !hex.all { it in '0'..'9' || it.lowercaseChar() in 'a'..'f' }) return null
        val expanded = if (hex.length <= 4) hex.flatMap { listOf(it, it) }.joinToString("") else hex
        return LabColorValue(LabColorSpace.Srgb, expanded.take(6).chunked(2).map { it.toInt(16) / 255.0 },
            if (expanded.length == 8) expanded.takeLast(2).toInt(16) / 255.0 else alpha)
    }
    if (model != LabColorModel.Lch || !trimmed.startsWith("lch(", ignoreCase = true) || !trimmed.endsWith(')')) return null
    val parts = trimmed.substring(4, trimmed.length - 1).split('/').map(String::trim)
    if (parts.size !in 1..2) return null
    val coords = parts[0].split(Regex("\\s+")).map { it.toDoubleOrNull() ?: return null }
    val opacity = if (parts.size == 2) parts[1].toDoubleOrNull() ?: return null else alpha
    return if (coords.size == 3 && coords.all { it.isFinite() } && opacity.isFinite() && opacity in 0.0..1.0)
        LabColorValue(LabColorSpace.Lch, coords, opacity) else null
}

internal data class ColorPickerChannel(val label: String, val space: LabColorSpace, val index: Int, val value: Double, val max: Double, val suffix: String = "")
internal fun colorChromaMax(rec2020: Boolean): Double = (if (rec2020) LabComponents.ColorPickerLchChromaMaxRec2020 else LabComponents.ColorPickerLchChromaMax).toDouble()
internal fun colorChannels(value: LabColorValue, model: LabColorModel, variant: LabColorPickerVariant, rec2020: Boolean = false): List<ColorPickerChannel> {
    val space = if (variant == LabColorPickerVariant.Spectrum && model != LabColorModel.Lch) LabColorSpace.Hsv else colorModelSpace(model)
    val coords = ColorPickerCodec.coords(value, space)
    val labels = when (space) { LabColorSpace.Srgb -> listOf("Red", "Green", "Blue"); LabColorSpace.Lch -> listOf("Lightness", "Chroma", "Hue"); LabColorSpace.Hsl -> listOf("Hue", "Saturation", "Lightness"); LabColorSpace.Hsv -> listOf("Hue", "Saturation", "Brightness") }
    val maxima = when (space) { LabColorSpace.Srgb -> listOf(255.0,255.0,255.0); LabColorSpace.Lch -> listOf(100.0,colorChromaMax(rec2020),360.0); else -> listOf(360.0,100.0,100.0) }
    val indices = when (variant) { LabColorPickerVariant.Grid -> emptyList(); LabColorPickerVariant.Spectrum -> listOf(if (space == LabColorSpace.Lch) 2 else 0); LabColorPickerVariant.Sliders -> listOf(0,1,2) }
    return indices.map { index -> ColorPickerChannel(labels[index], space, index, coords[index] * if (space == LabColorSpace.Srgb) 255 else 1,
        maxima[index], if (space == LabColorSpace.Hsl || space == LabColorSpace.Hsv) if (index == 0) "°" else "%" else "") } + ColorPickerChannel("Opacity", value.space, 3, value.alpha * 100, 100.0, "%")
}
internal fun editColorChannel(value: LabColorValue, channel: ColorPickerChannel, number: Double): LabColorValue {
    val bounded = number.coerceIn(0.0, channel.max)
    if (channel.index == 3) return value.copy(alpha = bounded / 100)
    val coords = ColorPickerCodec.coords(value, channel.space).toMutableList()
    coords[channel.index] = bounded / if (channel.space == LabColorSpace.Srgb) 255 else 1
    return LabColorValue(channel.space, coords, value.alpha)
}
