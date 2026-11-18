package pics.lab.ui

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** State-based input keeps selection and IME composition through validation and theme changes. */
@Composable
public fun LabInput(
    state: TextFieldState,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    helper: String? = null,
    error: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true,
    size: LabControlSize = LabControlSize.Medium,
    placeholder: String? = null,
) {
    val colors = LocalLabTheme.current.colors
    val focusManager = LocalFocusManager.current
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val metrics =
        when (size) {
            LabControlSize.Small -> LabComponents.InputS
            LabControlSize.Medium -> LabComponents.InputM
            LabControlSize.Large -> LabComponents.InputL
        }
    val shape = RoundedCornerShape(metrics.radius.dp)
    // The no-icon side slot keeps its width; center content adds the label inset.
    val contentStart = metrics.paddingX + LabComponents.InputLabelPaddingX
    val border =
        colors[
            when {
                !enabled -> "border-base"
                error != null -> "border-danger"
                focused -> "border-focus"
                hovered -> "border-strong"
                else -> "border-base"
            }]
    val caption =
        LabType.caption()
            .copy(
                color =
                    colors[
                        when {
                            !enabled -> "label-tertiary"
                            error != null -> "label-danger"
                            focused -> "label-accent"
                            else -> "label-secondary"
                        }],
                fontSize = LabComponents.InputLabelFontSize.sp,
                lineHeight = LabComponents.InputLabelLineHeight.sp,
                fontWeight = FontWeight(LabComponents.InputLabelFontWeight.toInt()),
                letterSpacing = 0.sp,
            )
    val body =
        LabType.body()
            .copy(
                color = colors[if (enabled) "label-primary" else "label-tertiary"],
                fontSize = metrics.fontSize.sp,
                lineHeight = metrics.lineHeight.sp,
                fontWeight = FontWeight(metrics.fontWeight.toInt()),
                letterSpacing = metrics.letterSpacing.sp,
            )
    val measurer = rememberTextMeasurer()
    val overhang = with(LocalDensity.current) { LabComponents.InputLabelOverhang.sp.toDp() }
    Column(
        modifier.padding(top = overhang),
        verticalArrangement = Arrangement.spacedBy(LabComponents.InputHelperGap.dp),
    ) {
        Box {
            BasicTextField(
                state = state,
                enabled = enabled,
                readOnly = readOnly,
                lineLimits =
                    if (singleLine) TextFieldLineLimits.SingleLine
                    else TextFieldLineLimits.MultiLine(),
                keyboardOptions = keyboardOptions,
                interactionSource = interactions,
                textStyle = body,
                cursorBrush = SolidColor(colors["label-accent"]),
                modifier =
                    Modifier.fillMaxWidth()
                        .onPreviewKeyEvent { event ->
                            if (event.key == Key.Tab && event.type == KeyEventType.KeyDown) {
                                focusManager.moveFocus(
                                    if (event.isShiftPressed) FocusDirection.Previous
                                    else FocusDirection.Next
                                )
                                true
                            } else false
                        }
                        .drawWithCache {
                            val padding = contentStart.dp.toPx()
                            val labelPadding = LabComponents.InputLabelPaddingX.dp.toPx()
                            val labelWidth =
                                measurer
                                    .measure(
                                        label,
                                        caption,
                                        maxLines = 1,
                                        constraints =
                                            Constraints(
                                                maxWidth =
                                                    (this.size.width -
                                                            padding -
                                                            metrics.paddingX.dp.toPx())
                                                        .toInt()
                                                        .coerceAtLeast(0)
                                            ),
                                    )
                                    .size
                                    .width
                            val outline = shape.createOutline(this.size, layoutDirection, this)
                            val stroke = LabComponents.InputStrokeWidth.dp.toPx()
                            onDrawWithContent {
                                drawContent()
                                // The notch reveals the actual material beneath the input; no
                                // painted patch.
                                clipRect(
                                    left = padding - labelPadding,
                                    top = -stroke,
                                    right = padding + labelWidth + labelPadding,
                                    bottom = stroke,
                                    clipOp = ClipOp.Difference,
                                ) {
                                    drawOutline(outline, border, style = Stroke(stroke))
                                }
                            }
                        }
                        .defaultMinSize(minHeight = metrics.height.dp)
                        .padding(
                            start = contentStart.dp,
                            end = metrics.paddingX.dp,
                            top = metrics.paddingY.dp,
                            bottom = metrics.paddingY.dp,
                        )
                        .semantics {
                            contentDescription = label
                            if (error != null) error(error)
                        },
                decorator = { innerTextField ->
                    Box(
                        Modifier.defaultMinSize(minHeight = metrics.contentHeight.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (state.text.isEmpty() && placeholder != null)
                            BasicText(
                                placeholder,
                                Modifier.clearAndSetSemantics {},
                                style = body.copy(color = colors["label-tertiary"]),
                            )
                        innerTextField()
                    }
                },
            )
            BasicText(
                label,
                Modifier.offset(y = -overhang)
                    .padding(start = contentStart.dp, end = metrics.paddingX.dp)
                    .clearAndSetSemantics {},
                style = caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        val explanation = error ?: helper
        if (explanation != null)
            BasicText(
                explanation,
                Modifier.padding(horizontal = LabComponents.InputHelperPaddingX.dp)
                    .then(
                        if (error != null) Modifier.semantics { liveRegion = LiveRegionMode.Polite }
                        else Modifier
                    ),
                style =
                    caption.copy(
                        color = colors[if (error != null) "label-danger" else "label-secondary"]
                    ),
            )
    }
}
