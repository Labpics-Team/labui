package pics.lab.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.unit.IntSize

/** Rasterize independent Gaussian rectangle masks once; consumers reuse the resulting alpha image. */
internal expect fun rasterizeBlurMask(size: IntSize, rectangles: List<Rect>, sigma: Float): ImageBitmap

// Compose/Android convert their radius to Skia sigma as 0.57735 * radius + 0.5.
internal fun blurRadiusForSigma(sigma: Float): Float = ((sigma - 0.5f) / 0.57735f).coerceAtLeast(0f)
