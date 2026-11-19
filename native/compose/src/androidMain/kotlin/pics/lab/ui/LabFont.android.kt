package pics.lab.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import org.jetbrains.compose.resources.Font
import pics.lab.ui.resources.Res
import pics.lab.ui.resources.geist_regular
import pics.lab.ui.resources.geist_medium
import pics.lab.ui.resources.geist_semibold

@Composable
public actual fun labFontFamily(): FontFamily {
    val regular = Font(Res.font.geist_regular, FontWeight.Normal)
    val medium = Font(Res.font.geist_medium, FontWeight.Medium)
    val semibold = Font(Res.font.geist_semibold, FontWeight.SemiBold)
    return remember(regular, medium, semibold) { FontFamily(regular, medium, semibold) }
}
