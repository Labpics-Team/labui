package pics.lab.ui

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.IntSize

internal actual fun rasterizeBlurMask(size: IntSize, rectangles: List<Rect>, sigma: Float): ImageBitmap {
    val bitmap = Bitmap.createBitmap(size.width, size.height, Bitmap.Config.ALPHA_8)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        maskFilter = BlurMaskFilter(blurRadiusForSigma(sigma), BlurMaskFilter.Blur.NORMAL)
    }
    for (rect in rectangles) canvas.drawRect(rect.left, rect.top, rect.right, rect.bottom, paint)
    return bitmap.asImageBitmap()
}
