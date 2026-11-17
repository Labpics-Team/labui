package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.hazeSource
import pics.lab.motion.MotionResult

public enum class LabSheetSize(internal val fraction: Float?) {
    Full(1f), TwoThirds(2f / 3f), Half(.5f), OneThird(1f / 3f), Flex(null),
}

/** Modal scene keeps the source retained and hides its semantics for the modal's entire lifetime. */
@Composable
public fun LabSheetHost(
    open: Boolean,
    title: String,
    onDismissRequest: () -> Unit,
    returnFocus: FocusRequester,
    recipe: LabMaterialRecipe,
    modifier: Modifier = Modifier,
    size: LabSheetSize = LabSheetSize.Flex,
    material: LabMaterial = LabMaterial.Glass,
    dismissLabel: String = "Закрыть",
    content: @Composable BoxScope.() -> Unit,
    sheet: @Composable ColumnScope.() -> Unit,
) {
    val capture = LocalLabCapture.current
    val colors = LocalLabTheme.current.colors
    val motion = rememberLabMotion()
    val progress = remember(motion) { motion.value(if (open) 1f else 0f, "sheet.reveal") }
    var present by remember { mutableStateOf(open) }
    var opened by remember { mutableStateOf(open) }
    val closeFocus = remember { FocusRequester() }
    LaunchedEffect(open) {
        if (open) { present = true; opened = true }
        if (!present) return@LaunchedEffect
        val result = motion.animate { to(progress, if (open) 1f else 0f) }.finished.await()
        if (!open && result == MotionResult.Finished) {
            present = false
        }
    }
    LaunchedEffect(present) {
        // Focus targets are placed on the following frame, after the modal semantics change.
        withFrameNanos { }
        if (!present && opened) returnFocus.requestFocus()
    }
    Box(modifier) {
        Box(Modifier.fillMaxSize().hazeSource(capture, zIndex = 1f)
            .then(if (present) Modifier.clearAndSetSemantics { }.focusProperties {
                onEnter = { cancelFocusChange() }
            } else Modifier), content = content)
        if (present) {
            LabModal(onDismissRequest) {
            LaunchedEffect(Unit) { withFrameNanos { }; closeFocus.requestFocus() }
            Box(Modifier.fillMaxSize().onPreviewKeyEvent {
                if (it.key == Key.Escape && it.type == KeyEventType.KeyUp) { onDismissRequest(); true } else false
            }) {
            Box(Modifier.fillMaxSize().graphicsLayer { alpha = progress.value.coerceIn(0f, 1f) }
                .background(colors["label-primary"].copy(alpha = .24f))
                .pointerInput(onDismissRequest) { detectTapGestures { onDismissRequest() } }.clearAndSetSemantics { })
            BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding(), contentAlignment = Alignment.BottomCenter) {
                val maximum = maxHeight
                val height = size.fraction?.let { maximum * it }
                val extent = if (height == null) Modifier.heightIn(max = maximum) else Modifier.heightIn(min = height, max = height)
                LabSurface(recipe, Modifier.widthIn(max = 640.dp).fillMaxWidth().then(extent)
                    .graphicsLayer { translationY = this.size.height * (1f - progress.value) }
                    .hazeSource(capture, zIndex = 2f)
                    .semantics { paneTitle = title; isTraversalGroup = true },
                    material, RoundedCornerShape(topStart = LabTokens.RadiusL.dp, topEnd = LabTokens.RadiusL.dp)) {
                    Column(Modifier.fillMaxWidth().padding(LabTokens.Space6.dp),
                        verticalArrangement = Arrangement.spacedBy(LabTokens.Space4.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            BasicText(title, Modifier.weight(1f), style = LabType.title())
                            LabButton(dismissLabel, onDismissRequest, Modifier.focusRequester(closeFocus),
                                intent = LabIntent.Neutral, kind = LabButtonKind.Ghost, size = LabControlSize.Small)
                        }
                        Column(Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(LabTokens.Space4.dp), content = sheet)
                    }
                }
            }
            }
            }
        }
    }
}
