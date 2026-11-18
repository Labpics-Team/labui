package pics.lab.ui

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.useContents
import platform.Foundation.NSString

@OptIn(ExperimentalForeignApi::class)
internal actual fun avatarFirstGraphemes(text: String, limit: Int): String {
    val value = text as NSString
    var end = 0uL
    repeat(limit) {
        if (end >= value.length) return text
        value.rangeOfComposedCharacterSequenceAtIndex(end).useContents { end = location + length }
    }
    return value.substringToIndex(end)
}
