package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp

internal fun LabControlSize.inputMetrics() = when (this) {
    LabControlSize.Small -> LabComponents.InputS
    LabControlSize.Medium -> LabComponents.InputM
    LabControlSize.Large -> LabComponents.InputL
}

/** Also protects the key that finishes composition before the next UI frame. */
internal class InputCompositionGuard(private val state: TextFieldState) {
    var renderedComposition = false
    fun active(): Boolean = state.composition != null || renderedComposition
}

@Composable
internal fun rememberInputCompositionGuard(state: TextFieldState): InputCompositionGuard {
    val guard = remember(state) { InputCompositionGuard(state) }
    val composing = state.composition != null
    SideEffect { guard.renderedComposition = composing }
    return guard
}

@Composable
internal fun InputAccessoryAction(
    label: String, enabled: Boolean, size: LabControlSize, action: () -> Unit,
    content: @Composable (Color) -> Unit,
) {
    val colors = LocalLabTheme.current.colors
    Box(Modifier.size(size.inputMetrics().contentHeight.dp)
        .focusProperties { canFocus = false }
        .clickable(enabled = enabled, role = Role.Button, onClick = action)
        .semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Box(Modifier.clearAndSetSemantics {}) {
            content(colors[if (enabled) "label-secondary" else "label-tertiary"])
        }
    }
}

@Composable
internal fun InputChevron(expanded: Boolean, color: Color) {
    Canvas(Modifier.size(LabComponents.SelectChevronViewBox.dp)) {
        withTransform({
            scale(size.width / LabComponents.SelectChevronViewBox, size.height / LabComponents.SelectChevronViewBox,
                pivot = androidx.compose.ui.geometry.Offset.Zero)
            if (expanded) rotate(180f, androidx.compose.ui.geometry.Offset(
                LabComponents.SelectChevronViewBox / 2, LabComponents.SelectChevronViewBox / 2))
            translate(LabComponents.SelectChevronX, LabComponents.SelectChevronY)
        }) { drawPath(LabComponents.SelectChevronPath, color) }
    }
}

/** A request is acknowledged only by the application's next accepted value. */
internal data class InputValuesRequest(val proposed: List<String>, val draft: String)
