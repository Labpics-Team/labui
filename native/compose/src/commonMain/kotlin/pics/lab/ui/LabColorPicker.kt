@file:Suppress("DEPRECATION")

package pics.lab.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pics.lab.icons.Icon
import pics.lab.icons.SymbolData
import pics.lab.icons.symbols.chevronDown
import pics.lab.icons.symbols.close
import pics.lab.icons.symbols.component
import pics.lab.icons.symbols.copy
import pics.lab.icons.symbols.eyedrop
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max

private val LocalColorPickerResetRevision = compositionLocalOf { 0 }

/** Native convenience state. The controlled overload uses exactly the same behavior. */
@Composable
public fun LabColorPicker(
    state: LabColorPickerState,
    modifier: Modifier = Modifier,
    label: String = "Colors",
    enabled: Boolean = true,
    readOnly: Boolean = false,
    required: Boolean = false,
    variant: LabColorPickerVariant? = null,
    model: LabColorModel? = null,
    onVariantChange: (LabColorPickerVariant) -> Unit = {},
    onModelChange: (LabColorModel) -> Unit = {},
    onValueChange: (LabColorValue?) -> Unit = {},
    onValueChangeEnd: (LabColorValue?) -> Unit = {},
    onClose: () -> Unit = {},
    pickScreenColor: LabPickScreenColor? = null,
    material: LabMaterial = LabMaterial.Solid,
) = CompositionLocalProvider(LocalColorPickerResetRevision provides state.resetRevision) {
    LabColorPicker(state.value, { state.value = it; onValueChange(it) }, modifier, label, enabled, readOnly,
        required, variant, model, onVariantChange, onModelChange, onValueChangeEnd, onClose, pickScreenColor, material)
}

/**
 * All fifteen authored views share one accepted binary64 color. Changing model/view,
 * rendering, copying and showing gamuts never rewrites that value. Only edits request
 * a new value; end notifications read the accepted value after consumer recomposition.
 * [pickScreenColor] is a real, cancellable platform effect; null exposes no unsupported action.
 */
@Composable
public fun LabColorPicker(
    value: LabColorValue?,
    onValueChange: (LabColorValue?) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "Colors",
    enabled: Boolean = true,
    readOnly: Boolean = false,
    required: Boolean = false,
    variant: LabColorPickerVariant? = null,
    model: LabColorModel? = null,
    onVariantChange: (LabColorPickerVariant) -> Unit = {},
    onModelChange: (LabColorModel) -> Unit = {},
    onValueChangeEnd: (LabColorValue?) -> Unit = {},
    onClose: () -> Unit = {},
    pickScreenColor: LabPickScreenColor? = null,
    material: LabMaterial = LabMaterial.Solid,
) {
    require(label.isNotBlank())
    var localVariant by remember { mutableStateOf(LabColorPickerVariant.Spectrum) }
    var localModel by remember { mutableStateOf(LabColorModel.Hex) }
    var graphs by remember { mutableStateOf(true) }
    var p3 by remember { mutableStateOf(false) }
    var rec2020 by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var pickerJob by remember { mutableStateOf<Job?>(null) }
    var pendingEnd by remember { mutableStateOf<ColorPickerCompletion?>(null) }
    val selectedVariant = variant ?: localVariant
    val selectedModel = model ?: localModel
    val current by rememberUpdatedState(value)
    val writable by rememberUpdatedState(enabled && !readOnly)
    val change by rememberUpdatedState(onValueChange)
    val end by rememberUpdatedState(onValueChangeEnd)
    val coroutine = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val colors = LocalLabTheme.current.colors
    val selected = value ?: LabColorValue.Orange
    val channels = remember(selected, selectedModel, selectedVariant, rec2020) { colorChannels(selected, selectedModel, selectedVariant, rec2020) }
    val cache = remember { ColorGraphCache() }
    val resetRevision = LocalColorPickerResetRevision.current
    fun request(next: LabColorValue?) { if (writable && next != current) change(next) }
    fun finish(before: LabColorValue?) { pendingEnd = ColorPickerCompletion(before, resetRevision) }
    val completion = pendingEnd
    SideEffect { completion?.let { pendingEnd = null; if (it.resetRevision == resetRevision && value != it.before) end(value) } }
    fun commit(next: LabColorValue?) { val before = current; request(next); finish(before) }
    DisposableEffect(Unit) { onDispose { pickerJob?.cancel() } }
    LaunchedEffect(writable) { if (!writable) pickerJob?.cancel() }
    LaunchedEffect(resetRevision) { pickerJob?.cancel(); pendingEnd = null; status = "" }
    val shape = RoundedCornerShape(LabComponents.ColorPickerRadius.dp)
    LabSurface(LabComponents.ColorPickerMaterial, modifier.widthIn(max = LabComponents.ColorPickerWidth.dp).width(LabComponents.ColorPickerWidth.dp)
        .semantics { contentDescription = label; if (required && enabled && !readOnly && value == null) error("Choose a color.") }, material, shape) {
        Column(Modifier.fillMaxWidth().padding(LabComponents.ColorPickerPadding.dp), verticalArrangement = Arrangement.spacedBy(LabComponents.ColorPickerGap.dp)) {
            Row(Modifier.fillMaxWidth().height(LabComponents.ColorPickerHeaderHeight.dp), verticalAlignment = Alignment.CenterVertically) {
                ColorAction("Pick a color from screen", eyedrop, enabled && !readOnly && pickScreenColor != null && pickerJob?.isActive != true, colors[LabComponents.ColorPickerRolesAccent]) {
                    val provider = pickScreenColor ?: return@ColorAction
                    pickerJob = coroutine.launch {
                        try {
                            val sampled = provider()
                            currentCoroutineContext().ensureActive()
                            sampled?.let { val before = current; request(it.copy(alpha = before?.alpha ?: 1.0)); finish(before) }
                        }
                        catch (cancelled: CancellationException) { throw cancelled }
                        catch (_: Exception) { status = "Could not pick a screen color. Try again." }
                        finally { if (pickerJob == currentCoroutineContext()[Job]) pickerJob = null }
                    }
                }
                LabText(label, Modifier.weight(1f), style = LabType.body().withTypography(fontSize = LabComponents.ColorPickerHeadingFontSize.sp,
                    lineHeight = LabComponents.ColorPickerHeadingLineHeight.sp, fontWeight = FontWeight(LabComponents.ColorPickerHeadingFontWeight.toInt()),
                    letterSpacing = LabComponents.ColorPickerHeadingLetterSpacing.sp).copy(textAlign = TextAlign.Center))
                ColorAction("Close color picker", close, true, colors[LabComponents.ColorPickerRolesSecondary], onClose)
            }
            LabSegmentedControl(selectedVariant.name, { raw -> val next = LabColorPickerVariant.valueOf(raw); localVariant = next; onVariantChange(next) },
                LabColorPickerVariant.entries.map { LabSegmentedItem(it.name, it.name) }, Modifier.fillMaxWidth(), enabled = enabled, label = "Color selection method")
            if (selectedVariant == LabColorPickerVariant.Grid) ColorPalette(selected, selectedModel, enabled && !readOnly, ::commit)
            if (selectedVariant == LabColorPickerVariant.Spectrum) {
                if (selectedModel == LabColorModel.Lch) Column(Modifier.fillMaxWidth().aspectRatio(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ColorPlane(selected, ColorPickerPlane.LightnessChroma, cache, p3, rec2020, Modifier.fillMaxWidth().weight(1f), enabled, readOnly, ::request, ::finish)
                    ColorPlane(selected, ColorPickerPlane.HueChroma, cache, p3, rec2020, Modifier.fillMaxWidth().weight(1f), enabled, readOnly, ::request, ::finish)
                } else ColorPlane(selected, ColorPickerPlane.SaturationBrightness, cache, p3, rec2020, Modifier.fillMaxWidth().aspectRatio(1f), enabled, readOnly, ::request, ::finish)
            }
            Column(Modifier.padding(vertical = if (selectedVariant == LabColorPickerVariant.Sliders) LabComponents.ColorPickerChannelSliderPaddingY.dp else 0.dp),
                verticalArrangement = Arrangement.spacedBy(LabComponents.ColorPickerGap.dp)) {
                for (channel in channels) key(channel.space, channel.index) {
                    Row(Modifier.fillMaxWidth().alpha(if (enabled) 1f else .45f), horizontalArrangement = Arrangement.spacedBy(LabComponents.ColorPickerChannelGap.dp), verticalAlignment = Alignment.Bottom) {
                        Column(Modifier.weight(1f)) {
                            LabText(channel.label, style = LabType.body().withTypography(color = colors[LabComponents.ColorPickerRolesSecondary], fontSize = 14.sp,
                                lineHeight = LabComponents.ColorPickerChannelLabelHeight.sp, letterSpacing = 0.sp))
                            val graph = graphs && selectedModel == LabColorModel.Lch && selectedVariant == LabColorPickerVariant.Sliders && channel.index < 3
                            val labelGap = when {
                                graph -> LabComponents.ColorPickerChannelGraphLabelGap
                                selectedVariant == LabColorPickerVariant.Sliders && channel.index in 1..2 -> LabComponents.ColorPickerChannelMiddleLabelGap
                                else -> LabComponents.ColorPickerChannelLabelGap
                            }
                            Spacer(Modifier.height(labelGap.dp))
                            if (graphs && selectedModel == LabColorModel.Lch && selectedVariant == LabColorPickerVariant.Sliders && channel.index < 3) {
                                val plane = when (channel.index) { 0 -> ColorPickerPlane.LightnessChroma; 1 -> ColorPickerPlane.HueChroma; else -> ColorPickerPlane.HueLightness }
                                ColorPlane(selected, plane, cache, p3, rec2020, Modifier.fillMaxWidth().height(LabComponents.ColorPickerChannelGraphHeight.dp), enabled, readOnly, ::request, ::finish)
                                Spacer(Modifier.height(LabComponents.ColorPickerChannelGraphGap.dp))
                            }
                            ColorTrack(selected, channel, p3, rec2020, enabled, readOnly, ::request, ::finish)
                        }
                        ColorTextField("${channel.label} value", colorNumber(channel.value) + channel.suffix,
                            Modifier.width(LabComponents.ColorPickerChannelFieldWidth.dp).height(LabComponents.ColorPickerChannelTrackHeight.dp),
                            enabled, readOnly, filled = true) { text -> text.trim().removeSuffix("%").removeSuffix("°").toDoubleOrNull()?.takeIf { it.isFinite() }?.let { commit(editColorChannel(current ?: LabColorValue.Orange, channel, it)) } }
                    }
                }
            }
            ColorSeparator()
            Row(Modifier.fillMaxWidth().height(LabComponents.ColorPickerFooterHeight.dp), horizontalArrangement = Arrangement.spacedBy(LabComponents.ColorPickerFooterGap.dp), verticalAlignment = Alignment.CenterVertically) {
                LabMenu(LabColorModel.entries.map { LabMenuItem.Radio(it.name, it.name.uppercase(), "color-model") }, "Color model",
                    checkedValues = listOf(selectedModel.name), onSelect = { raw -> val next = LabColorModel.valueOf(raw); localModel = next; onModelChange(next) }, enabled = enabled,
                    modifier = Modifier.width(LabComponents.ColorPickerFooterModelWidth.dp), material = material,
                    trigger = { control, openMenu ->
                        Row(control.fillMaxWidth().height(32.dp).clip(CircleShape).border(1.dp, colors[LabComponents.ColorPickerRolesBorder], CircleShape)
                            .clickable(enabled = enabled, role = Role.Button, onClick = openMenu).padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(component, size = 14.dp, tint = colors[LabComponents.ColorPickerRolesLabel])
                            LabText(selectedModel.name.uppercase(), Modifier.weight(1f), style = LabType.body().withTypography(fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.sp))
                            Icon(chevronDown, size = 12.dp, tint = colors[LabComponents.ColorPickerRolesLabel])
                        }
                    })
                if (selectedModel == LabColorModel.Hex || selectedModel == LabColorModel.Lch) {
                    Row(Modifier.weight(1f).fillMaxHeight().border(1.dp, colors[LabComponents.ColorPickerRolesBorder], RoundedCornerShape(LabComponents.ColorPickerFooterRadius.dp)).padding(horizontal = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(16.dp).background(ColorPickerCodec.paint(selected), CircleShape))
                        ColorTextField("${selectedModel.name.uppercase()} color", value?.let { colorFieldText(it, selectedModel) } ?: "", Modifier.weight(1f).fillMaxHeight(), enabled, readOnly) { text ->
                            if (text.isBlank()) commit(null) else parseColorField(text, selectedModel, current?.alpha ?: 1.0)?.let(::commit)
                        }
                        ColorAction("Copy color", copy, value != null, colors[LabComponents.ColorPickerRolesSecondary], size = 20.dp) {
                            current?.let { clipboard.setText(AnnotatedString(colorCopyText(it, selectedModel))); status = "Color copied" }
                        }
                    }
                } else for (channel in colorChannels(selected, selectedModel, LabColorPickerVariant.Sliders).take(3)) key(selectedModel, channel.index) {
                    ColorTextField("${selectedModel.name.uppercase()} ${channel.label}", colorNumber(channel.value),
                        Modifier.weight(1f).fillMaxHeight().border(1.dp, colors[LabComponents.ColorPickerRolesBorder], RoundedCornerShape(LabComponents.ColorPickerFooterRadius.dp)), enabled, readOnly,
                        centered = true) { text -> text.toDoubleOrNull()?.takeIf { it.isFinite() }?.let { commit(editColorChannel(current ?: LabColorValue.Orange, channel, it)) } }
                }
            }
            if (selectedModel == LabColorModel.Lch && selectedVariant != LabColorPickerVariant.Grid) {
                ColorSeparator()
                if (selectedVariant == LabColorPickerVariant.Sliders) LabSwitch(graphs, { graphs = it }, "Show graphs", enabled = enabled)
                LabSwitch(p3, { p3 = it }, "Show P3", enabled = enabled)
                LabSwitch(rec2020, { rec2020 = it }, "Show Rec2020", enabled = enabled)
            }
            if (status.isNotEmpty()) LabText(status, Modifier.semantics { liveRegion = LiveRegionMode.Polite; contentDescription = status },
                style = LabType.body().withTypography(fontSize = 14.sp, lineHeight = 20.sp, color = colors[LabComponents.ColorPickerRolesSecondary]))
        }
    }
}

@Composable
private fun ColorSeparator() = Box(Modifier.fillMaxWidth().height(1.dp).background(LocalLabTheme.current.colors[LabComponents.ColorPickerRolesBorder]))

@Composable
private fun ColorAction(label: String, symbol: SymbolData, enabled: Boolean, tint: Color, onClick: () -> Unit) = ColorAction(label, symbol, enabled, tint, 24.dp, onClick)
@Composable
private fun ColorAction(label: String, symbol: SymbolData, enabled: Boolean, tint: Color, size: Dp, onClick: () -> Unit) {
    Box(Modifier.size(size).clip(CircleShape).clickable(enabled = enabled, role = Role.Button, onClick = onClick)
        .semantics { contentDescription = label }.alpha(if (enabled) 1f else .4f), contentAlignment = Alignment.Center) { Icon(symbol, tint = tint, size = size) }
}

@Composable
private fun ColorTextField(label: String, text: String, modifier: Modifier, enabled: Boolean, readOnly: Boolean, filled: Boolean = false, centered: Boolean = false, onCommit: (String) -> Unit) {
    val resetRevision = LocalColorPickerResetRevision.current
    val field = remember(label, resetRevision) { TextFieldState(text) }
    val currentText by rememberUpdatedState(text)
    val commit by rememberUpdatedState(onCommit)
    var focused by remember { mutableStateOf(false) }
    var baseline by remember(label, resetRevision) { mutableStateOf(text) }
    var pendingBlur by remember(label, resetRevision) { mutableStateOf(false) }
    var pendingReconcile by remember(label, resetRevision) { mutableStateOf(false) }
    val composition = rememberInputCompositionGuard(field)
    val colors = LocalLabTheme.current.colors
    fun reconcile() { field.setTextAndPlaceCursorAtEnd(currentText); baseline = currentText }
    fun accept() {
        if (!enabled || readOnly || field.composition != null) return
        if (field.text.toString() != baseline) {
            baseline = field.text.toString(); commit(baseline)
            pendingReconcile = true
        }
    }
    val reconcileRequested = pendingReconcile
    SideEffect { if (reconcileRequested) { pendingReconcile = false; reconcile() } }
    LaunchedEffect(text, focused) { if (!focused && !pendingBlur && field.composition == null) reconcile() }
    LaunchedEffect(pendingBlur, field.composition) { if (pendingBlur && field.composition == null) { pendingBlur = false; accept() } }
    val style = LabType.body().withTypography(color = colors[LabComponents.ColorPickerRolesLabel], fontSize = LabComponents.ColorPickerTextFontSize.sp,
        lineHeight = LabComponents.ColorPickerTextLineHeight.sp, fontWeight = FontWeight(if (filled) 500 else 400), letterSpacing = if (filled) 0.sp else (-.25).sp)
        .copy(textAlign = if (filled || centered) TextAlign.Center else TextAlign.Start)
    BasicTextField(field, modifier.then(if (filled) Modifier.background(colors[LabComponents.ColorPickerRolesField], RoundedCornerShape(8.dp)) else Modifier)
        .onFocusChanged { val lost = focused && !it.isFocused; focused = it.isFocused; if (it.isFocused) { baseline = field.text.toString(); pendingBlur = false }; if (lost) { if (composition.active()) pendingBlur = true else accept() } }
        .onPreviewKeyEvent { event -> if (event.type == KeyEventType.KeyDown && !composition.active()) when (event.key) {
            Key.Enter, Key.NumPadEnter -> { accept(); true }; Key.Escape -> { reconcile(); true }; else -> false
        } else false }.semantics { contentDescription = label }, enabled = enabled, readOnly = readOnly, textStyle = style,
        lineLimits = TextFieldLineLimits.SingleLine, cursorBrush = SolidColor(colors[LabComponents.ColorPickerRolesAccent]),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Done),
        onKeyboardAction = { if (!composition.active()) accept() }, decorator = { inner -> Box(Modifier.fillMaxSize().padding(horizontal = if (filled || centered) 6.dp else 0.dp), contentAlignment = Alignment.CenterStart) { inner() } })
}

@Composable
private fun ColorPalette(value: LabColorValue, model: LabColorModel, enabled: Boolean, commit: (LabColorValue) -> Unit) {
    val swatches = remember { LabComponents.ColorPickerSwatches.map { LabColorValue(LabColorSpace.Srgb, it.map(Float::toDouble)) } }
    val rgb = remember(value) { ColorPickerCodec.coords(value, LabColorSpace.Srgb) }
    val selected = swatches.indexOfFirst { color -> color.coords.indices.all { abs(color[it] - rgb[it]) < 1e-7 } }
    val colors = LocalLabTheme.current.colors
    Column(Modifier.fillMaxWidth().height(if (model == LabColorModel.Lch) LabComponents.ColorPickerGridLchHeight.dp else LabComponents.ColorPickerGridHeight.dp)
        .clip(RoundedCornerShape(LabComponents.ColorPickerAreaRadius.dp)).border(1.dp, colors[LabComponents.ColorPickerRolesBorder], RoundedCornerShape(LabComponents.ColorPickerAreaRadius.dp)).selectableGroup()) {
        for (row in 0 until 10) Row(Modifier.fillMaxWidth().weight(1f)) {
            for (column in 0 until 10) {
                val index = row * 10 + column
                val color = swatches[index]
                Box(Modifier.weight(1f).fillMaxHeight().background(ColorPickerCodec.paint(color))
                    .selectable(index == selected, enabled = enabled, role = Role.RadioButton, onClick = { commit(color.copy(alpha = value.alpha)) })
                    .semantics { contentDescription = "Color ${index + 1}: ${ColorPickerCodec.hex(color)}" }
                    .then(if (index == selected) Modifier.padding(2.dp).border(2.dp, Color.White, RoundedCornerShape(3.dp)) else Modifier))
            }
        }
    }
}

@Composable
private fun ColorTrack(value: LabColorValue, channel: ColorPickerChannel, p3: Boolean, rec2020: Boolean, enabled: Boolean, readOnly: Boolean, change: (LabColorValue) -> Unit, end: (LabColorValue) -> Unit) {
    val resetRevision = LocalColorPickerResetRevision.current
    val currentRevision by rememberUpdatedState(resetRevision)
    val current by rememberUpdatedState(value)
    val currentChannel by rememberUpdatedState(channel)
    val request by rememberUpdatedState(change)
    val completed by rememberUpdatedState(end)
    val colors = LocalLabTheme.current.colors
    val focus = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    var keyboardStart by remember { mutableStateOf<LabColorValue?>(null) }
    var pointerStart by remember { mutableStateOf<LabColorValue?>(null) }
    var cancelled by remember { mutableIntStateOf(0) }
    var width by remember { mutableIntStateOf(1) }
    LaunchedEffect(resetRevision) { pointerStart = null; keyboardStart = null }
    val fixed = remember(value.space, value.coords, channel.space, channel.index) {
        ColorPickerCodec.coords(value, channel.space).filterIndexed { index, _ -> index != channel.index }
    }
    val stops = remember(fixed, channel.space, channel.index, p3, rec2020) {
        List(257) { index ->
            val color = editColorChannel(value.copy(alpha = 1.0), channel, index * channel.max / 256)
            if (channel.space == LabColorSpace.Lch && channel.index != 3 && !(ColorPickerCodec.inGamut(color, ColorPickerGamut.Srgb) || p3 && ColorPickerCodec.inGamut(color, ColorPickerGamut.P3) || rec2020 && ColorPickerCodec.inGamut(color, ColorPickerGamut.Rec2020))) Color.Transparent
            else ColorPickerCodec.paint(color)
        }
    }
    val brush = remember(stops) { Brush.horizontalGradient(stops) }
    val border = if (focused) colors[LabComponents.ColorPickerRolesFocus] else Color.Transparent
    val modifier = Modifier.fillMaxWidth().height(LabComponents.ColorPickerChannelTrackHeight.dp).onSizeChanged { width = it.width }
        .focusRequester(focus).onFocusChanged { focused = it.isFocused; if (!it.isFocused) keyboardStart?.let { completed(it); keyboardStart = null } }
        .onPreviewKeyEvent { event ->
            if (!enabled || readOnly) false
            else if (event.key == Key.Escape && event.type == KeyEventType.KeyDown) {
                (pointerStart ?: keyboardStart)?.let(request); pointerStart = null; keyboardStart = null; cancelled++; true
            } else if (event.type == KeyEventType.KeyUp && keyboardStart != null) { completed(keyboardStart!!); keyboardStart = null; true }
            else if (event.type != KeyEventType.KeyDown) false else {
                val next = when (event.key) { Key.DirectionRight, Key.DirectionUp -> currentChannel.value + 1; Key.DirectionLeft, Key.DirectionDown -> currentChannel.value - 1; Key.PageUp -> currentChannel.value + 10; Key.PageDown -> currentChannel.value - 10; Key.MoveHome -> 0.0; Key.MoveEnd -> channel.max; else -> null }
                if (next == null) false else { if (keyboardStart == null) keyboardStart = current; request(editColorChannel(current, currentChannel, next)); true }
            }
        }.semantics {
            contentDescription = channel.label; progressBarRangeInfo = ProgressBarRangeInfo(channel.value.coerceIn(0.0, channel.max).toFloat(), 0f..channel.max.toFloat())
            stateDescription = colorNumber(channel.value) + channel.suffix
            if (!enabled) disabled()
            if (enabled && !readOnly) setProgress { next -> val before = current; request(editColorChannel(current, currentChannel, next.toDouble())); completed(before); true }
        }.focusable(enabled)
        .pointerInput(enabled, readOnly, cancelled, width, resetRevision) {
            if (!enabled || readOnly) return@pointerInput
            awaitEachGesture {
                val down = awaitFirstDown(); val before = current; pointerStart = before; focus.requestFocus()
                var released = false
                fun apply(position: Offset) { request(editColorChannel(current, currentChannel, (position.x / size.width).toDouble() * currentChannel.max)) }
                try {
                    apply(down.position); down.consume()
                    do { val event = awaitPointerEvent(); val point = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (point.isConsumed) break
                        apply(point.position); point.consume(); if (!point.pressed) { released = true; break }
                    } while (true)
                } finally { pointerStart = null; if (currentRevision == resetRevision) { if (released) completed(before) else request(before) } }
            }
        }
    Canvas(modifier.clip(CircleShape).border(if (focused) 2.dp else 0.dp, border, CircleShape)) {
        val checker = 4.dp.toPx()
        for (y in 0..ceil(size.height / checker).toInt()) for (x in 0..ceil(size.width / checker).toInt()) if ((x + y) % 2 == 0)
            drawRect(Color.Black.copy(alpha = .025f), Offset(x * checker, y * checker), Size(checker, checker))
        drawRoundRect(brush, cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2))
        val radius = LabComponents.ColorPickerChannelThumb.dp.toPx() / 2
        val x = radius + 2.dp.toPx() + (size.width - 2 * radius - 4.dp.toPx()).coerceAtLeast(0f) * (channel.value / channel.max).coerceIn(0.0, 1.0).toFloat()
        drawCircle(ColorPickerCodec.paint(value), radius, Offset(x, size.height / 2))
        drawCircle(Color.White, radius - LabComponents.ColorPickerChannelThumbStroke.dp.toPx() / 2, Offset(x, size.height / 2), style = Stroke(LabComponents.ColorPickerChannelThumbStroke.dp.toPx()))
    }
}

@Composable
private fun ColorPlane(value: LabColorValue, plane: ColorPickerPlane, cache: ColorGraphCache, p3: Boolean, rec2020: Boolean, modifier: Modifier, enabled: Boolean, readOnly: Boolean, change: (LabColorValue) -> Unit, end: (LabColorValue) -> Unit) {
    val resetRevision = LocalColorPickerResetRevision.current
    val currentRevision by rememberUpdatedState(resetRevision)
    var dimensions by remember { mutableStateOf(IntSize(1, 1)) }
    val axes = remember(value, plane, rec2020) { colorPlaneAxes(value, plane, rec2020) }
    val key = remember(value, plane, dimensions, p3, rec2020) { colorGraphKey(value, plane, dimensions.width, dimensions.height, p3, rec2020) }
    val image by produceState<ImageBitmap?>(null, key) {
        if (plane != ColorPickerPlane.SaturationBrightness) { withFrameNanos { }; this.value = withContext(Dispatchers.Default) { cache.image(key) } }
    }
    val current by rememberUpdatedState(value)
    val currentAxes by rememberUpdatedState(axes)
    val request by rememberUpdatedState(change)
    val completed by rememberUpdatedState(end)
    val colors = LocalLabTheme.current.colors
    var pointerStart by remember { mutableStateOf<LabColorValue?>(null) }
    var keyboardStart by remember { mutableStateOf<LabColorValue?>(null) }
    var cancelled by remember { mutableIntStateOf(0) }
    var focused by remember { mutableStateOf(false) }
    LaunchedEffect(resetRevision) { pointerStart = null; keyboardStart = null }
    val focus = remember { FocusRequester() }
    val title = "${axes.xLabel} and ${axes.yLabel}"
    val interactions = Modifier.focusRequester(focus).onFocusChanged { focused = it.isFocused; if (!it.isFocused) keyboardStart?.let { completed(it); keyboardStart = null } }
        .onPreviewKeyEvent { event ->
            if (!enabled || readOnly) false
            else if (event.key == Key.Escape && event.type == KeyEventType.KeyDown) { (pointerStart ?: keyboardStart)?.let(request); pointerStart = null; keyboardStart = null; cancelled++; true }
            else if (event.type == KeyEventType.KeyUp && keyboardStart != null) { completed(keyboardStart!!); keyboardStart = null; true }
            else if (event.type != KeyEventType.KeyDown) false else {
                var x = currentAxes.x; var y = currentAxes.y
                when (event.key) { Key.DirectionLeft -> x -= 1; Key.DirectionRight -> x += 1; Key.DirectionDown -> y -= 1; Key.DirectionUp -> y += 1; else -> return@onPreviewKeyEvent false }
                if (keyboardStart == null) keyboardStart = current
                request(colorPlaneValue(current, plane, x / currentAxes.xMax, y / currentAxes.yMax, rec2020)); true
            }
        }.semantics {
            contentDescription = title; stateDescription = "${axes.xLabel} ${colorNumber(axes.x)}, ${axes.yLabel} ${colorNumber(axes.y)}"
            if (!enabled) disabled()
            if (enabled && !readOnly) customActions = listOf(
                CustomAccessibilityAction("Increase ${axes.xLabel}") { val before = current; request(colorPlaneValue(current, plane, (currentAxes.x + 1) / axes.xMax, currentAxes.y / axes.yMax, rec2020)); completed(before); true },
                CustomAccessibilityAction("Decrease ${axes.xLabel}") { val before = current; request(colorPlaneValue(current, plane, (currentAxes.x - 1) / axes.xMax, currentAxes.y / axes.yMax, rec2020)); completed(before); true },
                CustomAccessibilityAction("Increase ${axes.yLabel}") { val before = current; request(colorPlaneValue(current, plane, currentAxes.x / axes.xMax, (currentAxes.y + 1) / axes.yMax, rec2020)); completed(before); true },
                CustomAccessibilityAction("Decrease ${axes.yLabel}") { val before = current; request(colorPlaneValue(current, plane, currentAxes.x / axes.xMax, (currentAxes.y - 1) / axes.yMax, rec2020)); completed(before); true })
        }.focusable(enabled).pointerInput(enabled, readOnly, plane, cancelled, resetRevision, rec2020) {
            if (!enabled || readOnly) return@pointerInput
            awaitEachGesture {
                val down = awaitFirstDown(); val before = current; pointerStart = before; focus.requestFocus(); var released = false
                fun apply(point: Offset) { request(colorPlaneValue(current, plane, point.x.toDouble() / size.width, 1 - point.y.toDouble() / size.height, rec2020)) }
                try { apply(down.position); down.consume()
                    do { val event = awaitPointerEvent(); val point = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (point.isConsumed) break
                        apply(point.position); point.consume(); if (!point.pressed) { released = true; break }
                    } while (true)
                } finally { pointerStart = null; if (currentRevision == resetRevision) { if (released) completed(before) else request(before) } }
            }
        }
    val shape = RoundedCornerShape(LabComponents.ColorPickerAreaRadius.dp)
    val hue = ColorPickerCodec.coords(value, LabColorSpace.Hsv)[0]
    Canvas(modifier.onSizeChanged { dimensions = it }.then(interactions).clip(shape).border(1.dp, colors[LabComponents.ColorPickerRolesBorder], shape).alpha(if (enabled) 1f else .45f)) {
        if (plane == ColorPickerPlane.SaturationBrightness) {
            drawRect(ColorPickerCodec.paint(LabColorValue(LabColorSpace.Hsv, hue, 100.0, 100.0)))
            drawRect(Brush.horizontalGradient(listOf(Color.White, Color.Transparent)))
            drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color.Black)))
        } else image?.let { drawImage(it, dstSize = IntSize(size.width.toInt(), size.height.toInt()), filterQuality = FilterQuality.Medium) }
        val radius = if (plane == ColorPickerPlane.SaturationBrightness) 16.dp.toPx() else 8.dp.toPx()
        val point = Offset((axes.x / axes.xMax).coerceIn(0.0, 1.0).toFloat() * size.width, (1 - axes.y / axes.yMax).coerceIn(0.0, 1.0).toFloat() * size.height)
        val center = Offset(point.x.coerceIn(radius, max(radius, size.width - radius)), point.y.coerceIn(radius, max(radius, size.height - radius)))
        drawCircle(ColorPickerCodec.paint(value), radius, center)
        drawCircle(Color.White, radius - 1.dp.toPx(), center, style = Stroke(if (plane == ColorPickerPlane.SaturationBrightness) 4.dp.toPx() else 2.dp.toPx()))
        if (focused) drawCircle(colors[LabComponents.ColorPickerRolesFocus], radius, center, style = Stroke(1.dp.toPx()))
    }
}
