package pics.lab.ui

import androidx.compose.runtime.saveable.SaverScope
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.math.abs
import kotlin.math.min
import kotlin.test.*

class ColorPickerValueTest {
    @Test fun rawDoubleAndAlphaSurviveEveryProjectionAndReset() {
        val raw = LabColorValue(LabColorSpace.Hsv, 13.1234567890123, 79.5678912345678, 43.1234567890123, .5019607843137255)
        val original = serializeLabColorValue(raw)
        repeat(100) { for (space in LabColorSpace.entries) ColorPickerCodec.coords(raw, space); ColorPickerCodec.paint(raw); ColorPickerCodec.hex(raw) }
        assertEquals(original, serializeLabColorValue(raw))
        assertEquals(raw.coords, ColorPickerCodec.coords(raw, LabColorSpace.Hsv))
        val caller = mutableListOf(.123456789012345, .5, .75)
        val safe = LabColorValue(LabColorSpace.Srgb, caller)
        caller[0] = 1.0
        assertEquals(.123456789012345, safe[0])
        val state = LabColorPickerState(raw)
        state.value = null; assertTrue(state.isMissing(true)); assertFalse(state.isMissing(true, readOnly = true))
        state.reset(); assertEquals(original, state.formValue()); assertEquals(raw, state.value)
    }

    @Test fun preciseTextCommitRetainsLchAndHexAlpha() {
        val text = "lch(72.09123456789 84.86123456789 65.34123456789 / .5019607843137255)"
        val parsed = assertNotNull(parseColorField(text, LabColorModel.Lch, 1.0))
        assertEquals(listOf(72.09123456789,84.86123456789,65.34123456789), parsed.coords)
        assertEquals(.5019607843137255, parsed.alpha)
        assertEquals(128 / 255.0, parseColorField("#FFA50080",LabColorModel.Hex,1.0)!!.alpha)
        assertNull(parseColorField("lch(NaN 1 2)",LabColorModel.Lch,1.0))
        assertNull(parseColorField("#XYZXYZ",LabColorModel.Hex,1.0))
        assertNull(parseColorField("lch(50 50 30 / 2)",LabColorModel.Lch,1.0))
    }

    @Test fun savedFormStateRetainsCurrentAndResetCoordinatesWithoutRounding() {
        val initial = LabColorValue(LabColorSpace.Hsv,13.1234567890123,79.5678912345678,43.1234567890123,.5019607843137255)
        val current = LabColorValue(LabColorSpace.Lch,50.1234567890123,120.1234567890123,250.1234567890123,.7654321098765)
        val state = LabColorPickerState(initial).apply { value=current }
        val scope = object : SaverScope { override fun canBeSaved(value: Any): Boolean = true }
        val saved = with(ColorPickerStateSaver) { assertNotNull(scope.save(state)) }
        val restored = assertNotNull(ColorPickerStateSaver.restore(saved))
        assertEquals(current,restored.value)
        restored.reset(); assertEquals(initial,restored.value)
    }

    @Test fun floatProjectionMatchesIndependentCssD50CodecWithinDisplayBudget() {
        val maximum = mutableMapOf<String, Double>()
        val vectors = javaClass.getResourceAsStream("/color-picker-colorjs.tsv")!!.bufferedReader().readLines()
        val expectedRgb = vectors.map { it.split('\t') }.filter { it[4] == "srgb" }.associate { it.take(4).joinToString("\t") to it.drop(5).map(String::toDouble) }
        for (line in vectors) {
            val p = line.split('\t')
            val space = LabColorSpace.entries.first { it.cssName == p[0] }
            val color = LabColorValue(space,p[1].toDouble(),p[2].toDouble(),p[3].toDouble(),.5019607843137255)
            val target = p[4]
            val expected = p.drop(5).map(String::toDouble)
            val actual = when (target) { "p3" -> ColorPickerCodec.rgb(color,ColorPickerGamut.P3); "rec2020" -> ColorPickerCodec.rgb(color,ColorPickerGamut.Rec2020); else -> ColorPickerCodec.coords(color,LabColorSpace.entries.first { it.cssName == target }) }
            val reference = expectedRgb.getValue(p.take(4).joinToString("\t"))
            val achromatic = reference.max() - reference.min() < 1e-10
            val unboundedHslSaturation = target == "hsl" && expected[1] > 100
            if (unboundedHslSaturation || target == "hsl" && achromatic) {
                // Outside the RGB gamut HSL saturation is unbounded and ill-conditioned
                // near L=0/1. Judge its effect in RGB, retaining the same display budget.
                val roundTrip = ColorPickerCodec.coords(LabColorValue(LabColorSpace.Hsl,actual,color.alpha),LabColorSpace.Srgb)
                val error = (0..2).maxOf { abs(roundTrip[it]-reference[it]) }
                maximum["hsl-outside-rgb-roundtrip"] = maxOf(maximum["hsl-outside-rgb-roundtrip"] ?: 0.0,error)
                assertTrue(error <= .00002,"$line: unbounded HSL projection changes RGB by $error")
            }
            for (index in 0..2) {
                val hue = target == "lch" && index == 2 || (target == "hsl" || target == "hsv") && index == 0
                if (hue && (expected[1] < .001 || target in listOf("hsl","hsv") && achromatic)) continue
                // At exact white, Double cancellation can assign arbitrary HSL saturation
                // as well as hue. The RGB roundtrip above checks the meaningful color.
                if (target == "hsl" && index == 1 && achromatic) continue
                var error = abs(expected[index] - actual[index])
                if (hue) error = min(error % 360, 360 - error % 360)
                val key = if (unboundedHslSaturation && index == 1) "hsl-unbounded-saturation" else target
                maximum[key] = maxOf(maximum[key] ?: 0.0,error)
                if (unboundedHslSaturation && index == 1) continue
                val limit = if (target in listOf("srgb","p3","rec2020")) .00002 else .005
                assertTrue(error <= limit, "$line: channel $index expected ${expected[index]}, actual ${actual[index]}, error $error")
            }
        }
        File("build/color-picker-render").mkdirs()
        File("build/color-picker-render/codec-errors.txt").writeText("${vectors.size} independent Color.js 0.7.1 vectors\n" + maximum.entries.joinToString("\n") { "${it.key}: ${it.value}" })
    }

    @Test fun graphKeysTrackOnlyFixedCoordinateGeometryAndGamut() = runBlocking {
        val color = LabColorValue(LabColorSpace.Lch,72.09,84.86,65.34)
        val key = colorGraphKey(color, ColorPickerPlane.HueChroma,250,80,false,false)
        assertEquals(key,colorGraphKey(color.copy(alpha=.1),ColorPickerPlane.HueChroma,250,80,false,false))
        assertEquals(key,colorGraphKey(color.copy(coords=listOf(72.09,20.0,230.0)),ColorPickerPlane.HueChroma,250,80,false,false))
        assertNotEquals(key,colorGraphKey(color.copy(coords=listOf(60.0,84.86,65.34)),ColorPickerPlane.HueChroma,250,80,false,false))
        assertNotEquals(key,colorGraphKey(color,ColorPickerPlane.HueChroma,250,80,true,false))
        val cache = ColorGraphCache()
        val start = System.nanoTime()
        val first = cache.image(key)
        val firstMs = (System.nanoTime() - start) / 1_000_000.0
        val cached = System.nanoTime()
        assertSame(first,cache.image(key))
        val cachedMs = (System.nanoTime() - cached) / 1_000_000.0
        assertEquals(1,cache.rasterizations)
        File("build/color-picker-render").mkdirs()
        val fullStart = System.nanoTime()
        cache.image(colorGraphKey(color,ColorPickerPlane.LightnessChroma,342,165,true,true))
        val fullMs = (System.nanoTime() - fullStart) / 1_000_000.0
        val warm = (1..5).map { index ->
            val start = System.nanoTime()
            cache.image(colorGraphKey(color.copy(coords=listOf(72.09,84.86,65.34+index)),ColorPickerPlane.LightnessChroma,342,165,true,true))
            (System.nanoTime() - start) / 1_000_000.0
        }.sorted()
        File("build/color-picker-render/raster-performance.txt").writeText("250x80 CPU cold=$firstMs ms; cached=$cachedMs ms\n342x165 all gamuts first=$fullMs ms; warm median=${warm[2]} ms; warm max=${warm.last()} ms; rasterizations=${cache.rasterizations}\n")
    }
}
