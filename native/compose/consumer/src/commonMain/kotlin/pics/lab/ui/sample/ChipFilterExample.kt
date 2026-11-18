package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.ui.LabChip
import pics.lab.ui.LabChipMode
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.labFontFamily

/** A consumer composition: filters select real rows; reset is a separate action. */
@Composable
fun ChipFilterExample(theme: LabThemeState, modifier: Modifier = Modifier) {
    var design by rememberSaveable { mutableStateOf(false) }
    var development by rememberSaveable { mutableStateOf(false) }
    val font = labFontFamily()
    val body = TextStyle(fontFamily = font, fontSize = 16.sp, lineHeight = 24.sp, color = theme.colors["label-primary"])
    LabTheme(theme, font) {
        Column(modifier.fillMaxSize().background(theme.colors["bg-primary"])
            .verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            BasicText("Материалы проекта", style = body.copy(fontSize = 20.sp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                LabChip("Дизайн", selected = design, active = true, onSelectedChange = { design = it })
                LabChip("Разработка", selected = development, active = true, onSelectedChange = { development = it })
                LabChip("Сбросить", mode = LabChipMode.Action, enabled = design || development,
                    onAction = { design = false; development = false })
            }
            if (!development || design) BasicText("Макеты продукта", style = body)
            if (!design || development) BasicText("Описание API", style = body)
        }
    }
}
