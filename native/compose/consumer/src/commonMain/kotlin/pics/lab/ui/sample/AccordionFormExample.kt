package pics.lab.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabAccordion
import pics.lab.ui.LabAccordionItem
import pics.lab.ui.LabCard
import pics.lab.ui.LabInput
import pics.lab.ui.LabMaterial
import pics.lab.ui.LabMaterials
import pics.lab.ui.LabScene
import pics.lab.ui.LabSwitch
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState

/** Public Maven consumer: the application accepts requests and each panel retains its draft. */
@Composable
fun AccordionFormExample(theme: LabThemeState, material: LabMaterial = LabMaterial.Solid) {
    var value by remember { mutableStateOf(listOf("delivery")) }
    var allowChange by remember { mutableStateOf(false) }
    LabTheme(theme) {
        LabScene(background = { Box(Modifier.fillMaxSize().background(theme.colors["bg-primary"])) }) {
            LabCard(LabMaterials.base, Modifier.fillMaxWidth().padding(16.dp), material, padding = PaddingValues(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    LabSwitch(allowChange, { allowChange = it }, "Разрешить переход")
                    LabAccordion(value, { if (allowChange) value = it }, listOf(
                        LabAccordionItem("delivery", "Доставка"),
                        LabAccordionItem("details", "Комментарий"),
                        LabAccordionItem("archive", "Архив", disabled = true),
                    )) { section ->
                        val draft = remember { TextFieldState(if (section == "delivery") "Текущий адрес" else "Новый текст") }
                        LabInput(draft, if (section == "delivery") "Адрес" else "Примечание", singleLine = false)
                    }
                }
            }
        }
    }
}
