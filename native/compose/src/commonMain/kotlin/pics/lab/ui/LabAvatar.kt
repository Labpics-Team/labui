package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import org.jetbrains.compose.resources.Font
import pics.lab.ui.resources.Res
import pics.lab.ui.resources.avatar_rounded_extrabold

public enum class LabAvatarFallback { Initials, Texture }

@Composable
internal fun labAvatarFontFamily(): FontFamily = FontFamily(Font(Res.font.avatar_rounded_extrabold, FontWeight.ExtraBold))

internal expect fun avatarFirstGraphemes(text: String, limit: Int): String

internal fun labAvatarInitials(name: String, initials: String?): String {
    if (initials != null) return avatarFirstGraphemes(initials.trim().uppercase(), 2)
    val words = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (words.isEmpty()) return ""
    return avatarFirstGraphemes(avatarFirstGraphemes(words.first(), 1).uppercase(), 1) +
        if (words.size > 1) avatarFirstGraphemes(avatarFirstGraphemes(words.last(), 1).uppercase(), 1) else ""
}

/** A named portrait; loading, errors and cancelled old URLs preserve the selected fallback. */
@Composable
public fun LabAvatar(
    name: String = "",
    modifier: Modifier = Modifier,
    src: String? = null,
    initials: String? = null,
    size: LabControlSize = LabControlSize.Medium,
    color: LabAvatarColor = LabComponents.AvatarDefaultColor,
    fallback: LabAvatarFallback = LabAvatarFallback.Initials,
    status: LabAvatarStatus = LabAvatarStatus.None,
    statusLabel: String = "",
    decorative: Boolean = false,
) {
    val colors = LocalLabTheme.current.colors
    val fill = colors[color.role]
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.AvatarS
        LabControlSize.Medium -> LabComponents.AvatarM
        LabControlSize.Large -> LabComponents.AvatarL
    }
    val text = remember(name, initials, fallback) { if (fallback == LabAvatarFallback.Texture) "" else labAvatarInitials(name, initials) }
    val textScale = if (text.isEmpty()) 1f else maxOf(1f, LocalDensity.current.fontScale)
    val presence = if (status == LabAvatarStatus.None) "" else statusLabel.ifBlank { status.label }
    val accessibleName = name.ifBlank { "Аватар" } + if (presence.isBlank()) "" else ", $presence"
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val statusColor = status.role?.let { colors[it] }
    val highlight = colors[LabComponents.AvatarHighlightRole].copy(alpha = LabComponents.AvatarHighlightAlpha)
    val font = labAvatarFontFamily()
    var ready by remember(src) { mutableStateOf(false) }
    Box(modifier.size((metrics.diameter * textScale).dp).clearAndSetSemantics {
        if (!decorative) { role = Role.Image; contentDescription = accessibleName }
    }) {
        Box(Modifier.matchParentSize().drawWithCache {
            val disc = Path().apply { addOval(Rect(Offset.Zero, this@drawWithCache.size)) }
            val dotRadius = (metrics.statusSize * textScale).dp.toPx() / 2
            val dotCenter = Offset(if (rtl) dotRadius else this.size.width - dotRadius, this.size.height - dotRadius)
            val cutRadius = dotRadius + (metrics.statusGap * textScale).dp.toPx()
            val cut = Path().apply { addOval(Rect(dotCenter - Offset(cutRadius, cutRadius), dotCenter + Offset(cutRadius, cutRadius))) }
            val shape = if (statusColor == null) disc else Path.combine(PathOperation.Difference, disc, cut)
            onDrawWithContent { clipPath(shape) { this@onDrawWithContent.drawContent() } }
        }, contentAlignment = Alignment.Center) {
            if (!ready && text.isNotEmpty()) {
                Box(Modifier.matchParentSize().background(fill).background(Brush.verticalGradient(listOf(highlight, Color.Transparent))))
                BasicText(text, modifier = Modifier.offset(y = (metrics.diameter * (LabComponents.AvatarLetterBoxHeightRatio - 1) / 2 * textScale).dp), style = TextStyle(fontFamily = font, fontWeight = FontWeight(LabComponents.AvatarFontWeight.toInt()),
                    fontSize = metrics.fontSize.sp, lineHeight = metrics.lineHeight.sp,
                    letterSpacing = LabComponents.AvatarLetterSpacing.sp, color = colors[LabComponents.AvatarLetterRole]))
            } else if (!ready) Box(Modifier.matchParentSize().background(fill))
            if (!src.isNullOrBlank()) key(src) {
                AsyncImage(model = src, contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize().alpha(if (ready) 1f else 0f),
                    onLoading = { ready = false }, onSuccess = { ready = true }, onError = { ready = false })
            }
        }
        if (statusColor != null) Box(Modifier.matchParentSize().drawWithCache {
            val radius = (metrics.statusSize * textScale).dp.toPx() / 2
            val center = Offset(if (rtl) radius else this.size.width - radius, this.size.height - radius)
            onDrawBehind { drawCircle(statusColor, radius, center) }
        })
    }
}
