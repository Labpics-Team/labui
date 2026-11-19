package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.ui.LabButton
import pics.lab.ui.LabButtonKind
import pics.lab.ui.LabDragButton
import pics.lab.ui.LabDragButtonStatus
import pics.lab.ui.LabTheme
import pics.lab.ui.LabText
import pics.lab.ui.LabThemeState
import pics.lab.ui.labFontFamily

/** The installed application owns the action and the next attempt. */
@Composable
fun DragTransferExample(theme: LabThemeState) {
    var status by remember { mutableStateOf(LabDragButtonStatus.Idle) }
    var count by remember { mutableStateOf(0) }
    LabTheme(theme) {
        val text = TextStyle(fontFamily = labFontFamily(), fontSize = 16.sp, lineHeight = 24.sp, color = theme.colors["label-primary"])
        Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            LabText("Перевод в общий бюджет", style = text)
            LabDragButton("Подтвердить перевод", { count++; status = LabDragButtonStatus.Success },
                status = status, helperText = "Подтвердить перевод", successText = "Отправлено", pendingText = "Отправляем", dangerText = "Не отправлено")
            LabText("Отправлено переводов: $count", style = text)
            LabButton("Новый перевод", { status = LabDragButtonStatus.Idle }, kind = LabButtonKind.Tinted)
        }
    }
}
