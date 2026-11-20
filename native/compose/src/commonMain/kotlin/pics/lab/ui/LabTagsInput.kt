package pics.lab.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.TextFieldDecorator
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException

private data class EditingTag(val index: Int, val original: String)
private class TagsPasteLifetime(var attached: Boolean = true, var revision: Long = 0)

/** Controlled tags with one real editor. A rejected change retains its editable draft. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
public fun LabTagsInput(
    value: List<String>,
    onValueChange: (List<String>) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    state: TextFieldState = rememberTextFieldState(),
    max: Int = Int.MAX_VALUE,
    delimiter: String = ",",
    editable: Boolean = true,
    addOnPaste: Boolean = false,
    allowDuplicates: Boolean = false,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    size: LabControlSize = LabControlSize.Medium,
    helper: String? = null,
    error: String? = null,
    placeholder: String? = null,
    removeLabel: (String) -> String = { "Удалить $it" },
    editLabel: (String) -> String = { "Редактировать $it" },
    duplicateMessage: String = "Такая метка уже добавлена",
    limitMessage: (Int) -> String = { "Можно добавить не больше $it меток" },
    changedMessage: String = "Редактируемая метка изменилась. Отмените редактирование и повторите его.",
) {
    require(max >= 0) { "Tags Input maximum must not be negative" }
    require(delimiter.isNotEmpty()) { "Tags Input delimiter must not be empty" }
    require(label.isNotBlank()) { "Tags Input needs an accessible label" }
    val writable = enabled && !readOnly
    val focus = remember { FocusRequester() }
    val composition = rememberInputCompositionGuard(state)
    val direction = LocalLayoutDirection.current
    var focused by remember { mutableStateOf(false) }
    var active by remember { mutableStateOf<Int?>(null) }
    var editing by remember { mutableStateOf<EditingTag?>(null) }
    var request by remember { mutableStateOf<InputValuesRequest?>(null) }
    var observedText by remember(state) { mutableStateOf(state.text.toString()) }
    var validation by remember { mutableStateOf<String?>(null) }
    val pasteLifetime = remember(state) { TagsPasteLifetime() }
    val currentWritable by rememberUpdatedState(writable)
    val currentAddOnPaste by rememberUpdatedState(addOnPaste)
    val currentOnValueChange by rememberUpdatedState(onValueChange)
    DisposableEffect(pasteLifetime, writable, value, max, delimiter, allowDuplicates, editing, addOnPaste) {
        pasteLifetime.attached = true
        onDispose { pasteLifetime.attached = false; pasteLifetime.revision++ }
    }
    fun setDraft(text: String) {
        observedText = text
        if (state.text.toString() != text) state.setTextAndPlaceCursorAtEnd(text)
    }
    fun commit(parts: List<String>): Boolean {
        if (!writable || composition.active()) return false
        val additions = parts.map { it.trim() }.filter { it.isNotEmpty() }
        if (additions.isEmpty()) return false
        val edit = editing
        if (edit != null && value.getOrNull(edit.index) != edit.original) {
            validation = changedMessage
            return false
        }
        val proposed = if (edit == null) value + additions else value.take(edit.index) + additions + value.drop(edit.index + 1)
        if (proposed.size > max) { validation = limitMessage(max); return false }
        if (!allowDuplicates && proposed.distinct().size != proposed.size) { validation = duplicateMessage; return false }
        validation = null
        request = InputValuesRequest(proposed, state.text.toString())
        currentOnValueChange(proposed)
        return true
    }
    fun remove(index: Int) {
        if (!writable || composition.active() || index !in value.indices) return
        request = null
        currentOnValueChange(value.filterIndexed { position, _ -> position != index })
        focus.requestFocus()
    }
    fun edit(index: Int): Boolean {
        if (!writable || !editable || composition.active() || index !in value.indices) return false
        editing = EditingTag(index, value[index])
        active = null
        validation = null
        request = null
        setDraft(value[index])
        state.edit { selection = TextRange(0, length) }
        focus.requestFocus()
        return true
    }
    LaunchedEffect(value, request, state.composition) {
        val pending = request
        if (pending != null && pending.proposed == value && pending.draft == state.text.toString() && state.composition == null) {
            setDraft("")
            request = null
            editing = null
            active = null
        }
        if (value.isEmpty()) active = null
        else active = active?.coerceAtMost(value.lastIndex)
    }
    LaunchedEffect(state.text, state.composition, writable) {
        val text = state.text.toString()
        val changed = text != observedText
        observedText = text
        if (changed) { active = null; validation = null; request = null }
        if (!writable || !focused || state.composition != null) return@LaunchedEffect
        if (changed && text.endsWith(delimiter)) {
            commit(listOf(text.removeSuffix(delimiter)))
        }
    }
    val pasteAccess = rememberInputPasteAccess { readText ->
        val revision = ++pasteLifetime.revision
        val before = state.text.toString()
        val selection = state.selection
        val composingRange = state.composition
        val composing = composition.active()
        val canStart = currentWritable && focused && pasteLifetime.attached
        val inserted = try { readText() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { null }
        if (canStart && currentWritable && focused && pasteLifetime.attached &&
            revision == pasteLifetime.revision && state.text.toString() == before &&
            state.selection == selection && state.composition == composingRange && !inserted.isNullOrEmpty()) {
            state.edit {
                replace(selection.min, selection.max, inserted)
                this.selection = TextRange(selection.min + inserted.length)
            }
            // A receipt follows the completed edit. No stale clipboard-read marker can
            // reinterpret later typing, IME, an empty clipboard, or a cancelled request.
            observedText = state.text.toString()
            active = null; validation = null; request = null
            if (currentAddOnPaste && !composing)
                commit(observedText.split(Regex("${Regex.escape(delimiter)}|\\r\\n|\\r|\\n")))
        }
    }
    val fieldModifier = Modifier.focusRequester(focus).onFocusChanged {
        if (focused != it.isFocused) pasteLifetime.revision++
        focused = it.isFocused
        if (!it.isFocused) active = null
    }.then(pasteAccess.modifier).onPreviewKeyEvent { event ->
        if (!writable || event.type != KeyEventType.KeyDown || composition.active()) false
        else when (event.key) {
            Key.Enter, Key.NumPadEnter -> {
                val index = active
                if (index != null) edit(index) else commit(listOf(state.text.toString()))
                true
            }
            Key.Escape -> when {
                editing != null -> { editing = null; validation = null; request = null; setDraft(""); true }
                active != null -> { active = null; true }
                else -> false
            }
            Key.Backspace -> if (state.text.isEmpty() && editing == null) {
                val index = active
                if (index != null) remove(index) else active = value.lastIndex.takeIf { it >= 0 }
                value.isNotEmpty()
            } else false
            Key.Delete -> active?.let { remove(it); true } ?: false
            Key.DirectionLeft, Key.DirectionRight -> {
                val previous = event.key == if (direction == LayoutDirection.Ltr) Key.DirectionLeft else Key.DirectionRight
                val index = active
                if (editing == null && state.selection.collapsed && (index != null || state.selection.start == 0)) {
                    if (previous) active = if (index == null) value.lastIndex.takeIf { it >= 0 } else (index - 1).coerceAtLeast(0)
                    else if (index != null) active = (index + 1).takeIf { it < value.size }
                    previous && value.isNotEmpty() || index != null
                } else false
            }
            else -> false
        }
    }.semantics {
        stateDescription = active?.let { value.getOrNull(it) } ?: value.joinToString(", ")
    }
    CompositionLocalProvider(LocalClipboard provides pasteAccess.clipboard) {
    LabInput(state, label, modifier, enabled = enabled, readOnly = readOnly, size = size,
        helper = helper, error = error ?: validation, placeholder = placeholder, inputModifier = fieldModifier,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        onKeyboardAction = KeyboardActionHandler {
            if (writable && !composition.active()) commit(listOf(state.text.toString()))
        },
        contentDecorator = TextFieldDecorator { editor ->
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp),
                verticalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp),
                itemVerticalAlignment = Alignment.CenterVertically) {
                value.forEachIndexed { index, tag -> key(index, tag) {
                    if (editing?.let { it.index == index && it.original == tag } != true) {
                        LabChip(tag, Modifier.focusProperties { canFocus = false }.semantics {
                            if (editable && writable) customActions = listOf(CustomAccessibilityAction(editLabel(tag)) { edit(index) })
                        }, mode = LabChipMode.Remove, selected = true, size = LabChipSize.Small, sharp = true,
                            active = active == index, enabled = enabled, readOnly = readOnly,
                            accessibilityLabel = if (readOnly) tag else removeLabel(tag), onRemove = { remove(index) })
                    }
                } }
                Box(Modifier.weight(1f).widthIn(min = if (writable) with(LocalDensity.current) { (size.inputMetrics().fontSize * 4).sp.toDp() } else 0.dp)) { editor() }
            }
        })
    }
}
