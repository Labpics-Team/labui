package pics.lab.ui

import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth

/** Keep every keyed composition alive while only the active panel enters layout. */
@Composable
internal fun RetainedTabPanels(
    values: List<String>,
    selected: String?,
    modifier: Modifier = Modifier,
    content: @Composable (String) -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Layout(modifier = modifier, content = {
        values.forEach { value -> key(value) {
            var hasFocus by remember { mutableStateOf(false) }
            LaunchedEffect(value == selected) {
                if (value != selected && hasFocus) focusManager.clearFocus(force = true)
            }
            Box(Modifier.onFocusChanged { hasFocus = it.hasFocus }
                .focusProperties { onEnter = { if (value != selected) cancelFocusChange() } }
                .focusGroup()
                .then(if (value == selected) Modifier else Modifier.clearAndSetSemantics {})) { content(value) }
        } }
    }) { measurables, constraints ->
        val panel = measurables.getOrNull(values.indexOf(selected))?.measure(constraints)
        layout(constraints.constrainWidth(panel?.width ?: 0), constraints.constrainHeight(panel?.height ?: 0)) {
            panel?.placeRelative(0, 0)
        }
    }
}
