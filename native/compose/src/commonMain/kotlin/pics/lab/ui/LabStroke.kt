package pics.lab.ui

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Draw outside the original outline, without changing its shape or covering the surface paint. */
internal fun Modifier.labOutsideStroke(shape: Shape, width: Dp, color: Color): Modifier {
    if (width <= 0.dp || color == Color.Unspecified) return this
    return drawWithCache {
        val outline = shape.createOutline(size, layoutDirection, this)
        val interior = Path().apply { addOutline(outline) }
        val stroke = Stroke(width.toPx() * 2)
        onDrawWithContent {
            drawContent()
            clipPath(interior, ClipOp.Difference) { drawOutline(outline, color, style = stroke) }
        }
    }
}
