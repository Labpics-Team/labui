package pics.lab.ui

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

public enum class LabSelectionOrientation { Horizontal, Vertical }

public data class LabRadioItem(
    public val value: String,
    public val label: String,
    public val disabled: Boolean = false,
    public val labelStart: String? = null,
)

/** One selected value, one tab stop, and native radio semantics for every option. */
@Composable
public fun LabRadioGroup(
    value: String?,
    onValueChange: (String) -> Unit,
    items: List<LabRadioItem>,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    intent: LabIntent = LabIntent.Accent,
    size: LabSelectionSize = LabSelectionSize.Medium,
    orientation: LabSelectionOrientation = LabSelectionOrientation.Vertical,
    label: String? = null,
) {
    require(items.map { it.value }.distinct().size == items.size) { "Radio values must be unique" }
    val metrics = selectionMetrics(size)
    val navigation = selectionNavigation(items.map { it.value to (enabled && !it.disabled) }, value, onValueChange)
    val group = modifier.selectableGroup().then(if (label != null) Modifier.semantics { contentDescription = label } else Modifier)
    val content: @Composable () -> Unit = {
        items.forEachIndexed { index, item -> key(item.value) {
            val interactions = remember { MutableInteractionSource() }
            val hovered by interactions.collectIsHoveredAsState()
            val focused by interactions.collectIsFocusedAsState()
            val active = enabled && !item.disabled
            val selected = value == item.value
            SelectionLabelLayout(navigation[index].selectable(selected, enabled = active, role = Role.RadioButton,
                interactionSource = interactions, indication = null, onClick = { onValueChange(item.value) })
                .heightIn(min = metrics.controlHeight.dp), item.labelStart, item.label,
                selectionLabelStyle(metrics, active), metrics.labelGap.dp) {
                SelectionIndicator(if (selected) ToggleableState.On else ToggleableState.Off,
                    true, active, intent, size, hovered, focused)
            }
        } }
    }
    if (orientation == LabSelectionOrientation.Horizontal) FlowRow(group,
        horizontalArrangement = Arrangement.spacedBy(metrics.labelGap.dp),
        verticalArrangement = Arrangement.spacedBy(metrics.labelGap.dp), content = { content() })
    else Column(group, verticalArrangement = Arrangement.spacedBy(metrics.labelGap.dp), content = { content() })
}

/** Shared roving focus for radio-shaped controls, including whole Choicebox cards. */
@Composable
internal fun selectionNavigation(
    entries: List<Pair<String, Boolean>>,
    selected: String?,
    onSelect: (String) -> Unit,
): List<Modifier> {
    val keys = entries.map { it.first }
    val enabled = entries.indices.filter { entries[it].second }
    val initial = entries.indexOfFirst { it.first == selected && it.second }.takeIf { it >= 0 } ?: enabled.firstOrNull() ?: -1
    val requesters = remember(keys) { keys.map { FocusRequester() } }
    var active by remember(keys) { mutableStateOf(initial) }
    var pending by remember(keys) { mutableStateOf<Int?>(null) }
    val direction = LocalLayoutDirection.current
    LaunchedEffect(selected, entries) { if (pending == null) active = initial }
    LaunchedEffect(pending) {
        pending?.let { target ->
            if (target in enabled) requesters[target].requestFocus()
            pending = null
        }
    }
    return entries.mapIndexed { index, entry ->
        Modifier.focusRequester(requesters[index]).focusProperties { canFocus = entry.second && active == index }
            .onPreviewKeyEvent { event ->
                val delta = when (event.key) {
                    Key.DirectionDown -> 1
                    Key.DirectionUp -> -1
                    Key.DirectionRight -> if (direction == LayoutDirection.Rtl) -1 else 1
                    Key.DirectionLeft -> if (direction == LayoutDirection.Rtl) 1 else -1
                    else -> 0
                }
                val home = event.key == Key.MoveHome
                val end = event.key == Key.MoveEnd
                if (!entry.second || enabled.isEmpty() || (delta == 0 && !home && !end)) false
                else {
                    if (event.type == KeyEventType.KeyDown) {
                        val current = enabled.indexOf(index).coerceAtLeast(0)
                        val target = when { home -> enabled.first(); end -> enabled.last()
                            else -> enabled[(current + delta + enabled.size) % enabled.size] }
                        active = target
                        pending = target
                        onSelect(entries[target].first)
                    }
                    true
                }
            }
    }
}
