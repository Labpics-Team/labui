package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabButton
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.LabTooltip
import pics.lab.ui.LabTooltipPlacement

/** Installed consumer: a real action retains focus while its explanation opens. */
@Composable
fun TooltipExample(theme: LabThemeState) {
    LabTheme(theme) {
        Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(100.dp)) {
            LabTooltip("Сохранено в вашей библиотеке", placement = LabTooltipPlacement.Bottom) { trigger ->
                LabButton("Библиотека", {}, trigger)
            }
        }
    }
}
