package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import pics.lab.icons.symbols.pencil
import pics.lab.ui.LabContextMenu
import pics.lab.ui.LabMenu
import pics.lab.ui.LabMenuItem
import pics.lab.ui.LabMenubar
import pics.lab.ui.LabMenubarItem
import pics.lab.ui.LabMenuTone
import pics.lab.ui.LabScene
import pics.lab.ui.LabText
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState

/** Public-package consumer: the same tree and checked state serve every menu presentation. */
@Composable
fun MenuExample(theme: LabThemeState) {
    var checked by remember { mutableStateOf(listOf("grid")) }
    var action by remember { mutableStateOf("Нет действия") }
    val items = remember { listOf(
        LabMenuItem.Action("edit", "Редактировать", icon = pencil, tone = LabMenuTone.Accent),
        LabMenuItem.Check("grid", "Показывать сетку", closeOnSelect = false),
        LabMenuItem.Submenu("export", "Экспорт", listOf(
            LabMenuItem.Action("png", "Изображение PNG"),
            LabMenuItem.Action("pdf", "Документ PDF"),
        )),
    ) }
    LabTheme(theme) {
        LabScene(Modifier.fillMaxSize(), { Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) }) {
            Column(Modifier.padding(32.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                LabMenubar(listOf(LabMenubarItem("project", "Проект", items)),
                    checkedValues = checked, onCheckedValuesChange = { checked = it }, onSelect = { action = it })
                LabMenu(items, "Действия", checkedValues = checked, onCheckedValuesChange = { checked = it }, onSelect = { action = it })
                LabContextMenu(items, "Действия над объектом", checkedValues = checked,
                    onCheckedValuesChange = { checked = it }, onSelect = { action = it }) { control ->
                    LabText("Объект на холсте", control.padding(24.dp))
                }
                LabText("Выбор: ${checked.joinToString()}")
                LabText("Действие: $action")
            }
        }
    }
}
