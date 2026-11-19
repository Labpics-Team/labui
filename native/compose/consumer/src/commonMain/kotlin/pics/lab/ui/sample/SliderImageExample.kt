package pics.lab.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabRangeSlider
import pics.lab.ui.LabSlider
import pics.lab.ui.LabSliderVariant
import pics.lab.ui.LabText

/** Installed controls edit the image settings shown in the summary. */
@Composable
fun SliderImageExample() {
    var brightness by remember { mutableStateOf(50f) }
    var range by remember { mutableStateOf(20f..80f) }
    var angle by remember { mutableStateOf(0f) }
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        LabSlider(brightness, { brightness = it }, "Яркость", variant = LabSliderVariant.Large)
        LabRangeSlider(range, { range = it }, "Диапазон", thumbLabels = listOf("Тени", "Света"))
        LabSlider(angle, { angle = it }, "Поворот", max = 360f, variant = LabSliderVariant.Circular)
        LabText("Яркость ${brightness.toInt()} · диапазон ${range.start.toInt()}–${range.endInclusive.toInt()} · поворот ${angle.toInt()}°")
    }
}
