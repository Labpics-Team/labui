package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

@Composable
public fun LabSwitch(checked: Boolean, onCheckedChange: (Boolean) -> Unit, label: String,
    modifier: Modifier = Modifier, enabled: Boolean = true) {
    val colors = LocalLabTheme.current.colors
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val motion = rememberLabMotion()
    val progress = remember(motion) { motion.value(if (checked) 1f else 0f, "switch.thumb") }
    LaunchedEffect(checked) { motion.animate { to(progress, if (checked) 1f else 0f) } }
    Row(modifier.toggleable(checked, enabled = enabled, role = Role.Switch,
        interactionSource = interactions, indication = null, onValueChange = onCheckedChange)
        .padding(vertical = LabTokens.Space2.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(LabTokens.Space3.dp)) {
        Box(Modifier.size(LabTokens.SizeSwitchTrackM.dp, LabTokens.SizeSwitchTrackHM.dp)
            .background(colors[if (checked) "fill-accent" else "fill-primary"], CircleShape)
            .then(if (focused) Modifier.border(LabTokens.FocusRingWidth.dp, colors["border-focus"], CircleShape) else Modifier)) {
            Box(Modifier.offset {
                val inset = (LabTokens.SizeSwitchTrackHM - LabTokens.SizeSwitchThumbM) / 2
                IntOffset((inset + (LabTokens.SizeSwitchTrackM - LabTokens.SizeSwitchTrackHM) * progress.value).dp.roundToPx(), inset.dp.roundToPx())
            }.size(LabTokens.SizeSwitchThumbM.dp).background(colors["label-on-accent"], CircleShape))
        }
        BasicText(label, style = LabType.body())
    }
}
