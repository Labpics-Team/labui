package pics.lab.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asComposeCanvas
import androidx.compose.ui.text.MultiParagraph
import androidx.compose.ui.text.TextStyle
import org.jetbrains.skia.PictureRecorder
import org.jetbrains.skia.RTreeFactory
import org.jetbrains.skia.impl.use

internal actual fun textPaintBounds(paragraph: MultiParagraph, style: TextStyle): Rect? =
    PictureRecorder().use { recorder ->
        RTreeFactory().use { hierarchy ->
            // This identity-space recording is never rasterized. Skia's BBH
            // replaces its initial cull with the actual draw-command bounds.
            val canvas = recorder.beginRecording(-Float.MAX_VALUE, -Float.MAX_VALUE,
                Float.MAX_VALUE, Float.MAX_VALUE, hierarchy)
            paragraph.paintText(canvas.asComposeCanvas(), style)
            recorder.finishRecordingAsPicture().use { picture ->
                val bounds = picture.cullRect
                // Include the neighbouring local pixel around the geometric
                // bound so the clip does not cut its antialias fringe.
                Rect(bounds.left, bounds.top - 1f, bounds.right, bounds.bottom + 1f)
            }
        }
    }
