package pics.lab.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.isUnspecified

/**
 * Resolve shaping after the component has selected its final tracking.
 * CSS disables optional common ligatures for nonzero letter-spacing; Compose does not.
 * Keeping this decision with tracking also restores ligatures when a body style becomes a label.
 */
internal fun TextStyle.withTypography(
    letterSpacing: TextUnit = this.letterSpacing,
    color: Color = this.color,
    fontFamily: FontFamily? = this.fontFamily,
    fontSize: TextUnit = this.fontSize,
    lineHeight: TextUnit = this.lineHeight,
    fontWeight: FontWeight? = this.fontWeight,
    lineHeightStyle: LineHeightStyle? = this.lineHeightStyle,
): TextStyle = copy(
    color = color,
    fontFamily = fontFamily,
    fontSize = fontSize,
    lineHeight = lineHeight,
    fontWeight = fontWeight,
    letterSpacing = letterSpacing,
    lineHeightStyle = lineHeightStyle,
    fontFeatureSettings = if (letterSpacing.isUnspecified || letterSpacing.value == 0f) null else "liga 0, clig 0",
)
