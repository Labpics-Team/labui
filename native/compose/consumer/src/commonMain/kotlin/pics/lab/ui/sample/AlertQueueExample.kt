package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabAlert
import pics.lab.ui.LabAlertType
import pics.lab.ui.LabButton
import pics.lab.ui.LabMaterial
import pics.lab.ui.LabScene
import pics.lab.ui.LabText
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState

/** Consumer-owned queue. Closing the front item reveals the next retained message. */
@Composable
public fun AlertQueueExample(theme: LabThemeState) {
    val messages = listOf("Изменения сохранены", "Экспорт подготовлен", "Доступ обновлён")
    var index by remember { mutableIntStateOf(0) }
    val origin = remember { FocusRequester() }
    LabTheme(theme) {
        LabScene(Modifier.fillMaxSize(), background = { Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) }) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                LabButton("Показать сообщения", { index = 0 }, Modifier.focusRequester(origin))
                LabText("Осталось сообщений: ${messages.size - index}")
                if (index < messages.size) LabAlert(messages[index], { index++ },
                    description = "Коллеги увидят обновлённую версию проекта.",
                    quantity = messages.size - index, notificationKey = index,
                    type = LabAlertType.Neutral, material = LabMaterial.Acrylic,
                    restoreFocus = if (index == messages.lastIndex) origin else null)
            }
        }
    }
}
