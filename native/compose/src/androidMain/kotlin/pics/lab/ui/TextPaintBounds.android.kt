package pics.lab.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.text.MultiParagraph
import androidx.compose.ui.text.TextStyle

// Android retains the original font metrics and its native paragraph painter.
internal actual fun textPaintBounds(paragraph: MultiParagraph, style: TextStyle): Rect? = null
