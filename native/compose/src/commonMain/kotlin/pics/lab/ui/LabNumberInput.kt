package pics.lab.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.*
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

/**
 * Decimal editor with the authored Input geometry and one application-owned state.
 * Drafts and IME composition are preserved. Blur, Enter and IME Done normalize a
 * valid decimal and clamp it to [min]/[max]; an empty field stays empty. Invalid
 * drafts stay editable and show [invalidMessage]. External [error] takes priority.
 *
 * Bounds and a positive [step] must be finite. Decimal addition does not accumulate
 * binary rounding (ten 0.1 steps produce 1). Text accepts dot-decimal and exponent
 * notation, up to 1024 characters/expanded digits; nonfinite and underflow values
 * are invalid. Steps that overflow or cannot change the finite Double value are
 * unavailable. Page Up/Down apply ten steps in one operation. Empty step actions
 * initialize zero clamped to the bounds. Direct edits do not snap to a step grid.
 */
@Composable
public fun LabNumberInput(
    state: TextFieldState,
    label: String,
    modifier: Modifier = Modifier,
    min: Double? = null,
    max: Double? = null,
    step: Double = 1.0,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    size: LabControlSize = LabControlSize.Medium,
    helper: String? = null,
    error: String? = null,
    placeholder: String? = null,
    decreaseLabel: String = "Уменьшить значение",
    increaseLabel: String = "Увеличить значение",
    invalidMessage: String = "Введите конечное число",
) {
    require(label.isNotBlank()) { "Number Input needs an accessible label" }
    val rules = remember(min, max, step) { NumberInputRules(min, max, step) }
    val focus = remember { FocusRequester() }
    val composition = rememberInputCompositionGuard(state)
    val writable = enabled && !readOnly
    var focused by remember(state) { mutableStateOf(false) }
    var pendingBlur by remember(state) { mutableStateOf(false) }
    var invalidDraft by remember(state) { mutableStateOf<String?>(null) }
    val draft = state.text.toString()
    val decrease = remember(rules, draft) { rules.move(draft, -1) }
    val increase = remember(rules, draft) { rules.move(draft, 1) }
    fun replace(text: String) {
        invalidDraft = null
        if (state.text.toString() != text) state.setTextAndPlaceCursorAtEnd(text)
    }
    fun commit() {
        if (!writable || state.composition != null) return
        val text = state.text.toString()
        val normalized = rules.commit(text)
        if (normalized == null) invalidDraft = text else replace(normalized)
    }
    fun move(direction: Int, page: Boolean = false): Boolean {
        if (!writable || composition.active()) return false
        val next = rules.move(state.text.toString(), direction, page) ?: return false
        replace(next)
        focus.requestFocus()
        return true
    }
    LaunchedEffect(focused, state.composition, pendingBlur) {
        if (pendingBlur && !focused && state.composition == null) {
            pendingBlur = false
            commit()
        }
    }
    val canDecrease = writable && state.composition == null && decrease != null
    val canIncrease = writable && state.composition == null && increase != null
    val fieldModifier = Modifier.focusRequester(focus).onFocusChanged {
        val lost = focused && !it.isFocused
        focused = it.isFocused
        if (it.isFocused) pendingBlur = false
        if (lost) {
            if (composition.active()) pendingBlur = true else commit()
        }
    }.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown || !writable || composition.active() ||
            event.isAltPressed || event.isCtrlPressed || event.isMetaPressed || event.isShiftPressed) false
        else when (event.key) {
            Key.DirectionUp -> { move(1); true }
            Key.DirectionDown -> { move(-1); true }
            Key.PageUp -> { move(1, page = true); true }
            Key.PageDown -> { move(-1, page = true); true }
            Key.Enter, Key.NumPadEnter -> { commit(); true }
            else -> false
        }
    }.semantics {
        customActions = buildList {
            if (canDecrease) add(CustomAccessibilityAction(decreaseLabel) { move(-1) })
            if (canIncrease) add(CustomAccessibilityAction(increaseLabel) { move(1) })
        }
    }
    LabInput(state, label, modifier, enabled = enabled, readOnly = readOnly, size = size,
        helper = helper, error = error ?: invalidMessage.takeIf { invalidDraft != null && invalidDraft == draft },
        placeholder = placeholder, inputModifier = fieldModifier,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
        onKeyboardAction = { performDefaultAction ->
            if (!composition.active()) commit()
            performDefaultAction()
        },
        trailing = {
            Row(horizontalArrangement = Arrangement.spacedBy(LabComponents.SelectMultipleGap.dp)) {
                InputAccessoryAction(decreaseLabel, canDecrease, size, { move(-1) }) { InputChevron(false, it) }
                InputAccessoryAction(increaseLabel, canIncrease, size, { move(1) }) { InputChevron(true, it) }
            }
        })
}
