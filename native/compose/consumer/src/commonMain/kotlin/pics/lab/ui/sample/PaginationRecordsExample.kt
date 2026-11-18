package pics.lab.ui.sample

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import pics.lab.ui.LabPagination
import pics.lab.ui.LabType

/** A Maven consumer: the selected page changes the records actually shown. */
@Composable
fun PaginationRecordsExample() {
    val records = remember { List(24) { "Исследование ${it + 1}" } }
    var page by remember { mutableStateOf(1) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BasicText("Исследования", style = LabType.body())
        records.drop((page - 1) * 3).take(3).forEach { BasicText(it, style = LabType.body()) }
        LabPagination(page, { page = it }, records.size, pageSize = 3, label = "Страницы исследований",
            previousLabel = "Предыдущая страница", nextLabel = "Следующая страница", pageLabel = { "Страница $it" })
    }
}
