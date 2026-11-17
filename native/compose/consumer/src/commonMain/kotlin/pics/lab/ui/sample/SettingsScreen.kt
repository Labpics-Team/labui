package pics.lab.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import pics.lab.icons.Icon
import pics.lab.icons.symbols.checkmark
import pics.lab.icons.symbols.pencil
import pics.lab.icons.symbols.settings
import pics.lab.ui.*

@Composable
fun SettingsScreen(host: ColorProgramHost, store: WorkspaceStore) {
    var saved by remember(store) { mutableStateOf<WorkspaceSettings?>(null) }
    var loadError by remember { mutableStateOf(false) }
    var loadAttempt by remember { mutableStateOf(0) }
    LaunchedEffect(store, loadAttempt) {
        loadError = false
        try {
            store.data.collect { saved = it }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            loadError = true
        }
    }
    val display = saved?.display ?: DisplaySettings()
    val theme = remember {
        LabThemeState(initialLabColors(display.preferences), display.preferences)
    }
    var themeError by remember { mutableStateOf(false) }
    var themeAttempt by remember { mutableStateOf(0) }
    LaunchedEffect(host, display.preferences, themeAttempt) {
        try {
            theme.update(host, display.preferences)
            themeError = false
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            themeError = true
        }
    }
    val scope = rememberCoroutineScope()
    val trigger = remember { FocusRequester() }
    val appearanceTrigger = remember { FocusRequester() }
    var showingAppearance by rememberSaveable { mutableStateOf(false) }
    val name = rememberTextFieldState()
    val email = rememberTextFieldState()
    val description = rememberTextFieldState()
    var notifications by rememberSaveable { mutableStateOf(true) }
    var open by rememberSaveable { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var nameError by rememberSaveable { mutableStateOf<String?>(null) }
    var emailError by rememberSaveable { mutableStateOf<String?>(null) }
    var saveError by rememberSaveable { mutableStateOf(false) }
    var displayError by remember { mutableStateOf(false) }
    var snackbar by remember { mutableStateOf<String?>(null) }
    var notificationKey by remember { mutableStateOf(0) }
    var undoChange by remember { mutableStateOf<WorkspaceChange?>(null) }
    var undoing by remember { mutableStateOf(false) }
    val font = labFontFamily()
    val heading =
        TextStyle(
            fontFamily = font,
            fontSize = 28.sp,
            fontWeight = FontWeight.SemiBold,
            color = theme.colors["label-primary"],
            lineHeight = 34.sp,
        )
    val body =
        TextStyle(
            fontFamily = font,
            fontSize = 16.sp,
            color = theme.colors["label-secondary"],
            lineHeight = 24.sp,
        )
    val title = heading.copy(fontSize = 20.sp, lineHeight = 28.sp)
    val caption = body.copy(fontSize = 13.sp, lineHeight = 18.sp)
    val switchRow = Modifier.fillMaxWidth().heightIn(min = 48.dp)
    fun edit() {
        val workspace = saved?.workspace ?: return
        name.edit { replace(0, length, workspace.name) }
        email.edit { replace(0, length, workspace.email) }
        description.edit { replace(0, length, workspace.description) }
        notifications = workspace.notifications
        nameError = null
        emailError = null
        saveError = false
        snackbar = null
        undoChange = null
        showingAppearance = false
        open = true
    }
    fun changeDisplay(change: (DisplaySettings) -> DisplaySettings) {
        scope.launch {
            try {
                store.updateDisplay(change)
                displayError = false
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                displayError = true
            }
        }
    }
    val appearanceControls: @Composable () -> Unit = {
        Column(
            Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Column {
                LabSwitch(
                    theme.preferences.appearance == LabAppearance.Dark,
                    { value ->
                        changeDisplay {
                            it.copy(
                                preferences =
                                    it.preferences.copy(
                                        appearance =
                                            if (value) LabAppearance.Dark else LabAppearance.Light
                                    )
                            )
                        }
                    },
                    "Тёмная тема",
                    modifier = switchRow,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                BasicText("Материал", style = caption)
                FlowRow(
                    Modifier.selectableGroup(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    for (kind in LabMaterial.entries) LabButton(
                        when (kind) {
                            LabMaterial.Solid -> "Плотный"
                            LabMaterial.Acrylic -> "Матовый"
                            LabMaterial.Glass -> "Стекло"
                        },
                        { changeDisplay { it.copy(material = kind) } },
                        Modifier.semantics {
                            selected = kind == display.material
                        },
                        intent = LabIntent.Neutral,
                        kind =
                            if (kind == display.material) LabButtonKind.Fill
                            else LabButtonKind.Ghost,
                        size = LabControlSize.Small,
                    )
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                BasicText("Доступность", style = title)
                Column {
                    LabSwitch(
                        theme.preferences.increasedContrast,
                        { value ->
                            changeDisplay {
                                it.copy(
                                    preferences = it.preferences.copy(increasedContrast = value)
                                )
                            }
                        },
                        "Высокий контраст",
                        modifier = switchRow,
                    )
                    LabSwitch(
                        theme.preferences.reducedMotion,
                        { value ->
                            changeDisplay {
                                it.copy(preferences = it.preferences.copy(reducedMotion = value))
                            }
                        },
                        "Меньше движения",
                        modifier = switchRow,
                    )
                    LabSwitch(
                        theme.preferences.reducedTransparency,
                        { value ->
                            changeDisplay {
                                it.copy(
                                    preferences = it.preferences.copy(reducedTransparency = value)
                                )
                            }
                        },
                        "Меньше прозрачности",
                        modifier = switchRow,
                    )
                }
            }
            if (displayError)
                BasicText(
                    "Не удалось сохранить вид. Попробуйте ещё раз.",
                    style = body,
                )
            if (themeError) {
                BasicText("Не удалось применить оформление.", style = body)
                LabButton(
                    "Повторить",
                    { themeAttempt++ },
                    kind = LabButtonKind.Ghost,
                )
            }
        }
    }
    LabTheme(theme, font) {
        LabScene(
            Modifier.fillMaxSize(),
            background = {
                Box(
                    Modifier.fillMaxSize()
                        .background(theme.colors["bg-primary"])
                        .background(
                            Brush.linearGradient(
                                listOf(
                                    theme.colors["bg-primary"],
                                    theme.colors["fill-accent-tinted"],
                                    theme.colors["bg-secondary"],
                                )
                            )
                        )
                )
            },
        ) {
            LabSheetHost(
                open,
                if (showingAppearance) "Оформление" else "Настройки пространства",
                { if (!saving) open = false },
                if (showingAppearance) appearanceTrigger else trigger,
                modifier = Modifier.fillMaxSize(),
                material = display.material,
                size = LabSheetSize.Flex,
                dismissible = !saving,
                content = {
                    Column(
                        Modifier.fillMaxSize()
                            .safeDrawingPadding()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp, vertical = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Column(
                            Modifier.widthIn(max = 640.dp).fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(24.dp),
                        ) {
                            FlowRow(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                BasicText("Настройки", style = title)
                                LabButton(
                                    "Оформление",
                                    {
                                        showingAppearance = true
                                        open = true
                                    },
                                    Modifier.focusRequester(appearanceTrigger),
                                    kind = LabButtonKind.Ghost,
                                    intent = LabIntent.Neutral,
                                    size = LabControlSize.Small,
                                    icon = { Icon(settings, tint = color, size = size) },
                                )
                            }
                            val current = saved
                            if (current == null) {
                                if (loadError) {
                                    BasicText("Не удалось прочитать настройки.", style = body)
                                    LabButton("Повторить", { loadAttempt++ })
                                } else BasicText("Загружаем настройки…", style = body)
                            } else {
                                LabCard(
                                    LabMaterials.elevated,
                                    Modifier.fillMaxWidth(),
                                    display.material,
                                ) {
                                    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            BasicText("Пространство", style = caption)
                                            BasicText(current.workspace.name, style = heading)
                                            if (current.workspace.description.isNotBlank())
                                                BasicText(
                                                    current.workspace.description,
                                                    style = body,
                                                )
                                        }
                                        Box(
                                            Modifier.fillMaxWidth()
                                                .height(1.dp)
                                                .background(theme.colors["border-base"])
                                        )
                                        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                            Column(
                                                verticalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                BasicText("Почта для уведомлений", style = caption)
                                                BasicText(
                                                    current.workspace.email.ifBlank {
                                                        "Не указана"
                                                    },
                                                    style =
                                                        body.copy(
                                                            color = theme.colors["label-primary"]
                                                        ),
                                                )
                                            }
                                            BasicText(
                                                if (current.workspace.notifications)
                                                    "Уведомления включены"
                                                else "Уведомления выключены",
                                                style = body,
                                            )
                                        }
                                        LabButton(
                                            "Редактировать",
                                            ::edit,
                                            Modifier.focusRequester(trigger),
                                            icon = { Icon(pencil, tint = color, size = size) },
                                        )
                                    }
                                }
                            }
                        }
                    }
                },
                sheet = {
                    if (showingAppearance) {
                        appearanceControls()
                    } else {
                        LabInput(name, "Название", error = nameError, readOnly = saving)
                        LabInput(description, "Описание", singleLine = false, readOnly = saving)
                        LabInput(
                            email,
                            "Почта для уведомлений",
                            error = emailError,
                            readOnly = saving,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        )
                        LabSwitch(
                            notifications,
                            { notifications = it },
                            "Получать уведомления",
                            modifier = switchRow,
                            enabled = !saving,
                        )
                        if (saveError)
                            BasicText(
                                "Не удалось сохранить изменения. Попробуйте ещё раз.",
                                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                                style = body.copy(color = theme.colors["label-danger"]),
                            )
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            LabButton(
                                "Сохранить",
                                {
                                    if (saving) return@LabButton
                                    nameError =
                                        if (name.text.isBlank()) "Введите название" else null
                                    val address = email.text.toString().trim()
                                    emailError =
                                        if (
                                            (notifications || address.isNotBlank()) &&
                                                !address.matches(
                                                    Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
                                                )
                                        )
                                            "Проверьте адрес почты"
                                        else null
                                    if (nameError == null && emailError == null) {
                                        saving = true
                                        saveError = false
                                        val next =
                                            Workspace(
                                                name.text.toString(),
                                                address,
                                                description.text.toString(),
                                                notifications,
                                            )
                                        scope.launch {
                                            try {
                                                undoChange = store.save(next)
                                                open = false
                                                notificationKey++
                                                snackbar = "Изменения сохранены"
                                            } catch (cancelled: CancellationException) {
                                                throw cancelled
                                            } catch (_: Exception) {
                                                saveError = true
                                            } finally {
                                                saving = false
                                            }
                                        }
                                    }
                                },
                                loading = saving,
                                icon = { Icon(checkmark, tint = color, size = size) },
                            )
                            LabButton(
                                "Отмена",
                                { open = false },
                                enabled = !saving,
                                kind = LabButtonKind.Border,
                                intent = LabIntent.Neutral,
                            )
                        }
                    }
                },
            )
            snackbar?.let { message ->
                LabSnackbar(
                    message,
                    Modifier.align(Alignment.BottomCenter)
                        .safeDrawingPadding()
                        .padding(24.dp)
                        .widthIn(max = 560.dp),
                    onDismiss = { snackbar = null; undoChange = null },
                    notificationKey = notificationKey,
                    material = display.material,
                    actionLabel = if (undoChange != null) "Отменить" else null,
                    dismissOnAction = false,
                    actionPending = undoing,
                    restoreFocus = trigger,
                    onAction = {
                        val change = undoChange
                        if (change != null && !undoing) {
                            undoing = true
                            scope.launch {
                                try {
                                    val restored = store.undo(change)
                                    undoChange = null
                                    trigger.requestFocus()
                                    notificationKey++
                                    snackbar = if (restored) "Изменения отменены"
                                        else "Настройки уже изменились"
                                } catch (cancelled: CancellationException) {
                                    throw cancelled
                                } catch (_: Exception) {
                                    notificationKey++
                                    snackbar = "Не удалось отменить. Попробуйте ещё раз."
                                } finally { undoing = false }
                            }
                        }
                    },
                )
            }
        }
    }
}
