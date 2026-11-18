package pics.lab.ui

import androidx.compose.foundation.focusGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

internal data class TabNavigation(
    val group: Modifier,
    val triggers: Map<String, Modifier>,
    val activate: (String) -> Unit,
)

/** Roving focus is local; selection changes only when the application accepts them. */
@Composable
internal fun tabNavigation(
    entries: List<Pair<String, Boolean>>,
    selected: String?,
    vertical: Boolean,
    automatic: Boolean,
    onSelect: (String) -> Unit,
): TabNavigation {
    val keys = entries.map { it.first }
    val enabled = entries.filter { it.second }.map { it.first }
    val initial = selected?.takeIf { it in enabled } ?: enabled.firstOrNull()
    val requesters = remember(keys) { keys.associateWith { FocusRequester() } }
    var active by remember { mutableStateOf(initial) }
    var pending by remember { mutableStateOf<String?>(null) }
    var groupFocused by remember { mutableStateOf(false) }
    val direction = LocalLayoutDirection.current
    LaunchedEffect(selected, enabled, pending) {
        if (pending == null && (!groupFocused || active !in enabled)) {
            val restore = groupFocused && active !in enabled
            active = initial
            if (restore) pending = initial
        }
    }
    LaunchedEffect(pending) {
        pending?.let { target ->
            if (target in enabled) requesters[target]?.requestFocus()
            pending = null
        }
    }
    val activate: (String) -> Unit = { target ->
        if (target in enabled) {
            active = target
            pending = target
            if (selected != target) onSelect(target)
        }
    }
    val group = Modifier.onFocusChanged {
        val wasFocused = groupFocused
        groupFocused = it.hasFocus
        if (wasFocused && !it.hasFocus && pending == null) {
            if (active !in enabled) pending = initial
            active = initial
        }
    }.focusGroup()
    val modifiers = entries.associate { (value, canSelect) ->
        value to Modifier.focusRequester(requesters.getValue(value))
            .focusProperties { canFocus = canSelect && active == value }
            .onFocusChanged { if (it.isFocused) active = value }
            .onPreviewKeyEvent { event ->
                val delta = when {
                    vertical && event.key == Key.DirectionDown -> 1
                    vertical && event.key == Key.DirectionUp -> -1
                    !vertical && event.key == Key.DirectionRight -> if (direction == LayoutDirection.Rtl) -1 else 1
                    !vertical && event.key == Key.DirectionLeft -> if (direction == LayoutDirection.Rtl) 1 else -1
                    else -> 0
                }
                val home = event.key == Key.MoveHome
                val end = event.key == Key.MoveEnd
                if (!canSelect || enabled.isEmpty() || (delta == 0 && !home && !end)) false
                else {
                    if (event.type == KeyEventType.KeyDown) {
                        val current = enabled.indexOf(value).coerceAtLeast(0)
                        val target = when {
                            home -> enabled.first()
                            end -> enabled.last()
                            else -> enabled[(current + delta + enabled.size) % enabled.size]
                        }
                        active = target
                        pending = target
                        if (automatic && selected != target) onSelect(target)
                    }
                    true
                }
            }
    }
    return TabNavigation(group, modifiers, activate)
}
