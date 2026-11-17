package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import pics.lab.ui.*

@Composable
fun SettingsScreen() {
    var preferences by remember { mutableStateOf(LabPreferences()) }
    val theme = remember(preferences) { LabThemeState(initialLabColors(preferences), preferences) }
    val scope = rememberCoroutineScope()
    val trigger = remember { FocusRequester() }
    val project = rememberTextFieldState("Лаборатория")
    val email = rememberTextFieldState("hello@labpics.ru")
    val details = rememberTextFieldState("Дизайн и разработка цифровых продуктов")
    var notifications by remember { mutableStateOf(true) }
    var open by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var snackbar by remember { mutableStateOf<String?>(null) }
    var material by remember { mutableStateOf(LabMaterial.Glass) }
    val font = labFontFamily()
    val heading = TextStyle(fontFamily = font, fontSize = 28.sp, fontWeight = FontWeight.SemiBold,
        color = theme.colors["label-primary"], lineHeight = 34.sp)
    val body = TextStyle(fontFamily = font, fontSize = 16.sp, color = theme.colors["label-secondary"], lineHeight = 24.sp)
    LabTheme(theme, font) {
        LabScene(Modifier.fillMaxSize(), background = {
            Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).background(Brush.linearGradient(listOf(
                theme.colors["bg-primary"], theme.colors["fill-accent-tinted"], theme.colors["bg-secondary"]))))
        }) {
            LabSheetHost(open, "Параметры проекта", { if (!saving) open = false }, trigger, LabMaterials.base,
                modifier = Modifier.fillMaxSize(), material = material, size = LabSheetSize.TwoThirds,
                dismissible = !saving,
                content = {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        Column(Modifier.widthIn(max = 560.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            BasicText("Рабочее пространство", style = heading)
                            BasicText("Ваш проект, уведомления и доступ.", style = body)
                        }
                        LabCard(LabMaterials.soft, Modifier.widthIn(max = 560.dp).fillMaxWidth(), material) {
                            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                BasicText("Проект", style = heading.copy(fontSize = 20.sp, lineHeight = 28.sp))
                                LabInput(project, "Название", helper = "Так проект увидят участники команды.")
                                LabInput(email, "Почта для уведомлений")
                                LabSwitch(notifications, { notifications = it }, "Получать уведомления")
                                LabButton("Параметры проекта", { open = true }, Modifier.focusRequester(trigger))
                            }
                        }
                        Column(Modifier.widthIn(max = 560.dp).fillMaxWidth()) {
                            LabSwitch(preferences.appearance == LabAppearance.Dark, {
                                preferences = preferences.copy(appearance = if (it) LabAppearance.Dark else LabAppearance.Light)
                            }, "Тёмная тема")
                            LabSwitch(preferences.reducedMotion, { preferences = preferences.copy(reducedMotion = it) }, "Уменьшить движение")
                            LabSwitch(preferences.reducedTransparency, { preferences = preferences.copy(reducedTransparency = it) }, "Уменьшить прозрачность")
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                for (kind in LabMaterial.entries) LabButton(kind.name, { material = kind }, intent = LabIntent.Neutral,
                                    kind = if (kind == material) LabButtonKind.Fill else LabButtonKind.Ghost, size = LabControlSize.Small)
                            }
                        }
                    }
                }, sheet = {
                    LabInput(project, "Название проекта", error = error, readOnly = saving)
                    LabInput(details, "Описание", singleLine = false, readOnly = saving)
                    LabSwitch(notifications, { notifications = it }, "Уведомлять об изменениях", enabled = !saving)
                    BasicText("Настройки применяются ко всему рабочему пространству. Участники сохранят доступ к своим материалам.", style = body)
                    LabButton("Сохранить изменения", {
                        if (project.text.isBlank()) error = "Введите название проекта"
                        else {
                            error = null
                            saving = true
                            scope.launch {
                                try { delay(700); open = false; snackbar = "Изменения сохранены" }
                                finally { saving = false }
                            }
                        }
                    }, loading = saving)
                })
            snackbar?.let { message ->
                LabSnackbar(message, Modifier.align(Alignment.BottomCenter).padding(24.dp).widthIn(max = 560.dp)) {
                    LabButton("Закрыть", { snackbar = null }, kind = LabButtonKind.Ghost, intent = LabIntent.Neutral, size = LabControlSize.Small)
                }
            }
        }
    }
}
