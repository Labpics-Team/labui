package pics.lab.ui

import android.icu.text.BreakIterator
import java.util.Locale

internal actual fun avatarFirstGraphemes(text: String, limit: Int): String {
    val iterator = BreakIterator.getCharacterInstance(Locale.ROOT).apply { setText(text) }
    var end = iterator.first()
    repeat(limit) { val next = iterator.next(); if (next == BreakIterator.DONE) return text; end = next }
    return text.substring(0, end)
}
