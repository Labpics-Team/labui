package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

public enum class LabBadgeType { Fill, Tinted }

/** The badge supplies decorative icon paint and logical size without choosing an icon package. */
@Immutable
public data class LabBadgeIconScope(public val color: Color, public val size: Dp)

/**
 * A compact, non-interactive label. [enabled] selects the authored muted appearance;
 * it does not turn the badge into a disabled action. Icons are decorative and [text]
 * remains the single accessible label. At larger system text scales the badge grows.
 */
@Composable
public fun LabBadge(
    text: String,
    modifier: Modifier = Modifier,
    color: LabBadgeColor = LabComponents.BadgeDefaultColor,
    type: LabBadgeType = LabBadgeType.Fill,
    enabled: Boolean = true,
    icon: (@Composable LabBadgeIconScope.() -> Unit)? = null,
    iconEnd: (@Composable LabBadgeIconScope.() -> Unit)? = null,
) {
    val colors = LocalLabTheme.current.colors
    val fill = colors[when {
        !enabled -> LabComponents.BadgeDisabledFillRole
        type == LabBadgeType.Fill -> "badge-fill-${color.role}"
        else -> "badge-tint-${color.role}"
    }]
    val label = colors[when {
        !enabled -> LabComponents.BadgeDisabledLabelRole
        type == LabBadgeType.Fill -> "badge-label-on-${color.role}"
        else -> "badge-label-${color.role}"
    }]
    val iconColor = colors[when {
        !enabled -> LabComponents.BadgeDisabledLabelRole
        type == LabBadgeType.Fill -> "badge-icon-on-${color.role}"
        else -> "badge-label-${color.role}"
    }]
    val iconScope = LabBadgeIconScope(iconColor, LabComponents.BadgeIconSize.dp)
    val shape = RoundedCornerShape(LabComponents.BadgeRadius.dp)
    val labelStyle = LabType.body().withTypography(
        color = label,
        fontSize = LabComponents.BadgeFontSize.sp,
        lineHeight = LabComponents.BadgeLineHeight.sp,
        letterSpacing = LabComponents.BadgeLetterSpacing.sp,
        fontWeight = FontWeight(LabComponents.BadgeFontWeight.toInt()),
        lineHeightStyle = LineHeightStyle(
            LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.Both, LineHeightStyle.Mode.Fixed),
    )
    Row(
        modifier.semantics(mergeDescendants = true) {}
            .clip(shape).background(fill)
            .defaultMinSize(minHeight = LabComponents.BadgeHeight.dp)
            .padding(horizontal = LabComponents.BadgePaddingX.dp, vertical = LabComponents.BadgePaddingY.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(LabComponents.BadgeGap.dp),
    ) {
        if (icon != null) Box(Modifier.size(iconScope.size).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
            iconScope.icon()
        }
        // Skia's first/last line font metrics exceed the authored line box even
        // with Mode.Fixed. Center the unbounded glyph box inside the 12sp advance;
        // the surrounding padding accommodates ascenders without clipping.
        BasicText(text, modifier = Modifier.weight(1f, fill = false)
            .height(with(LocalDensity.current) { LabComponents.BadgeLineHeight.sp.toDp() })
            .wrapContentHeight(unbounded = true), style = labelStyle,
            maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
        if (iconEnd != null) Box(Modifier.size(iconScope.size).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
            iconScope.iconEnd()
        }
    }
}
