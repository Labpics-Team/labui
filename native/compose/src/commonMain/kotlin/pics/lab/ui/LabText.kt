package pics.lab.ui

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.MultiParagraph
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.isSpecified
import kotlin.math.max
import kotlin.math.ceil
import kotlin.math.roundToInt

@Composable
internal fun usesAuthoredTextMetrics(fontFamily: FontFamily?): Boolean = fontFamily == labFontFamily()

internal fun Density.authoredLineHeight(style: TextStyle): Float =
    if (style.lineHeight.isEm) style.fontSize.toPx() * style.lineHeight.value else style.lineHeight.toPx()

/** A system fallback run may exceed the bundled face's unpadded em metrics. */
internal fun Density.hasTallerTextMetrics(style: TextStyle, lines: Int, paragraphHeight: Int): Boolean {
    val lineHeight = authoredLineHeight(style)
    val naturalOuterSpace = if (style.fontSize.isSp) (style.fontSize.toPx() - lineHeight).coerceAtLeast(0f) else 0f
    return paragraphHeight > (lineHeight * lines + naturalOuterSpace).roundToInt() + 1
}

internal expect fun textPaintBounds(paragraph: MultiParagraph, style: TextStyle): Rect?

internal fun MultiParagraph.paintText(canvas: Canvas, style: TextStyle) {
    val shadow = style.shadow ?: Shadow.None
    val decoration = style.textDecoration ?: TextDecoration.None
    val drawStyle = style.drawStyle ?: Fill
    val brush = style.brush
    if (brush != null) paint(canvas, brush, style.alpha, shadow, decoration, drawStyle)
    else paint(canvas, if (style.color == Color.Unspecified) Color.Black else style.color,
        shadow, decoration, drawStyle)
}

private class TextPaintBoundsCache {
    private var paragraph: MultiParagraph? = null
    private var style: TextStyle? = null
    private var bounds: Rect? = null

    fun get(paragraph: MultiParagraph, style: TextStyle): Rect? {
        if (this.paragraph !== paragraph || this.style != style) {
            bounds = textPaintBounds(paragraph, style)
            this.paragraph = paragraph
            this.style = style
        }
        return bounds
    }
}

/**
 * Text with the authored line height, including tight labels whose ink can extend outside it.
 * Selection and accessibility are provided by Compose's BasicText. The layout callback returns
 * the underlying paragraph metrics; its firstBaseline is not a cross-platform paint baseline.
 * The bundled family uses exact authored line boxes. Custom font families retain the native
 * paragraph layout, so a taller fallback font cannot overflow a falsely shortened layout box.
 */
@Composable
public fun LabText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LabType.body(),
    onTextLayout: ((TextLayoutResult) -> Unit)? = null,
    overflow: TextOverflow = TextOverflow.Visible,
    softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE,
    minLines: Int = 1,
) {
    val measured = remember { arrayOfNulls<TextLayoutResult>(1) }
    val authoredFamily = usesAuthoredTextMetrics(style.fontFamily)
    val authored = if (authoredFamily && style.lineHeight.isSpecified && (!style.lineHeight.isEm || style.fontSize.isSp)) Modifier.layout { child, constraints ->
        val lineHeight = authoredLineHeight(style)
        val outerSpace = if (style.fontSize.isSp) ceil((style.fontSize.toPx() - lineHeight).coerceAtLeast(0f)).toInt() else 0
        // Give tight glyphs their natural outer space, while retaining the caller's
        // height limit for vertical ellipsis and text hit testing.
        val paragraphMaxHeight = if (constraints.maxHeight == Constraints.Infinity) Constraints.Infinity
            else (constraints.maxHeight.toLong() + outerSpace).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        // Retain minHeight as well: discarding it recenters a short retained
        // paragraph inside the caller's height and changes minLines placement.
        val paragraph = child.measure(constraints.copy(maxHeight = paragraphMaxHeight))
        val lines = max(minLines, measured[0]?.lineCount ?: 1)
        val authoredHeight = (lineHeight * lines).roundToInt()
        // A fallback glyph can bring taller metrics even inside the bundled family.
        // Keep that native paragraph intact instead of shortening it around overflowing text.
        val hasTallerFallback = hasTallerTextMetrics(style, lines, paragraph.height)
        val height = constraints.constrainHeight(if (hasTallerFallback) paragraph.height else authoredHeight)
        layout(paragraph.width, height) {
            paragraph.placeRelative(0, (height - paragraph.height) / 2)
        }
    } else Modifier
    val resolvedStyle = if (authoredFamily && style.lineHeightStyle == null) style.copy(lineHeightStyle = LabLineHeightStyle) else style
    val isEllipsis = overflow == TextOverflow.Ellipsis || overflow == TextOverflow.StartEllipsis || overflow == TextOverflow.MiddleEllipsis
    val callerHeightClip = if (authoredFamily && overflow != TextOverflow.Visible) Modifier.drawWithContent {
        val result = measured[0]
        if (result != null && result.multiParagraph.height > result.size.height) clipRect { this@drawWithContent.drawContent() }
        else drawContent()
    } else Modifier
    val completeInk = if (authoredFamily && isEllipsis) {
        val inkBounds = remember { TextPaintBoundsCache() }
        Modifier.drawWithContent {
            drawContent()
            val result = measured[0]
            if (result != null && result.hasVisualOverflow && result.multiParagraph.height <= result.size.height) {
                // Compose clips an overflowing paragraph to its line box. Accents may
                // extend outside a tight authored line. Reuse the already ellipsized
                // paragraph only outside that clip; no text or selection is repainted
                // inside it, and the original text remains available to semantics.
                // Real paint bounds include stacked marks and effects. A guessed
                // large strip loses clip precision when the canvas is transformed.
                val bounds = inkBounds.get(result.multiParagraph, resolvedStyle)
                if (bounds != null) clipRect(0f, bounds.top, result.size.width.toFloat(), bounds.bottom) {
                    clipRect(0f, 0f, result.size.width.toFloat(), result.size.height.toFloat(), ClipOp.Difference) {
                        result.multiParagraph.paintText(drawContext.canvas, resolvedStyle)
                    }
                }
            }
        }
    } else Modifier
    BasicText(text, modifier.then(callerHeightClip).then(authored).then(completeInk), style = resolvedStyle,
        onTextLayout = { measured[0] = it; onTextLayout?.invoke(it) },
        overflow = overflow, softWrap = softWrap, maxLines = maxLines, minLines = minLines)
}
