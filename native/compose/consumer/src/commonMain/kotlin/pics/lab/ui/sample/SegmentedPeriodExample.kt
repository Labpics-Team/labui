package pics.lab.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabSegmentedControl
import pics.lab.ui.LabSegmentedItem
import pics.lab.ui.LabSegmentedShape
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.labFontFamily
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import pics.lab.ui.rememberLabSegmentedState

/** Consumer owns the period and its result; the control supplies one mutually exclusive choice. */
@Composable
fun SegmentedPeriodExample(theme: LabThemeState) {
    val period = rememberLabSegmentedState("week")
    val labels = mapOf("day" to "День", "week" to "Неделя", "month" to "Месяц")
    LabTheme(theme) {
        val text = TextStyle(fontFamily = labFontFamily(), fontSize = 16.sp, lineHeight = 24.sp, color = theme.colors["label-primary"])
        Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            BasicText("Активность команды", style = text)
            LabSegmentedControl(period.value, { period.value = it }, labels.map { (value, label) -> LabSegmentedItem(value, label) },
                Modifier.fillMaxWidth(), shape = LabSegmentedShape.Regular, label = "Период")
            BasicText("Показан период: ${labels[period.value]}", style = text)
        }
    }
}
