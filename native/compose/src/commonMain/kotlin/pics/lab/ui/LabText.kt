package pics.lab.ui

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
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
    val lineCount = remember { intArrayOf(1) }
    val authoredFamily = usesAuthoredTextMetrics(style.fontFamily)
    val authored = if (authoredFamily && style.lineHeight.isSpecified && (!style.lineHeight.isEm || style.fontSize.isSp)) Modifier.layout { child, constraints ->
        val lineHeight = authoredLineHeight(style)
        val outerSpace = if (style.fontSize.isSp) ceil((style.fontSize.toPx() - lineHeight).coerceAtLeast(0f)).toInt() else 0
        // Give tight glyphs their natural outer space, while retaining the caller's
        // height limit for vertical ellipsis and text hit testing.
        val paragraphMaxHeight = if (constraints.maxHeight == Constraints.Infinity) Constraints.Infinity
            else (constraints.maxHeight.toLong() + outerSpace).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        val paragraph = child.measure(constraints.copy(minHeight = 0, maxHeight = paragraphMaxHeight))
        val lines = max(minLines, lineCount[0])
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
    BasicText(text, modifier.then(authored), style = resolvedStyle,
        onTextLayout = { lineCount[0] = it.lineCount; onTextLayout?.invoke(it) },
        overflow = overflow, softWrap = softWrap, maxLines = maxLines, minLines = minLines)
}
