package pics.lab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

public enum class LabKbdSize { Small, Large }

/** A single physical key. Text remains text and grows with the system font scale. */
@Composable
public fun LabKbd(text: String, modifier: Modifier = Modifier, size: LabKbdSize = LabKbdSize.Small) {
    LabKbd(listOf(text), modifier, size)
}

/** Ordered keyboard input, with one authored cap per key and no interactive semantics. */
@Composable
public fun LabKbd(keys: List<String>, modifier: Modifier = Modifier, size: LabKbdSize = LabKbdSize.Small) {
    val metrics = when (size) {
        LabKbdSize.Small -> LabComponents.KbdS
        LabKbdSize.Large -> LabComponents.KbdL
    }
    Row(modifier.semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(LabComponents.KbdGap.dp),
        verticalAlignment = Alignment.CenterVertically) {
        keys.forEachIndexed { index, key -> KbdKey(key, metrics, index == 0) }
    }
}

@Composable
private fun KbdKey(text: String, metrics: LabKbdMetrics, first: Boolean) {
    val colors = LocalLabTheme.current.colors
    val fill = colors[if (first) LabComponents.KbdFirstFillRole else LabComponents.KbdRemainingFillRole]
    val end = colors[LabComponents.KbdFillEndRole]
    val border = colors[LabComponents.KbdBorderRole]
    val bottomBorder = colors[LabComponents.KbdBottomBorderRole]
    val style = LabType.body().withTypography(
        color = colors[LabComponents.KbdLabelRole],
        fontSize = metrics.fontSize.sp, lineHeight = metrics.lineHeight.sp,
        fontWeight = FontWeight(LabComponents.KbdFontWeight.toInt()),
        letterSpacing = LabComponents.KbdLetterSpacing.sp,
        lineHeightStyle = LineHeightStyle(
            LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Tight),
    )
    Box(Modifier.defaultMinSize(minWidth = metrics.height.dp, minHeight = metrics.height.dp)
        .drawWithCache {
            val radius = metrics.radius.dp.toPx()
            val depth = metrics.bottomStrokeWidth.dp.toPx()
            val stroke = LabComponents.KbdStrokeWidth.dp.toPx()
            val inset = stroke / 2
            val original = Path().apply {
                addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(radius)))
            }
            val extended = Path().apply {
                addRoundRect(RoundRect(0f, 0f, size.width, size.height + depth, CornerRadius(radius + depth)))
            }
            val edge = Path.combine(PathOperation.Difference, extended, original)
            val gradient = Brush.verticalGradient(listOf(fill, end), endY = size.height)
            val rim = Stroke(stroke)
            onDrawWithContent {
                drawPath(edge, bottomBorder)
                drawRoundRect(gradient, cornerRadius = CornerRadius(radius))
                drawRoundRect(border, topLeft = Offset(inset, inset),
                    size = Size(size.width - stroke, size.height - stroke),
                    cornerRadius = CornerRadius(radius - inset), style = rim)
                drawContent()
            }
        }
        .padding(horizontal = metrics.paddingX.dp, vertical = metrics.paddingY.dp),
        contentAlignment = Alignment.Center) {
        LabText(text, style = style,
            maxLines = 1, softWrap = false, overflow = TextOverflow.Visible)
    }
}
