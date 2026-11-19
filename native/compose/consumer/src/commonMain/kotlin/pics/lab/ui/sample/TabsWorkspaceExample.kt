package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.icons.Icon
import pics.lab.icons.symbols.pencil
import pics.lab.icons.symbols.settings
import pics.lab.ui.LabCard
import pics.lab.ui.LabInput
import pics.lab.ui.LabMaterial
import pics.lab.ui.LabMaterials
import pics.lab.ui.LabScene
import pics.lab.ui.LabSwitch
import pics.lab.ui.LabTabItem
import pics.lab.ui.LabTabs
import pics.lab.ui.LabTabsVariant
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.labFontFamily

/** Installed consumer: controlled approval and local editor state, on the application's material. */
@Composable
fun TabsWorkspaceExample(theme: LabThemeState, material: LabMaterial = LabMaterial.Solid, modifier: Modifier = Modifier) {
    var selected by remember { mutableStateOf("project") }
    var allowSwitch by remember { mutableStateOf(false) }
    val font = labFontFamily()
    val body = TextStyle(fontFamily = font, fontSize = 16.sp, lineHeight = 24.sp, color = theme.colors["label-primary"])
    LabTheme(theme, font) {
        LabScene(modifier.fillMaxSize(), background = {
            androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(
                theme.colors["fill-brand-secondary"], theme.colors["bg-primary"], theme.colors["fill-success-tertiary"],
            ))))
        }) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                LabCard(LabMaterials.base, Modifier.fillMaxWidth(), material, padding = PaddingValues(16.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        BasicText("Рабочие заметки", style = body)
                        LabSwitch(allowSwitch, { allowSwitch = it }, "Разрешить переход")
                        LabTabs(selected, { if (allowSwitch) selected = it }, listOf(
                            LabTabItem("project", "Проект", icon = { Icon(settings, tint = color, size = size) }),
                            LabTabItem("draft", "Черновик", icon = { Icon(pencil, tint = color, size = size) }),
                            LabTabItem("archive", "Архив", disabled = true),
                        ), variant = LabTabsVariant.Tinted, label = "Раздел заметок") { value ->
                            val editor = remember { TextFieldState(if (value == "project") "План проекта" else "Новый текст") }
                            LabInput(editor, if (value == "project") "Заметки проекта" else "Текст черновика", singleLine = false)
                        }
                    }
                }
            }
        }
    }
}
