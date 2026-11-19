package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicSecureTextField
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.TextFieldDecorator
import androidx.compose.foundation.text.input.TextObfuscationMode
import androidx.compose.foundation.text.input.delete
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.foundation.text.input.then
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pics.lab.motion.MotionEase
import pics.lab.motion.MotionTransition

public enum class LabPinValueType { Numeric, Alphabetic, Alphanumeric }

/** A single native editor preserves IME, selection, paste, autofill and keyboard navigation.
 * The authored cells are decoration; accessibility sees one named editable code.
 * Programmatic changes/reset use TextFieldState.edit, exactly like LabInput.
 */
@Composable
public fun LabPinInput(
    state: TextFieldState,
    label: String,
    modifier: Modifier = Modifier,
    count: Int = 4,
    size: LabControlSize = LabControlSize.Medium,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    mask: Boolean = false,
    otp: Boolean = false,
    valueType: LabPinValueType = LabPinValueType.Numeric,
    labelHidden: Boolean = false,
    helper: String? = null,
    error: String? = null,
) {
    require(count in 1..32) { "Pin Input count must be between 1 and 32" }
    val theme = LocalLabTheme.current
    val colors = theme.colors
    val metrics = when (size) {
        LabControlSize.Small -> LabComponents.PinInputS
        LabControlSize.Medium -> LabComponents.PinInputM
        LabControlSize.Large -> LabComponents.PinInputL
    }
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val focus = remember { FocusRequester() }
    val motion = rememberLabMotion()
    val selectionColors = LocalTextSelectionColors.current
    // InputTransformation covers user/IME edits only. Normalize external edits
    // after this composition applies its count; an independent observer could
    // truncate a simultaneous count increase + text update with the old limit.
    // Valid selection/composition state is never edited.
    if (state.text.length > count) SideEffect {
        state.edit {
            if (length > count) {
                val previousSelection = selection
                delete(count, length)
                selection = TextRange(previousSelection.start.coerceAtMost(count), previousSelection.end.coerceAtMost(count))
            }
        }
    }
    val transform = remember(count, valueType) {
        InputTransformation.maxLength(count).then {
            if (asCharSequence().any { char -> when (valueType) {
                LabPinValueType.Numeric -> char !in '0'..'9'
                LabPinValueType.Alphabetic -> char !in 'a'..'z' && char !in 'A'..'Z'
                LabPinValueType.Alphanumeric -> char !in '0'..'9' && char !in 'a'..'z' && char !in 'A'..'Z'
            } }) revertAllChanges()
        }
    }
    val body = LabType.body().withTypography(fontSize = metrics.fontSize.sp,
        lineHeight = metrics.lineHeight.sp, fontWeight = FontWeight(metrics.fontWeight.toInt()),
        letterSpacing = metrics.letterSpacing.sp, color = colors[if (enabled)
            LabComponents.PinInputRolesLabel else LabComponents.PinInputRolesDisabledLabel])
    val caption = LabType.caption().withTypography(fontSize = LabComponents.PinInputCaptionFontSize.sp,
        lineHeight = LabComponents.PinInputCaptionLineHeight.sp,
        fontWeight = FontWeight(LabComponents.PinInputCaptionFontWeight.toInt()),
        letterSpacing = LabComponents.PinInputCaptionLetterSpacing.sp,
        color = colors[LabComponents.PinInputRolesCaption])
    Column(modifier, verticalArrangement = Arrangement.spacedBy(LabComponents.PinInputFieldGap.dp)) {
        if (!labelHidden) LabText(label, style = caption, modifier = Modifier.clearAndSetSemantics {})
        val editorModifier = Modifier.focusRequester(focus).semantics {
            contentDescription = label
            if (error != null) error(error)
            if (otp) contentType = ContentType.SmsOtpCode
        }
        val keyboard = KeyboardOptions(keyboardType = if (valueType == LabPinValueType.Numeric)
            if (mask) KeyboardType.NumberPassword else KeyboardType.Number else KeyboardType.Ascii)
        val decoration = TextFieldDecorator { editor ->
                Box {
                    Box(Modifier.matchParentSize().alpha(0f)) { editor() }
                    Row(horizontalArrangement = Arrangement.spacedBy(metrics.gap.dp),
                        modifier = Modifier.clearAndSetSemantics {}) {
                        repeat(count) { index ->
                            val cellInteractions = remember { MutableInteractionSource() }
                            val hovered by cellInteractions.collectIsHoveredAsState()
                            val hover = remember(motion, index) { motion.value(0f, "pin.hover.$index") }
                            LaunchedEffect(hovered, enabled, readOnly, theme.preferences.reducedMotion) {
                                val playback = motion.animate {
                                    to(hover, if (hovered && enabled && !readOnly) 1f else 0f,
                                        MotionTransition.Tween(LabTokens.MotionTransitionDurationMs.toInt(), MotionEase.Bezier(
                                            LabTokens.MotionTransitionEase0, LabTokens.MotionTransitionEase1,
                                            LabTokens.MotionTransitionEase2, LabTokens.MotionTransitionEase3)))
                                }
                                try { playback.finished.await() } finally { playback.stop() }
                            }

                            val character = state.text.getOrNull(index)
                            val selection = state.selection
                            val active = focused && selection.collapsed && index == selection.end.coerceAtMost(count - 1)
                            val selected = focused && enabled && index >= selection.min && index < selection.max
                            val border = colors[when {
                                !enabled -> LabComponents.PinInputRolesDisabledBorder
                                error != null -> LabComponents.PinInputRolesDanger
                                character != null || active -> LabComponents.PinInputRolesActiveBorder
                                else -> LabComponents.PinInputRolesBorder
                            }]
                            val shape = RoundedCornerShape(metrics.radius.dp)
                            val background = colors[if (readOnly) LabComponents.PinInputRolesReadonlyBackground
                                else LabComponents.PinInputRolesBackground]
                            Box(Modifier.hoverable(cellInteractions, enabled = enabled && !readOnly).width(metrics.width.dp).heightIn(min = metrics.height.dp)
                                .background(background, shape)
                                .drawWithContent {
                                    drawRoundRect(colors[LabComponents.PinInputRolesHover].copy(
                                        alpha = colors[LabComponents.PinInputRolesHover].alpha * hover.value),
                                        cornerRadius = CornerRadius(metrics.radius.dp.toPx()))
                                    if (selected) drawRoundRect(selectionColors.backgroundColor,
                                        cornerRadius = CornerRadius(metrics.radius.dp.toPx()))
                                    drawContent()
                                    if (active && enabled) {
                                        val stroke = LabComponents.PinInputFocusWidth.dp.toPx()
                                        if (!readOnly) {
                                            val characterWidth = if (mask) metrics.dot.dp.toPx() else metrics.fontSize.sp.toPx()
                                            val cursorX = this.size.width / 2 + when {
                                                character == null -> 0f
                                                selection.end == count -> characterWidth / 2 + stroke
                                                else -> -characterWidth / 2 - stroke
                                            }
                                            val cursorHeight = metrics.lineHeight.sp.toPx().coerceAtMost(this.size.height)
                                            drawLine(selectionColors.handleColor,
                                                Offset(cursorX, (this.size.height - cursorHeight) / 2),
                                                Offset(cursorX, (this.size.height + cursorHeight) / 2),
                                                strokeWidth = stroke)
                                        }
                                        val outset = LabComponents.PinInputFocusOffset.dp.toPx() + stroke / 2
                                        drawRoundRect(colors[if (error != null) LabComponents.PinInputRolesDanger
                                            else LabComponents.PinInputRolesFocus], Offset(-outset, -outset),
                                            Size(this.size.width + outset * 2, this.size.height + outset * 2),
                                            CornerRadius(metrics.radius.dp.toPx() + outset), style = Stroke(stroke))
                                    }
                                }
                                .border(LabComponents.PinInputStrokeWidth.dp, border, shape)
                                .pointerInput(state, enabled, readOnly, index) {
                                    detectTapGestures { if (enabled) {
                                        focus.requestFocus()
                                        state.edit { this.selection = TextRange(index.coerceAtMost(length)) }
                                    } }
                                }, contentAlignment = Alignment.Center) {
                                if (character != null) {
                                    if (mask) Box(Modifier.size(metrics.dot.dp).background(body.color, CircleShape))
                                    else LabText(character.toString(), style = body)
                                }
                            }
                        }
                    }
                }
        }
        if (mask) BasicSecureTextField(state, editorModifier, enabled = enabled, readOnly = readOnly,
            inputTransformation = transform, textStyle = body.copy(color = Color.Transparent),
            keyboardOptions = keyboard, interactionSource = interactions, cursorBrush = SolidColor(Color.Transparent),
            textObfuscationMode = TextObfuscationMode.Hidden, decorator = decoration)
        else BasicTextField(state, editorModifier, enabled = enabled, readOnly = readOnly,
            inputTransformation = transform, textStyle = body.copy(color = Color.Transparent),
            keyboardOptions = keyboard, interactionSource = interactions, cursorBrush = SolidColor(Color.Transparent),
            lineLimits = TextFieldLineLimits.SingleLine, decorator = decoration)
        if (helper != null) LabText(helper, style = caption)
        if (error != null) LabText(error, style = caption.copy(color = colors["label-danger"]))
    }
}
