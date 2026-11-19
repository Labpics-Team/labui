package pics.lab.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import androidx.compose.ui.unit.IntSize
import org.jetbrains.skia.Color
import org.jetbrains.skia.ColorAlphaType
import org.jetbrains.skia.ColorType
import org.jetbrains.skia.FilterTileMode
import org.jetbrains.skia.ImageFilter
import org.jetbrains.skia.ImageInfo
import org.jetbrains.skia.Paint
import org.jetbrains.skia.Surface

internal actual fun rasterizeBlurMask(size: IntSize, rectangles: List<Rect>, sigma: Float): ImageBitmap {
    val surface = Surface.makeRaster(ImageInfo(size.width, size.height, ColorType.ALPHA_8, ColorAlphaType.PREMUL))
    try {
        val blur = ImageFilter.makeBlur(sigma, sigma, FilterTileMode.DECAL)
        try {
            val paint = Paint()
            try {
                paint.color = Color.WHITE
                paint.imageFilter = blur
                for (rect in rectangles) surface.canvas.drawRect(org.jetbrains.skia.Rect(rect.left, rect.top, rect.right, rect.bottom), paint)
            } finally { paint.close() }
        } finally { blur.close() }
        val image = surface.makeImageSnapshot()
        return try { image.toComposeImageBitmap() } finally { image.close() }
    } finally { surface.close() }
}
