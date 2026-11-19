package pics.lab.ui

import androidx.compose.ui.geometry.Rect
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import kotlin.math.abs
import kotlin.math.roundToInt

/** Full raster evidence is written before an assertion can stop the paint matrix. */
internal data class TextPixelEvidence(val inkPixels: Int, val mismatches: Int, val maximum: IntArray) {
    fun summary(): String = "$mismatches pixels, max ARGB=${maximum.joinToString("/")}"

    // Linux and macOS round coverage differently in 3–4 pixels at the outer
    // edge of Å. Keep a bounded allowance for that measured raster difference,
    // not a whole-image threshold which could hide lost or double-painted ink.
    // Wide/wide calibration must remain identical. Full pixel evidence and
    // missing-restoration/double-paint controls are retained in docs/evidence.
    fun preservesInk(calibration: Boolean): Boolean = if (calibration) mismatches == 0
        else mismatches <= 4 && maximum[0] == 0 && maximum.all { it <= 10 }
}

internal fun recordTextPixelEvidence(
    output: File,
    name: String,
    bitmap: BufferedImage,
    expectedBounds: Rect,
    actualBounds: Rect,
    width: Int,
): TextPixelEvidence {
    val height = expectedBounds.height.roundToInt()
    val expectedX = expectedBounds.left.roundToInt()
    val expectedY = expectedBounds.top.roundToInt()
    val actualX = actualBounds.left.roundToInt()
    val actualY = actualBounds.top.roundToInt()
    val expected = bitmap.getSubimage(expectedX, expectedY, width, height)
    val actual = bitmap.getSubimage(actualX, actualY, width, height)
    val difference = BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB)
    val changed = IntArray(4)
    val maximum = IntArray(4)
    val absoluteSum = LongArray(4)
    val histogram = Array(4) { IntArray(256) }
    var ink = 0
    var mismatches = 0
    val pixels = StringBuilder("x\ty\texpectedArgb\tactualArgb\tdeltaA\tdeltaR\tdeltaG\tdeltaB\n")
    for (y in 0 until height) for (x in 0 until width) {
        val a = expected.getRGB(x, y)
        val b = actual.getRGB(x, y)
        if (a and 0x00ffffff != 0x00ffffff) ink++
        val delta = IntArray(4) { channel -> ((b ushr (24 - channel * 8)) and 255) - ((a ushr (24 - channel * 8)) and 255) }
        for (channel in 0..3) {
            val amount = abs(delta[channel])
            if (amount != 0) changed[channel]++
            maximum[channel] = maxOf(maximum[channel], amount)
            absoluteSum[channel] += amount
            histogram[channel][amount]++
        }
        if (a != b) {
            mismatches++
            pixels.appendLine("$x\t$y\t${a.toUInt().toString(16)}\t${b.toUInt().toString(16)}\t${delta.joinToString("\t")}")
        }
        difference.setRGB(x, y, (255 shl 24) or
            ((abs(delta[1]) * 16).coerceAtMost(255) shl 16) or
            ((abs(delta[2]) * 16).coerceAtMost(255) shl 8) or
            (abs(delta[3]) * 16).coerceAtMost(255))
    }
    val destination = File(output, "pixels/$name").apply { mkdirs() }
    ImageIO.write(expected, "png", File(destination, "wide.png"))
    ImageIO.write(actual, "png", File(destination, "compared.png"))
    ImageIO.write(difference, "png", File(destination, "difference-x16.png"))
    File(destination, "changed-pixels.tsv").writeText(pixels.toString())
    File(destination, "summary.tsv").writeText(
        "pixels\tinkPixels\tmismatches\tmaxA\tmaxR\tmaxG\tmaxB\tchangedA\tchangedR\tchangedG\tchangedB\tmeanA\tmeanR\tmeanG\tmeanB\n" +
            "${width * height}\t$ink\t$mismatches\t${maximum.joinToString("\t")}\t${changed.joinToString("\t")}\t" +
            absoluteSum.joinToString("\t") { (it.toDouble() / (width * height)).toString() } + "\n")
    File(destination, "channel-histogram.tsv").writeText(buildString {
        appendLine("absoluteDifference\tA\tR\tG\tB")
        for (amount in 0..255) if (histogram.any { it[amount] != 0 })
            appendLine("$amount\t${histogram.joinToString("\t") { it[amount].toString() }}")
    })
    File(destination, "geometry.tsv").writeText(
        "expectedX\texpectedY\tactualX\tactualY\twidth\theight\n$expectedX\t$expectedY\t$actualX\t$actualY\t$width\t$height\n")
    File(output, "runtime.tsv").writeText(
        "os\tarchitecture\tjava\trenderApi\n${System.getProperty("os.name")}\t${System.getProperty("os.arch")}\t" +
            "${System.getProperty("java.version")}\t${System.getenv("SKIKO_RENDER_API")}\n")
    return TextPixelEvidence(ink, mismatches, maximum)
}
