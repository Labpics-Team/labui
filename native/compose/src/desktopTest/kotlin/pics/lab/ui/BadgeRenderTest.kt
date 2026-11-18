package pics.lab.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalFontFamilyResolver
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Offscreen CPU scenes: no platform window or native colors host is needed. */
class BadgeRenderTest {
    private fun walk(node: SemanticsNode): List<SemanticsNode> = listOf(node) + node.children.flatMap(::walk)

    private fun nodes(scene: ImageComposeScene): List<SemanticsNode> = scene.semanticsOwners
        .flatMap { walk(it.rootSemanticsNode) }

    private fun settle(scene: ImageComposeScene, ready: () -> Boolean = { true }): ByteArray {
        var previous: ByteArray? = null
        var equalFrames = 0
        repeat(100) {
            val bytes = scene.render().use { image -> image.encodeToData()!!.use { it.bytes } }
            equalFrames = if (ready() && previous?.contentEquals(bytes) == true) equalFrames + 1 else 0
            if (equalFrames >= 4) return bytes
            previous = bytes
            Thread.sleep(10)
        }
        error("The badge scene did not settle")
    }

    private fun assertPaint(expected: Color, actual: Int) {
        val packed = expected.toArgb()
        for (shift in listOf(24, 16, 8, 0)) assertTrue(
            abs((packed shr shift and 255) - (actual shr shift and 255)) <= 1,
            "Expected ${packed.toUInt().toString(16)}, rendered ${actual.toUInt().toString(16)}",
        )
    }

    @Test fun labelAndDecorativeIconsUseTheirOwnPaintsWithoutAddingActions() {
        val roles = mapOf(
            "label-primary" to Color.Black,
            "badge-fill-blue" to Color(0xFF204080),
            "badge-label-on-blue" to Color(0xFFFFE080),
            "badge-icon-on-blue" to Color(0xFF80E0FF),
            "badge-tint-blue" to Color(0x804080C0),
            "badge-label-blue" to Color(0xFF602040),
            LabComponents.BadgeDisabledFillRole to Color(0x40606060),
            LabComponents.BadgeDisabledLabelRole to Color(0x80909090),
        )
        val theme = LabThemeState(LabColorOutput(roles))
        val ready = AtomicBoolean(false)
        val scene = ImageComposeScene(300, 140) {
            val font = labFontFamily()
            val resolver = LocalFontFamilyResolver.current
            LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
            LabTheme(theme, font) {
                Column(Modifier.fillMaxSize().background(Color.White).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((index, state) in listOf(LabBadgeType.Fill to true,
                        LabBadgeType.Tinted to true, LabBadgeType.Fill to false,
                        LabBadgeType.Tinted to false).withIndex()) {
                        LabBadge("Badge $index", Modifier.testTag("badge-$index"),
                            type = state.first, enabled = state.second,
                            icon = { Box(Modifier.size(size).background(color)
                                .semantics { contentDescription = "Decorative icon" }) },
                            iconEnd = { Box(Modifier.size(size).background(color)) })
                    }
                }
            }
        }
        try {
            settle(scene) { ready.get() }
            val allNodes = nodes(scene)
            val badges = (0..3).map { index -> allNodes.single {
                it.config.getOrNull(SemanticsProperties.TestTag) == "badge-$index"
            } }
            for ((index, badge) in badges.withIndex()) {
                assertEquals(listOf("Badge $index"), badge.config[SemanticsProperties.Text].map { it.text })
                assertEquals(20, badge.size.height, "The unscaled authored badge must be 20 dp high")
                assertFalse(badge.config.contains(SemanticsProperties.Role))
                assertFalse(badge.config.contains(SemanticsProperties.Disabled))
            }
            assertTrue(allNodes.none { it.config.contains(SemanticsActions.OnClick) ||
                it.config.contains(SemanticsActions.RequestFocus) || it.config.contains(SemanticsProperties.ContentDescription) })
            val layouts = scene.semanticsOwners.flatMap { walk(it.unmergedRootSemanticsNode) }
                .flatMap { node -> mutableListOf<TextLayoutResult>().also {
                    node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(it)
                } }
            assertEquals(4, layouts.size)
            for ((index, layout) in layouts.withIndex()) assertEquals(roles[when (index) {
                0 -> "badge-label-on-blue"
                1 -> "badge-label-blue"
                else -> LabComponents.BadgeDisabledLabelRole
            }], layout.layoutInput.style.color)
            scene.render().use { image ->
                val bitmap = org.jetbrains.skia.Bitmap.makeFromImage(image)
                try {
                    for ((index, badge) in badges.withIndex()) {
                        val fill = roles[when (index) {
                            0 -> "badge-fill-blue"
                            1 -> "badge-tint-blue"
                            else -> LabComponents.BadgeDisabledFillRole
                        }]!!
                        val icon = roles[when (index) {
                            0 -> "badge-icon-on-blue"
                            1 -> "badge-label-blue"
                            else -> LabComponents.BadgeDisabledLabelRole
                        }]!!
                        val x = badge.positionInRoot.x.toInt()
                        val y = badge.positionInRoot.y.toInt()
                        assertPaint(fill.compositeOver(Color.White),
                            bitmap.getColor(x + badge.size.width / 2, y + 2))
                        assertPaint(icon.compositeOver(fill).compositeOver(Color.White), bitmap.getColor(x + 14, y + 10))
                        assertPaint(icon.compositeOver(fill).compositeOver(Color.White),
                            bitmap.getColor(x + badge.size.width - 14, y + 10))
                    }
                } finally { bitmap.close() }
            }
        } finally { scene.close() }
    }

    @Test fun constrainedTextKeepsBothIconsInLogicalOrder() {
        for (direction in LayoutDirection.entries) {
            val theme = LabThemeState(initialLabColors(LabPreferences()))
            val bounds = mutableMapOf<String, Rect>()
            val scene = ImageComposeScene(200, 80) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    LabTheme(theme) {
                        LabBadge("A long badge label that cannot fit", Modifier.padding(16.dp).width(120.dp).testTag("badge"),
                            icon = { Box(Modifier.size(size).background(color).onGloballyPositioned { bounds["start"] = it.boundsInRoot() }) },
                            iconEnd = { Box(Modifier.size(size).background(color).onGloballyPositioned { bounds["end"] = it.boundsInRoot() }) })
                    }
                }
            }
            try {
                settle(scene)
                val badge = nodes(scene).single { it.config.getOrNull(SemanticsProperties.TestTag) == "badge" }
                val start = bounds.getValue("start")
                val end = bounds.getValue("end")
                assertEquals(12f, start.width)
                assertEquals(12f, end.width)
                assertTrue(if (direction == LayoutDirection.Ltr) start.left < end.left else start.left > end.left)
                assertTrue(start.left >= badge.boundsInRoot.left && end.right <= badge.boundsInRoot.right)
                assertTrue(start.right <= badge.boundsInRoot.right && end.left >= badge.boundsInRoot.left)
                assertEquals(listOf("A long badge label that cannot fit"), badge.config[SemanticsProperties.Text].map { it.text })
            } finally { scene.close() }
        }
    }

    @Test fun allAuthoredColorsRenderInBothThemesAndAtLargeTextScale() {
        val output = File("build/badge-render").apply { mkdirs() }
        for (appearance in LabAppearance.entries) for (scale in listOf(1f, 2f)) {
            val preferences = LabPreferences(appearance = appearance)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            val ready = AtomicBoolean(false)
            val scene = ImageComposeScene(440, 720, Density(1f, scale)) {
                val font = labFontFamily()
                val resolver = LocalFontFamilyResolver.current
                LaunchedEffect(font) { resolver.preload(font); ready.set(true) }
                LabTheme(theme, font) {
                    Column(Modifier.fillMaxSize().background(theme.colors["bg-primary"]).padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (color in LabBadgeColor.entries) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            for (type in LabBadgeType.entries) LabBadge("Badge", Modifier.testTag("$color-$type"), color, type,
                                icon = { Box(Modifier.size(size).background(this.color)) },
                                iconEnd = { Box(Modifier.size(size).background(this.color)) })
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            for (type in LabBadgeType.entries) LabBadge("Badge", Modifier.testTag("disabled-$type"),
                                type = type, enabled = false,
                                icon = { Box(Modifier.size(size).background(color)) },
                                iconEnd = { Box(Modifier.size(size).background(color)) })
                        }
                    }
                }
            }
            try {
                File(output, "badge-${appearance.name.lowercase()}-${(scale * 100).toInt()}.png")
                    .writeBytes(settle(scene) { ready.get() })
                val badges = nodes(scene).filter { it.config.contains(SemanticsProperties.TestTag) }
                assertEquals(32, badges.size)
                for (badge in badges) {
                    assertEquals(if (scale == 1f) 20 else 32, badge.size.height)
                    assertTrue(badge.boundsInRoot.right <= 440 && badge.boundsInRoot.bottom <= 720)
                }
            } finally { scene.close() }
        }
    }
}
