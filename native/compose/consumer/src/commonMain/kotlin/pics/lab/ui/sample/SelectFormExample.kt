package pics.lab.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabButton
import pics.lab.ui.LabSelect
import pics.lab.ui.LabSelectItem
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import pics.lab.ui.LabScene
import pics.lab.ui.labFontFamily
import pics.lab.ui.LabSwitch
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState

/** An installed consumer accepts or rejects requests, resets, and submits its accepted selection. */
@Composable
fun SelectFormExample(theme: LabThemeState) {
    var values by rememberSaveable { mutableStateOf(listOf("", "design")) }
    var accept by rememberSaveable { mutableStateOf(false) }
    var saved by rememberSaveable { mutableStateOf("") }
    val items = listOf(LabSelectItem("", "Без отдела"), LabSelectItem("design", "Дизайн"),
        LabSelectItem("engineering", "Разработка"), LabSelectItem("archive", "Архив", disabled = true))
    LabTheme(theme) {
        LabScene(background = { Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) }) {
            Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                BasicText("Команда проекта", style = TextStyle(fontFamily = labFontFamily(), fontSize = 22.sp, color = theme.colors["label-primary"]))
                LabSelect(values, { if (accept) values = it }, items, "Отделы", Modifier.fillMaxWidth(), multiple = true,
                    removeLabel = { "Удалить $it" })
                LabSwitch(accept, { accept = it }, label = "Принимать изменения")
                LabButton(text = "Сбросить", onClick = { values = listOf("", "design") })
                LabButton(text = "Сохранить", onClick = { saved = values.joinToString("|") })
                BasicText("Сохранено: $saved", style = TextStyle(fontFamily = labFontFamily(), fontSize = 16.sp, color = theme.colors["label-primary"]))
            }
        }
    }
}
