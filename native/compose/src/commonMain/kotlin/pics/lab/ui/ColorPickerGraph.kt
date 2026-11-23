package pics.lab.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Paint
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Explicit axes avoid inferring a graph's plane from the neighbouring slider label. */
internal enum class ColorPickerPlane { SaturationBrightness, HueChroma, HueLightness, LightnessChroma }
internal data class ColorPickerAxes(val x: Double, val y: Double, val xMax: Double, val yMax: Double, val xLabel: String, val yLabel: String)
internal fun colorPlaneAxes(value: LabColorValue, plane: ColorPickerPlane, rec2020: Boolean = false): ColorPickerAxes {
    val c = ColorPickerCodec.coords(value, if (plane == ColorPickerPlane.SaturationBrightness) LabColorSpace.Hsv else LabColorSpace.Lch)
    return when (plane) {
        ColorPickerPlane.SaturationBrightness -> ColorPickerAxes(c[1], c[2], 100.0, 100.0, "Saturation", "Brightness")
        ColorPickerPlane.HueChroma -> ColorPickerAxes(c[2], c[1], 360.0, colorChromaMax(rec2020), "Hue", "Chroma")
        ColorPickerPlane.HueLightness -> ColorPickerAxes(c[2], c[0], 360.0, 100.0, "Hue", "Lightness")
        ColorPickerPlane.LightnessChroma -> ColorPickerAxes(c[0], c[1], 100.0, colorChromaMax(rec2020), "Lightness", "Chroma")
    }
}
internal fun colorPlaneValue(value: LabColorValue, plane: ColorPickerPlane, x: Double, y: Double, rec2020: Boolean = false): LabColorValue {
    val space = if (plane == ColorPickerPlane.SaturationBrightness) LabColorSpace.Hsv else LabColorSpace.Lch
    val c = ColorPickerCodec.coords(value, space).toMutableList()
    val axes = colorPlaneAxes(value, plane, rec2020)
    val a = x.coerceIn(0.0, 1.0) * axes.xMax
    val b = y.coerceIn(0.0, 1.0) * axes.yMax
    when (plane) {
        ColorPickerPlane.SaturationBrightness -> { c[1] = a; c[2] = b }
        ColorPickerPlane.HueChroma -> { c[2] = a; c[1] = b }
        ColorPickerPlane.HueLightness -> { c[2] = a; c[0] = b }
        ColorPickerPlane.LightnessChroma -> { c[0] = a; c[1] = b }
    }
    return LabColorValue(space, c, value.alpha)
}
internal data class ColorGraphKey(val plane: ColorPickerPlane, val fixed: Double, val width: Int, val height: Int, val p3: Boolean, val rec2020: Boolean)
internal fun colorGraphKey(value: LabColorValue, plane: ColorPickerPlane, width: Int, height: Int, p3: Boolean, rec2020: Boolean): ColorGraphKey {
    val c = ColorPickerCodec.coords(value, if (plane == ColorPickerPlane.SaturationBrightness) LabColorSpace.Hsv else LabColorSpace.Lch)
    val index = when (plane) { ColorPickerPlane.HueChroma, ColorPickerPlane.SaturationBrightness -> 0; ColorPickerPlane.HueLightness -> 1; ColorPickerPlane.LightnessChroma -> 2 }
    return ColorGraphKey(plane, c[index], width.coerceIn(1, 342), height.coerceIn(1, 342), p3, rec2020)
}

/** Bounded, component-local raster cache. Work is cancellable, off the UI thread, and independent of alpha/markers. */
internal class ColorGraphCache {
    private val images = linkedMapOf<ColorGraphKey, ImageBitmap>()
    private val mutex = Mutex()
    var rasterizations: Int = 0
        private set
    suspend fun image(key: ColorGraphKey): ImageBitmap = mutex.withLock {
        images.remove(key)?.let { images[key] = it; return@withLock it }
        val image = raster(key)
        currentCoroutineContext().ensureActive()
        images[key] = image
        rasterizations++
        while (images.size > 9) images.remove(images.keys.first())
        image
    }
    private suspend fun raster(key: ColorGraphKey): ImageBitmap {
        val image = ImageBitmap(key.width, key.height)
        val canvas = Canvas(image)
        val paint = Paint()
        val colors = IntArray(key.width * key.height)
        val membership = IntArray(colors.size)
        for (y in 0 until key.height) {
            currentCoroutineContext().ensureActive()
            for (x in 0 until key.width) {
                val a = x.toDouble() / (key.width - 1).coerceAtLeast(1)
                val b = 1 - y.toDouble() / (key.height - 1).coerceAtLeast(1)
                val color = when (key.plane) {
                    ColorPickerPlane.HueChroma -> LabColorValue(LabColorSpace.Lch, key.fixed, b * colorChromaMax(key.rec2020), a * 360)
                    ColorPickerPlane.HueLightness -> LabColorValue(LabColorSpace.Lch, b * 100, key.fixed, a * 360)
                    ColorPickerPlane.LightnessChroma -> LabColorValue(LabColorSpace.Lch, a * 100, b * colorChromaMax(key.rec2020), key.fixed)
                    ColorPickerPlane.SaturationBrightness -> LabColorValue(LabColorSpace.Hsv, key.fixed, a * 100, b * 100)
                }
                val sample = ColorPickerCodec.sample(color, key.p3, key.rec2020)
                val index = y * key.width + x
                membership[index] = sample.gamut
                colors[index] = sample.argb
            }
        }
        for (y in 0 until key.height) {
            currentCoroutineContext().ensureActive()
            for (x in 0 until key.width) {
                val index = y * key.width + x
                if (membership[index] == 0) continue
                val border = (key.p3 || key.rec2020) && ((x > 0 && membership[index - 1] != membership[index]) || (y > 0 && membership[index - key.width] != membership[index]))
                paint.color = if (border) Color(0xFF777777) else Color(colors[index])
                canvas.drawRect(Rect(x.toFloat(), y.toFloat(), x + 1f, y + 1f), paint)
            }
        }
        return image
    }
}
