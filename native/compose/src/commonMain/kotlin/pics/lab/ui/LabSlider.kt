package pics.lab.ui

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import kotlin.math.*
import kotlinx.coroutines.launch

public enum class LabSliderVariant { Linear, Circular, Large }
public enum class LabSliderOrientation { Horizontal, Vertical }

/** Binary32 spacing; Float.ulp is absent from Kotlin's common metadata API. */
private fun sliderFloatUlp(value: Float): Float {
    val exponent = (value.toRawBits() ushr 23) and 0xff
    return if (exponent < 24) Float.fromBits(1 shl (exponent - 1).coerceAtLeast(0))
    else Float.fromBits((exponent - 23) shl 23)
}

internal data class SliderDomain(val min: Float, val max: Float, val step: Float) {
    init { require(min.isFinite() && max.isFinite() && max > min && step.isFinite() && step > 0f) }
    fun snap(value: Float): Float {
        val snapped = min.toDouble() + floor((value.coerceIn(min, max).toDouble() - min) / step + .5) * step
        val result = snapped.toFloat()
        // Decimal Float inputs can put an otherwise aligned endpoint one ULP
        // above max (for example -0.7..1.3 by 0.2). Preserve that endpoint.
        return when {
            result <= max -> result
            result.isFinite() && result - max <= maxOf(sliderFloatUlp(min), sliderFloatUlp(max), sliderFloatUlp(result)) -> max
            else -> (snapped - step).toFloat()
        }.coerceAtLeast(min)
    }
    fun fraction(value: Float): Float = ((value.toDouble() - min) / (max.toDouble() - min)).toFloat()
    fun value(fraction: Float): Float = (min.toDouble() + fraction.coerceIn(0f, 1f) * (max.toDouble() - min)).toFloat()
    fun replace(values: List<Float>, index: Int, value: Float): List<Float> = values.toMutableList().also {
        it[index] = snap(value).coerceIn(values.getOrNull(index - 1) ?: min, values.getOrNull(index + 1) ?: max)
    }
    fun progressInfo(value: Float, low: Float, high: Float): ProgressBarRangeInfo {
        val reachableHigh = snap(high)
        val intervals = round((reachableHigh.toDouble() - low) / step)
        val evenlySpaced = intervals in 1.0..Int.MAX_VALUE.toDouble() &&
            step >= maxOf(sliderFloatUlp(low), sliderFloatUlp(reachableHigh)) &&
            abs((reachableHigh.toDouble() - low) / intervals - step) <= sliderFloatUlp(step) * 2
        return ProgressBarRangeInfo(value, low..reachableHigh, if (evenlySpaced) intervals.toInt() - 1 else 0)
    }
    fun accessibleChange(values: List<Float>, index: Int, requested: Float): List<Float> {
        if (!requested.isFinite()) return values
        val target = requested.coerceIn(values.getOrNull(index - 1) ?: min, values.getOrNull(index + 1) ?: snap(max))
        val next = replace(values, index, target)
        // Two reachable endpoints have zero intermediate steps. Android then
        // requests 1/20 of their distance; preserve the requested direction.
        return if (next == values && target != values[index])
            replace(values, index, values[index] + if (target > values[index]) step else -step)
        else next
    }
}

internal fun sliderCircleFraction(point: Offset, previous: Float? = null): Float? {
    if (point.getDistance() < 1f) return null
    val angle = ((atan2(point.x.toDouble(), -point.y.toDouble()) / (2 * PI) + 1) % 1).toFloat()
    return if (previous == null) angle else (angle + floor(previous - angle + .5f)).coerceIn(0f, 1f)
}

/** Authored single-value scale. The application owns the accepted value. */
@Composable
public fun LabSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    min: Float = 0f,
    max: Float = 100f,
    step: Float = 1f,
    variant: LabSliderVariant = LabSliderVariant.Linear,
    orientation: LabSliderOrientation = LabSliderOrientation.Horizontal,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    showValue: Boolean = false,
    labelHidden: Boolean = false,
    onValueChangeEnd: (Float) -> Unit = {},
) = SliderContent(listOf(value), { onValueChange(it[0]) }, { onValueChangeEnd(it[0]) }, label,
    modifier, min, max, step, variant, orientation, enabled, readOnly, showValue, labelHidden, emptyList())

/** Ordered range; the thumbs keep their identities and cannot cross. */
@Composable
public fun LabRangeSlider(
    value: ClosedFloatingPointRange<Float>,
    onValueChange: (ClosedFloatingPointRange<Float>) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    min: Float = 0f,
    max: Float = 100f,
    step: Float = 1f,
    variant: LabSliderVariant = LabSliderVariant.Linear,
    orientation: LabSliderOrientation = LabSliderOrientation.Horizontal,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    showValue: Boolean = false,
    labelHidden: Boolean = false,
    thumbLabels: List<String> = emptyList(),
    onValueChangeEnd: (ClosedFloatingPointRange<Float>) -> Unit = {},
) = SliderContent(listOf(value.start, value.endInclusive), { onValueChange(it[0]..it[1]) },
    { onValueChangeEnd(it[0]..it[1]) }, label, modifier, min, max, step, variant, orientation,
    enabled, readOnly, showValue, labelHidden, thumbLabels)

@Composable
private fun SliderContent(
    source: List<Float>, onChange: (List<Float>) -> Unit, onEnd: (List<Float>) -> Unit, label: String,
    modifier: Modifier, min: Float, max: Float, step: Float, variant: LabSliderVariant,
    orientation: LabSliderOrientation, enabled: Boolean, readOnly: Boolean, showValue: Boolean,
    labelHidden: Boolean, thumbLabels: List<String>,
) {
    val domain = remember(min, max, step) { SliderDomain(min, max, step) }
    require(source.all { it.isFinite() } && (source.size == 1 || source[0] <= source[1]))
    require(variant != LabSliderVariant.Large || source.size == 1) { "Large Slider has one value" }
    require(variant == LabSliderVariant.Linear || orientation == LabSliderOrientation.Horizontal)
    val values = source.map(domain::snap)
    val current by rememberUpdatedState(values)
    val change by rememberUpdatedState(onChange)
    val end by rememberUpdatedState(onEnd)
    val circular = variant == LabSliderVariant.Circular
    val large = variant == LabSliderVariant.Large
    val vertical = orientation == LabSliderOrientation.Vertical
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl && !circular && !vertical
    val coroutine = rememberCoroutineScope()
    val density = LocalDensity.current
    val scale = density.fontScale
    val colors = LocalLabTheme.current.colors
    val active = colors[LabComponents.SliderActiveRole]
    val track = colors[LabComponents.SliderTrackRole]
    val thumb = colors[LabComponents.SliderThumbRole]
    val focus = colors[LabComponents.SliderFocusRole]
    val fill = colors[LabComponents.SliderLargeActiveRole]
    val highlight = colors[LabComponents.SliderLargeHighlightRole].copy(alpha = LabComponents.SliderLargeHighlightOpacity)
    val gradient = remember(highlight) { Brush.verticalGradient(listOf(highlight, highlight.copy(alpha = 0f))) }
    val requests = remember(values.size) { List(values.size) { FocusRequester() } }
    var focused by remember { mutableIntStateOf(-1) }
    var keyboardStart by remember { mutableStateOf<List<Float>?>(null) }
    var pointerStart by remember { mutableStateOf<List<Float>?>(null) }
    var cancelGesture by remember { mutableIntStateOf(0) }
    val baseStyle = LabType.body().withTypography(fontSize = LabComponents.SliderLargeFontSize.sp,
        lineHeight = LabComponents.SliderLargeLineHeight.sp, fontWeight = FontWeight(LabComponents.SliderLargeFontWeight.toInt()),
        letterSpacing = LabComponents.SliderLargeLetterSpacing.sp)
    val height = if (large) max(LabComponents.SliderLargeHeight, LabComponents.SliderLargeLineHeight * scale + 32)
        else if (circular) LabComponents.SliderCircularDiameter else if (vertical) 192f else LabComponents.SliderHitSize
    val width = if (circular && labelHidden && !showValue) LabComponents.SliderCircularDiameter else if (vertical) LabComponents.SliderHitSize else null
    fun request(index: Int, next: Float) {
        val updated = domain.replace(current, index, next)
        if (updated != current) change(updated)
    }
    Column(modifier.then(if (width == null) Modifier.fillMaxWidth() else Modifier.width(width.dp)),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if ((!labelHidden && label.isNotEmpty() && !large) || showValue) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                if (!labelHidden && !large) LabText(label, Modifier.weight(1f).clearAndSetSemantics {},
                    style = baseStyle.withTypography(color = colors["label-secondary"]))
                if (showValue) LabText(values.joinToString(" – ") { it.toString().removeSuffix(".0") },
                    Modifier.clearAndSetSemantics {}, style = baseStyle.withTypography(color = colors["label-primary"]))
            }
        }
        BoxWithConstraints((if (circular) Modifier.width(LabComponents.SliderCircularDiameter.dp) else Modifier.fillMaxWidth()).height(height.dp)) {
            val actualWidth = with(density) { maxWidth.toPx() }
            val actualHeight = with(density) { maxHeight.toPx() }
            val thumbSize = with(density) { LabComponents.SliderThumb.dp.toPx() }
            val lineWidth = with(density) { LabComponents.SliderTrack.dp.toPx() }
            val indicatorInset = with(density) { (LabComponents.SliderLargeIndicatorInset + LabComponents.SliderLargeIndicatorWidth / 2).dp.toPx() }
            val fractions = values.map(domain::fraction)
            fun position(fraction: Float): Offset = when {
                circular -> { val radius = max(0f, (min(actualWidth, actualHeight) - lineWidth) / 2); val angle = fraction * 2 * PI
                    Offset(actualWidth / 2 + (sin(angle) * radius).toFloat(), actualHeight / 2 - (cos(angle) * radius).toFloat()) }
                large -> Offset((actualWidth * fraction - indicatorInset).coerceIn(min(indicatorInset, actualWidth / 2), max(actualWidth - indicatorInset, actualWidth / 2)).let { if (rtl) actualWidth - it else it }, actualHeight / 2)
                vertical -> Offset(actualWidth / 2, actualHeight - (max(thumbSize, actualHeight * fraction) - thumbSize / 2))
                else -> Offset((max(thumbSize, actualWidth * fraction) - thumbSize / 2).let { if (rtl) actualWidth - it else it }, actualHeight / 2)
            }
            val start = if (values.size == 2) fractions[0] else 0f
            val finish = fractions.last()
            val gesture = Modifier.pointerInput(domain, variant, orientation, enabled, readOnly, rtl, actualWidth, actualHeight, cancelGesture) {
                if (!enabled || readOnly || actualWidth <= 0 || actualHeight <= 0) return@pointerInput
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val initial = current
                    pointerStart = initial
                    val initialFractions = initial.map(domain::fraction)
                    var index = initialFractions.indices.minBy { (position(initialFractions[it]) - down.position).getDistance() }
                    val direct = (position(initialFractions[index]) - down.position).getDistance() <= LabComponents.SliderHitSize.dp.toPx() / 2
                    val firstPoint = if (vertical) actualHeight - down.position.y else if (rtl) actualWidth - down.position.x else down.position.x
                    val firstAngle = sliderCircleFraction(down.position - Offset(actualWidth / 2, actualHeight / 2))
                    val coincident = initial.size == 2 && (position(initialFractions[0]) - position(initialFractions[1])).getDistance() < .01f
                    val firstFraction = if (circular) firstAngle else firstPoint / if (vertical) actualHeight else actualWidth
                    if (coincident && !direct && firstFraction != null) {
                        index = when {
                            firstFraction >= initialFractions[1] -> 1
                            firstFraction <= initialFractions[0] -> 0
                            else -> initialFractions.indices.minBy { abs(initialFractions[it] - firstFraction) }
                        }
                    }
                    requests[index].requestFocus()
                    var awaitingDirection = coincident && direct
                    var angleOffset = if (direct && firstAngle != null) initialFractions[index] - firstAngle else 0f
                    // Track targeting is absolute. Only a thumb drag starts
                    // from the old value; subsequent samples keep continuity.
                    var previous = if (direct) initialFractions[index] else firstAngle ?: initialFractions[index]
                    var dragging = false
                    var completed = false
                    fun apply(point: Offset) {
                        val coordinate = if (vertical) actualHeight - point.y else if (rtl) actualWidth - point.x else point.x
                        val angle = if (circular) sliderCircleFraction(point - Offset(actualWidth / 2, actualHeight / 2)) else null
                        if (circular && angle == null) return
                        if (awaitingDirection) {
                            val delta = if (circular) {
                                var turn = (angle ?: 0f) - (firstAngle ?: 0f)
                                if (turn > .5f) turn -= 1f else if (turn < -.5f) turn += 1f
                                turn
                            } else coordinate - firstPoint
                            if (delta == 0f) return
                            index = if (circular && initialFractions[1] - initialFractions[0] == 1f) {
                                if (delta > 0) 0 else 1
                            } else if (delta > 0) 1 else 0
                            awaitingDirection = false
                            previous = initialFractions[index]
                            angleOffset = if (circular) initialFractions[index] - (firstAngle ?: 0f) else 0f
                            requests[index].requestFocus()
                        }
                        // The clamped center represents several values. Preserve
                        // the original value when a direct gesture returns there.
                        if (!circular && direct && coordinate == firstPoint) {
                            request(index, initial[index])
                            return
                        }
                        val fraction = when {
                            circular -> {
                                val adjusted = (angle ?: 0f) + angleOffset
                                (adjusted + floor(previous - adjusted + .5f)).coerceIn(0f, 1f).also { previous = it }
                            }
                            else -> {
                                val length = if (vertical) actualHeight else actualWidth
                                if (large) {
                                    if (direct) initialFractions[index] + (coordinate - firstPoint) / length else coordinate / length
                                } else {
                                    val center = position(initialFractions[index])
                                    val startCenter = if (vertical) actualHeight - center.y else if (rtl) actualWidth - center.x else center.x
                                    val target = if (direct) startCenter + coordinate - firstPoint else coordinate
                                    if (target <= thumbSize / 2) 0f else (target + thumbSize / 2) / length
                                }
                            }
                        }
                        request(index, domain.value(fraction))
                    }
                    try {
                        while (true) {
                            val event = awaitPointerEvent()
                            val pointer = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (pointer.isConsumed) break
                            if (!pointer.pressed) {
                                if (dragging || !direct) apply(pointer.position)
                                if (dragging) pointer.consume()
                                completed = true
                                coroutine.launch { withFrameNanos {}
                                    if (current != initial) end(current) }
                                break
                            }
                            val delta = pointer.position - down.position
                            if (!dragging && delta.getDistance() >= viewConfiguration.touchSlop) {
                                if (!circular && (if (vertical) abs(delta.x) > abs(delta.y) else abs(delta.y) > abs(delta.x))) break
                                dragging = true
                            }
                            if (dragging) { apply(pointer.position); pointer.consume() }
                        }
                    } finally {
                        pointerStart = null
                        if (!completed && current != initial) change(initial)
                    }
                }
            }
            val shape = RoundedCornerShape(LabComponents.SliderLargeRadius.dp)
            Box(Modifier.fillMaxSize().then(gesture).graphicsLayer {
                alpha = if (enabled) 1f else LabComponents.SliderDisabledOpacity
            }.then(if (large) Modifier.clip(shape) else Modifier)
                .drawWithCache {
                    val opacity = 1f
                    val stroke = Stroke(lineWidth)
                    onDrawBehind {
                        if (size.width <= 0 || size.height <= 0) return@onDrawBehind
                        if (large) {
                            drawRect(colors[LabComponents.SliderLargeTrackRole], alpha = opacity)
                            val left = if (rtl) size.width * (1 - finish) else 0f
                            val right = if (rtl) size.width else size.width * finish
                            clipRect(left = left, right = right) { drawRect(fill, alpha = opacity); drawRect(gradient, alpha = opacity) }
                        } else {
                            if (circular) {
                                val radius = max(0f, (min(size.width, size.height) - lineWidth) / 2)
                                drawCircle(track, radius, style = stroke, alpha = opacity)
                                if (finish - start >= 1f) drawCircle(active, radius, style = stroke, alpha = opacity)
                                else if (finish > start) drawArc(active, -90 + start * 360, (finish - start) * 360, false,
                                    Offset(lineWidth / 2, lineWidth / 2), Size(radius * 2, radius * 2), alpha = opacity, style = stroke)
                            } else {
                                val length = if (vertical) size.height else size.width
                                val lo = if (values.size == 2) max(thumbSize, length * start) - thumbSize / 2 else 0f
                                val hi = max(thumbSize, length * finish) - if (values.size == 2) thumbSize / 2 else 0f
                                val center = if (vertical) size.width / 2 else size.height / 2
                                if (vertical) {
                                    drawRoundRect(track, Offset(center - lineWidth / 2, 0f), Size(lineWidth, length), CornerRadius(lineWidth), alpha = opacity)
                                    drawRoundRect(active, Offset(center - lineWidth / 2, length - hi), Size(lineWidth, hi - lo), CornerRadius(lineWidth), alpha = opacity)
                                } else {
                                    drawRoundRect(track, Offset(0f, center - lineWidth / 2), Size(length, lineWidth), CornerRadius(lineWidth), alpha = opacity)
                                    drawRoundRect(active, Offset(if (rtl) length - hi else lo, center - lineWidth / 2), Size(hi - lo, lineWidth), CornerRadius(lineWidth), alpha = opacity)
                                }
                            }
                            fractions.forEachIndexed { index, fraction ->
                                val center = position(fraction)
                                if (focused == index && enabled) drawCircle(focus, thumbSize / 2 + 4.dp.toPx(), center, style = Stroke(2.dp.toPx()))
                                drawCircle(active, thumbSize / 2, center, alpha = opacity)
                                drawCircle(thumb, thumbSize / 2 - LabComponents.SliderThumbStroke.dp.toPx(), center, alpha = opacity)
                            }
                        }
                    }
                }) {
                if (large) {
                    val labelModifier = Modifier.fillMaxWidth().padding(horizontal = LabComponents.SliderLargeLabelInset.dp).clearAndSetSemantics {}
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                        LabText(label, labelModifier, style = baseStyle.withTypography(color = colors[LabComponents.SliderLargeLabelRole]), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Box(Modifier.fillMaxSize().drawWithContent {
                        clipRect(left = if (rtl) size.width * (1 - finish) else 0f,
                            right = if (rtl) size.width else size.width * finish) { this@drawWithContent.drawContent() }
                    }, contentAlignment = Alignment.CenterStart) {
                        LabText(label, labelModifier, style = baseStyle.withTypography(color = colors[LabComponents.SliderLargeActiveLabelRole]), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (finish > 0) Box(Modifier.fillMaxSize().drawWithContent {
                        clipRect(left = if (rtl) size.width * (1 - finish) else 0f,
                            right = if (rtl) size.width else size.width * finish) { this@drawWithContent.drawContent() }
                    }) {
                        val sigma = LabComponents.SliderLargeMaskBlur / 2
                        val maskWidth = LabComponents.SliderLargeMaskWidth + 6 * sigma
                        Box(Modifier.align(AbsoluteAlignment.TopLeft).absoluteOffset {
                            IntOffset((position(finish).x - maskWidth.dp.toPx() / 2).roundToInt(), (-3 * sigma).dp.roundToPx())
                        }) {
                            SliderIndicatorMask(Modifier.wrapContentSize(AbsoluteAlignment.TopLeft, unbounded = true)
                                .width(maskWidth.dp).height((height + 6 * sigma).dp))
                        }
                    }
                    Box(Modifier.fillMaxSize().drawWithCache {
                        val point = position(finish)
                        val indicatorWidth = LabComponents.SliderLargeIndicatorWidth.dp.toPx()
                        val indicatorHeight = LabComponents.SliderLargeIndicatorHeight.dp.toPx()
                        onDrawBehind {
                            if (size.width <= 0 || size.height <= 0) return@onDrawBehind
                            drawRoundRect(if (finish == 0f) active else colors[LabComponents.SliderLargeActiveLabelRole],
                                point - Offset(indicatorWidth / 2, indicatorHeight / 2), Size(indicatorWidth, indicatorHeight), CornerRadius(indicatorWidth))
                            if (focused == 0 && enabled) drawRoundRect(focus, Offset(2.dp.toPx(), 2.dp.toPx()),
                                Size(size.width - 4.dp.toPx(), size.height - 4.dp.toPx()), CornerRadius(LabComponents.SliderLargeRadius.dp.toPx()), style = Stroke(2.dp.toPx()))
                        }
                    })
                }
                values.forEachIndexed { index, value ->
                    val point = position(fractions[index])
                    val low = values.getOrNull(index - 1) ?: min
                    val high = values.getOrNull(index + 1) ?: max
                    val name = thumbLabels.getOrNull(index) ?: if (values.size == 1) label else "$label ${if (index == 0) "minimum" else "maximum"}"
                    Box(Modifier.align(AbsoluteAlignment.TopLeft).absoluteOffset { IntOffset((point.x - LabComponents.SliderHitSize.dp.toPx() / 2).roundToInt(),
                        (point.y - LabComponents.SliderHitSize.dp.toPx() / 2).roundToInt()) }
                        .size(LabComponents.SliderHitSize.dp).focusRequester(requests[index])
                        .onFocusChanged {
                            if (it.isFocused) focused = index
                            else if (focused == index) {
                                focused = -1
                                keyboardStart?.let { initial -> if (initial != current) end(current) }
                                keyboardStart = null
                            }
                        }
                        .semantics {
                            contentDescription = name
                            progressBarRangeInfo = domain.progressInfo(value, low, high)
                            if (!enabled) disabled()
                            if (enabled && !readOnly) setProgress { next ->
                                val updated = domain.accessibleChange(current, index, next)
                                if (updated == current) false else { change(updated); coroutine.launch { withFrameNanos {}; if (current == updated) end(current) }; true }
                            }
                        }.onKeyEvent { event ->
                            val key = event.key
                            if (key == Key.Escape && pointerStart != null) {
                                if (event.type == KeyEventType.KeyDown) cancelGesture++
                                true
                            } else if (key !in listOf(Key.DirectionLeft, Key.DirectionRight, Key.DirectionUp, Key.DirectionDown, Key.MoveHome, Key.MoveEnd, Key.PageUp, Key.PageDown)) false
                            else if (!enabled || readOnly) true
                            else if (event.type == KeyEventType.KeyUp) {
                                keyboardStart?.let { if (it != current) end(current) }; keyboardStart = null; true
                            } else {
                                if (keyboardStart == null) keyboardStart = current
                                val next = when (key) {
                                    Key.MoveHome -> low; Key.MoveEnd -> high
                                    Key.DirectionLeft -> value + if (rtl) step else -step
                                    Key.DirectionRight -> value + if (rtl) -step else step
                                    Key.DirectionDown -> value - step; Key.DirectionUp -> value + step
                                    Key.PageDown -> value - step * 10; else -> value + step * 10
                                }
                                request(index, next); true
                            }
                        }.focusable(enabled))
                }
            }
        }
    }
}

/** The shared blur rasterizer runs only when this tiny mask changes size/density.
 * Progress moves the retained alpha image; theme changes its paint. */
@Composable
private fun SliderIndicatorMask(modifier: Modifier) {
    val colors = LocalLabTheme.current.colors
    val fill = colors[LabComponents.SliderLargeActiveRole]
    val highlight = colors[LabComponents.SliderLargeHighlightRole].copy(alpha = LabComponents.SliderLargeHighlightOpacity)
    Box(modifier.drawWithCache {
        if (size.width < 1 || size.height < 1) return@drawWithCache onDrawBehind {}
        val sigma = LabComponents.SliderLargeMaskBlur.dp.toPx() / 2
        val padding = sigma * 3
        val bounds = Rect(Offset.Zero, size)
        val mask = rasterizeBlurMask(IntSize(ceil(size.width).toInt(), ceil(size.height).toInt()),
            listOf(Rect(padding, padding, size.width - padding, size.height - padding)), sigma)
        val gradient = Brush.verticalGradient(listOf(highlight, highlight.copy(alpha = 0f)), padding, size.height - padding)
        val layer = Paint()
        onDrawBehind {
            drawIntoCanvas { it.saveLayer(bounds, layer) }
            drawRect(fill)
            drawRect(gradient)
            drawImage(mask, blendMode = BlendMode.DstIn)
            drawIntoCanvas { it.restore() }
        }
    })
}
