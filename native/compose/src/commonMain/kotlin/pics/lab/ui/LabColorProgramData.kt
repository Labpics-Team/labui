package pics.lab.ui

import androidx.compose.ui.graphics.Color

/** A semantic role and its canonical Program output; aliases share the same slot. */
public data class LabColorRole(public val name: String, public val slot: Int)

/** Shared wire and interpretation of native Program outputs, including the Swift host. */
public class LabPreparedColorProgram(
    public val bytes: ByteArray,
    public val background: ByteArray,
    public val roles: List<LabColorRole>,
) {
    /** Build a complete theme from native outputRgb/outputOpacity without interpreting diagnostics. */
    @Throws(IllegalArgumentException::class)
    public fun output(outputSlots: IntArray, rgb: ByteArray, opacity: DoubleArray): LabColorOutput {
        require(rgb.size == outputSlots.size * 3 && opacity.size == outputSlots.size) {
            "Incomplete native Colors output"
        }
        require(opacity.all { it.isFinite() && it in 0.0..1.0 }) { "Invalid native Colors opacity" }
        val indices = outputSlots.withIndex().associate { it.value to it.index }
        require(indices.size == outputSlots.size) { "Duplicate native Colors output slot" }
        return LabColorOutput(roles.associate { role ->
            val index = requireNotNull(indices[role.slot]) { "Missing native Colors role: ${role.name}" }
            role.name to Color(
                (rgb[index * 3].toInt() and 255) / 255f,
                (rgb[index * 3 + 1].toInt() and 255) / 255f,
                (rgb[index * 3 + 2].toInt() and 255) / 255f,
                opacity[index].toFloat(),
            )
        })
    }
}
