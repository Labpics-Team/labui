package pics.lab.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.click
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.unit.dp
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Rule
import org.junit.Test

class ComponentsTest {
    @get:Rule val compose = createComposeRule()
    private val preferences = LabPreferences(reducedMotion = true)
    private val theme = LabThemeState(initialLabColors(preferences), preferences)
    private val recipe =
        LabMaterialRecipe(
            "bg-primary",
            "bg-primary",
            "bg-primary",
            12f,
            12f,
            80f,
            1f,
            .6f,
            -45f,
            .05f,
        )

    @Test
    fun loadingKeepsWidthAndCannotSubmitTwice() {
        var loading by mutableStateOf(false)
        var calls = 0
        compose.setContent {
            LabTheme(theme) { LabButton("Сохранить изменения", { calls++ }, loading = loading) }
        }
        val button = compose.onNodeWithText("Сохранить изменения")
        val width = button.fetchSemanticsNode().boundsInRoot.width
        button.performClick()
        compose.runOnIdle { loading = true }
        button.assertIsNotEnabled()
        assertEquals(width, button.fetchSemanticsNode().boundsInRoot.width)
        assertEquals(1, calls)
    }

    @Test
    fun validationAndThemeChangesPreserveTextAndSelection() {
        val input = TextFieldState()
        var error by mutableStateOf<String?>(null)
        compose.setContent {
            LabTheme(theme) { LabInput(input, "Название проекта", error = error) }
        }
        val field = compose.onNodeWithContentDescription("Название проекта")
        field.performClick().performTextInput("Лаборатория 東京")
        val selection = input.selection
        compose.runOnIdle { error = "Это название уже занято" }
        compose.onNodeWithText("Это название уже занято").assertIsDisplayed()
        assertEquals("Лаборатория 東京", input.text.toString())
        assertEquals(selection, input.selection)
        field.assertIsFocused()
    }

    @Test
    fun sheetDismissalRestoresInitiatorAndKeepsInput() {
        val field = TextFieldState("Сохранённый ввод")
        var open by mutableStateOf(false)
        compose.setContent {
            val trigger = remember { FocusRequester() }
            LabTheme(theme) {
                LabScene(Modifier.fillMaxSize(), background = {}) {
                    LabSheetHost(
                        open,
                        "Настройки",
                        { open = false },
                        trigger,
                        recipe,
                        modifier = Modifier.fillMaxSize(),
                        material = LabMaterial.Solid,
                        content = {
                            LabButton(
                                "Открыть настройки",
                                { open = true },
                                Modifier.focusRequester(trigger),
                            )
                        },
                        sheet = {
                            LabInput(field, "Имя")
                            LabButton("Готово", { open = false })
                        },
                    )
                }
            }
        }
        compose.onNodeWithText("Открыть настройки").performClick()
        compose.onNodeWithText("Закрыть").assertIsFocused()
        compose.onNodeWithText("Закрыть").performKeyInput {
            keyDown(Key.ShiftLeft)
            pressKey(Key.Tab)
            keyUp(Key.ShiftLeft)
        }
        compose.onNodeWithText("Готово").assertIsFocused()
        compose.onNodeWithText("Готово").performKeyInput { pressKey(Key.Tab) }
        compose.onNodeWithText("Закрыть").assertIsFocused()
        compose.onNodeWithContentDescription("Имя").performClick().performTextInput("!")
        compose.onNodeWithContentDescription("Имя").performKeyInput { pressKey(Key.Escape) }
        compose.onNodeWithText("Открыть настройки").assertIsFocused()
        assertTrue(field.text.contains("!"))
    }

    @Test
    fun sheetOnlyDismissesForOutsideTaps() {
        var open by mutableStateOf(false)
        compose.setContent {
            val trigger = remember { FocusRequester() }
            LabTheme(theme) {
                LabScene(Modifier.fillMaxSize(), background = {}) {
                    LabSheetHost(
                        open,
                        "Настройки",
                        { open = false },
                        trigger,
                        modifier = Modifier.fillMaxSize(),
                        material = LabMaterial.Solid,
                        content = {
                            LabButton("Открыть", { open = true }, Modifier.focusRequester(trigger))
                        },
                        sheet = {
                            Box(Modifier.fillMaxWidth().height(160.dp).testTag("sheet-space"))
                        },
                    )
                }
            }
        }
        compose.onNodeWithText("Открыть").performClick()
        compose.onNodeWithTag("sheet-space").performTouchInput { click(center) }
        compose.onNodeWithText("Закрыть").assertIsDisplayed()
        compose.onNode(isDialog()).performTouchInput { click(Offset(8f, 8f)) }
        compose.onNodeWithText("Открыть").assertIsFocused()
    }

    @Test
    fun multilineInputUsesTabForNavigationAndEnterForNewlines() {
        val input = TextFieldState("Описание")
        compose.setContent {
            LabTheme(theme) {
                Column {
                    LabButton("Назад", {})
                    LabInput(input, "Описание проекта", singleLine = false)
                    LabButton("Продолжить", {})
                }
            }
        }
        val field = compose.onNodeWithContentDescription("Описание проекта")
        field.performClick().performKeyInput { pressKey(Key.Enter) }
        assertTrue(input.text.contains('\n'))
        val beforeTab = input.text.toString()
        field.performKeyInput { pressKey(Key.Tab) }
        compose.onNodeWithText("Продолжить").assertIsFocused()
        assertEquals(beforeTab, input.text.toString())
        compose.onNodeWithText("Продолжить").performKeyInput {
            keyDown(Key.ShiftLeft)
            pressKey(Key.Tab)
            keyUp(Key.ShiftLeft)
        }
        field.assertIsFocused()
        field.performKeyInput {
            keyDown(Key.ShiftLeft)
            pressKey(Key.Tab)
            keyUp(Key.ShiftLeft)
        }
        compose.onNodeWithText("Назад").assertIsFocused()
        assertEquals(beforeTab, input.text.toString())
    }
}
