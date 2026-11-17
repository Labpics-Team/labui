package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** State-based input keeps selection and IME composition through validation and theme changes. */
@Composable
public fun LabInput(
    state: TextFieldState,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    helper: String? = null,
    error: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true,
) {
    val colors = LocalLabTheme.current.colors
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val shape = RoundedCornerShape(LabTokens.RadiusM.dp)
    val border = colors[when { error != null -> "border-danger"; focused -> "border-focus"; else -> "border-base" }]
    Column(modifier, verticalArrangement = Arrangement.spacedBy(LabTokens.Space1.dp)) {
        BasicText(label, style = LabType.caption().copy(color = colors["label-secondary"]))
        BasicTextField(state = state, enabled = enabled, readOnly = readOnly,
            lineLimits = if (singleLine) TextFieldLineLimits.SingleLine else TextFieldLineLimits.MultiLine(),
            keyboardOptions = keyboardOptions, interactionSource = interactions,
            textStyle = LabType.body(), cursorBrush = SolidColor(colors["label-accent"]),
            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = LabTokens.SizeControlHM.dp)
                .background(colors[if (readOnly) "fill-primary" else "bg-primary"], shape)
                .border(if (focused) LabTokens.FocusRingWidth.dp else 1.dp, border, shape)
                .padding(horizontal = LabTokens.Space4.dp, vertical = LabTokens.Space2.dp)
                .semantics { contentDescription = label; if (error != null) error(error) })
        if (error != null) BasicText(error, Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            style = LabType.caption().copy(color = colors["label-danger"]))
        else if (helper != null) BasicText(helper, style = LabType.caption().copy(color = colors["label-tertiary"]))
    }
}
