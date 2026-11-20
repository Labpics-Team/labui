package pics.lab.ui

import java.math.BigDecimal
import kotlin.random.Random
import kotlin.test.*

class NumberInputValueTest {
    @Test fun decimalStepsDoNotAccumulateBinaryRounding() {
        val rules = NumberInputRules(null, null, 0.1)
        var value = "0"
        repeat(1000) { value = checkNotNull(rules.move(value, 1)) }
        assertEquals("100", value)
        repeat(1000) { value = checkNotNull(rules.move(value, -1)) }
        assertEquals("0", value)
        assertEquals("1", rules.move("0", 1, page = true))
        assertEquals("-0.9", rules.move(".1", -1, page = true))
    }

    @Test fun signedDecimalAdditionAndComparisonMatchIndependentBigDecimalOracle() {
        val random = Random(29170)
        repeat(5000) {
            fun decimal(): String = BigDecimal.valueOf(random.nextLong(-999_999_999_999L, 999_999_999_999L),
                random.nextInt(-290, 290)).toString()
            val leftText = decimal()
            val rightText = decimal()
            val left = checkNotNull(NumberInputValue.parse(leftText))
            val right = checkNotNull(NumberInputValue.parse(rightText))
            val expected = BigDecimal(leftText).add(BigDecimal(rightText)).stripTrailingZeros().toPlainString()
            assertEquals(expected, left.plus(right)?.toString(), "$leftText + $rightText")
            assertEquals(BigDecimal(leftText).compareTo(BigDecimal(rightText)).sign,
                left.compareTo(right).sign, "$leftText compared with $rightText")
        }
    }

    @Test fun commitClampsOnlyValidNumbersAndRetainsExactDraftDigits() {
        val rules = NumberInputRules(-2.5, 3.5, 0.1)
        assertEquals("3.5", rules.commit("9e1"))
        assertEquals("-2.5", rules.commit("-9e1"))
        assertEquals("0.10000000000000000001", rules.commit(".10000000000000000001"))
        assertEquals("0", rules.commit("-0.000"))
        assertEquals("1.25", rules.commit(" +01.250e0 "))
        assertEquals("", rules.commit(""))
        for (invalid in listOf("-", ".", "1e", "NaN", "Infinity", "-Infinity", "1e309", "1e-400", "1,5", "0xFF"))
            assertNull(rules.commit(invalid), invalid)
    }

    @Test fun emptyAndOutOfRangeDraftsRecoverToTheNearestPermittedNumber() {
        val rules = NumberInputRules(5.0, 10.0, 1.0)
        assertEquals("5", rules.move("", 1))
        assertEquals("5", rules.move("", -1))
        assertEquals("5", rules.move("1", 1))
        assertEquals("10", rules.move("20", -1))
        assertEquals("10", rules.move("9.5", 1))
        assertNull(rules.move("10", 1))
        assertNull(rules.move("5", -1))
        assertNull(rules.move("-", 1))
    }

    @Test fun finiteDomainIncludesSubnormalsAndRejectsOverflowAndUnavailableSteps() {
        val tiny = NumberInputRules(null, null, Double.MIN_VALUE)
        assertNotNull(tiny.commit(Double.MIN_VALUE.toString()))
        val twice = checkNotNull(tiny.move(Double.MIN_VALUE.toString(), 1))
        assertEquals(BigDecimal(Double.MIN_VALUE.toString()).multiply(BigDecimal.TWO).toPlainString(), twice)
        assertEquals("0", tiny.move(Double.MIN_VALUE.toString(), -1))
        val rules = NumberInputRules(null, null, 0.1)
        assertNull(rules.move("1e20", 1))
        assertNull(rules.move("-1e20", -1))
        assertNotNull(rules.commit(Double.MAX_VALUE.toString()))
        assertNull(NumberInputRules(null, null, Double.MAX_VALUE).move(Double.MAX_VALUE.toString(), 1))
        assertNull(NumberInputRules(null, null, Double.MAX_VALUE).move("0", 1, page = true))
        // The explicit bound permits a large step to reach the finite end.
        assertEquals("2", NumberInputRules(null, 2.0, Double.MAX_VALUE).move("1", 1, page = true))
    }

    @Test fun configurationAndWorkAreBoundedBeforeArithmetic() {
        for (step in listOf(0.0, -1.0, Double.NaN, Double.POSITIVE_INFINITY))
            assertFailsWith<IllegalArgumentException> { NumberInputRules(null, null, step) }
        assertFailsWith<IllegalArgumentException> { NumberInputRules(Double.NaN, null, 1.0) }
        assertFailsWith<IllegalArgumentException> { NumberInputRules(null, Double.POSITIVE_INFINITY, 1.0) }
        assertFailsWith<IllegalArgumentException> { NumberInputRules(2.0, 1.0, 1.0) }
        for (text in listOf("1e2147483647", "1e-2147483648", "1e99999999999999999", "1".repeat(1025)))
            assertNull(NumberInputValue.parse(text))
        assertNull(NumberInputRules(null, null, 1.0).commit(" ".repeat(1025)))
        assertNull(NumberInputRules(null, null, 1.0).move(" ".repeat(1025), 1))
        val edge = "-9." + "1".repeat(1021)
        assertEquals(1024, edge.length)
        assertNull(NumberInputRules(null, null, 1.0).move(edge, -1), "A produced draft must still fit the parser's bound")
    }

    private val Int.sign: Int get() = compareTo(0)
}
