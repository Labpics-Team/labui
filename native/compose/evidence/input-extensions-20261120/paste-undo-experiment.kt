@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class, androidx.compose.ui.ExperimentalComposeUiApi::class)

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.asAwtTransferable
import androidx.compose.ui.text.TextRange
import java.awt.datatransfer.DataFlavor
import java.awt.datatransfer.StringSelection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

suspend fun ClipEntry.decode(): String? {
    val transferable = asAwtTransferable ?: return null
    if (!transferable.isDataFlavorSupported(DataFlavor.stringFlavor)) return null
    return withContext(Dispatchers.IO) { transferable.getTransferData(DataFlavor.stringFlavor) as? String }
}

fun main() = runBlocking {
    val state = TextFieldState("original", TextRange(8))
    state.edit { replace(0, length, "before middle after"); selection = TextRange(7, 13) }
    val clipboardText = ClipEntry(StringSelection("alpha,beta")).decode()!!
    state.edit {
        val start = selection.min
        replace(selection.min, selection.max, clipboardText)
        selection = TextRange(start + clipboardText.length)
    }
    check(state.text.toString() == "before alpha,beta after")
    check(state.selection == TextRange(17))
    check(state.undoState.canUndo)
    state.undoState.undo()
    check(state.text.toString() == "before middle after")
    check(state.selection == TextRange(7, 13))
    state.undoState.undo()
    check(state.text.toString() == "original")
    check(state.selection == TextRange(8))
    state.undoState.redo()
    state.undoState.redo()
    check(state.text.toString() == "before alpha,beta after")
    check(state.selection == TextRange(17))
    println("PASS public desktop decoder; selected-range replacement; paste undo selection; earlier history; redo")
}
