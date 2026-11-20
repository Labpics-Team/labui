package pics.lab.ui

/**
 * The editor keeps decimal text, not a repeatedly rounded binary accumulator.
 * Only comparison and signed addition are needed. Work and storage are bounded
 * by [MAX_DIGITS]; no arbitrary-precision runtime or platform adapter is needed.
 */
internal class NumberInputValue private constructor(
    private val sign: Int,
    private val digits: String,
    private val exponent: Int,
) : Comparable<NumberInputValue> {
    override fun compareTo(other: NumberInputValue): Int {
        if (sign != other.sign) return sign.compareTo(other.sign)
        if (sign == 0) return 0
        val places = digits.length + exponent
        val otherPlaces = other.digits.length + other.exponent
        if (places != otherPlaces) return sign * places.compareTo(otherPlaces)
        for (i in 0 until maxOf(digits.length, other.digits.length)) {
            val difference = (digits.getOrNull(i) ?: '0').compareTo(other.digits.getOrNull(i) ?: '0')
            if (difference != 0) return sign * difference
        }
        return 0
    }

    fun plus(other: NumberInputValue): NumberInputValue? {
        if (sign == 0) return other
        if (other.sign == 0) return this
        val commonExponent = minOf(exponent, other.exponent)
        val leftLength = digits.length + exponent - commonExponent
        val rightLength = other.digits.length + other.exponent - commonExponent
        val length = maxOf(leftLength, rightLength)
        if (length > MAX_DIGITS) return null
        val left = digits.padEnd(leftLength, '0')
        val right = other.digits.padEnd(rightLength, '0')
        val sameSign = sign == other.sign
        val comparison = if (leftLength != rightLength) leftLength.compareTo(rightLength) else left.compareTo(right)
        if (!sameSign && comparison == 0) return Zero
        val a = if (sameSign || comparison > 0) left else right
        val b = if (sameSign || comparison > 0) right else left
        val resultSign = if (sameSign || comparison > 0) sign else other.sign
        val result = CharArray(length + 1) { '0' }
        var carry = 0
        for (offset in 0 until length) {
            val av = a.getOrNull(a.lastIndex - offset)?.digitToInt() ?: 0
            val bv = b.getOrNull(b.lastIndex - offset)?.digitToInt() ?: 0
            val value = if (sameSign) av + bv + carry else av - bv + carry
            result[length - offset] = ('0'.code + if (value < 0) value + 10 else value % 10).toChar()
            carry = if (sameSign) value / 10 else if (value < 0) -1 else 0
        }
        result[0] = ('0'.code + carry).toChar()
        return normalized(resultSign, result.concatToString(), commonExponent)
    }

    fun step(direction: Int, page: Boolean): NumberInputValue =
        NumberInputValue(sign * direction, digits, exponent + if (page) 1 else 0)

    fun finiteDouble(): Double? = toString().toDoubleOrNull()?.takeIf { it.isFinite() && (it != 0.0 || sign == 0) }

    override fun toString(): String {
        if (sign == 0) return "0"
        val point = digits.length + exponent
        val magnitude = when {
            exponent >= 0 -> digits + "0".repeat(exponent)
            point > 0 -> digits.substring(0, point) + "." + digits.substring(point)
            else -> "0." + "0".repeat(-point) + digits
        }
        return if (sign < 0) "-$magnitude" else magnitude
    }

    companion object {
        // This is a UI input limit, not a claim of arbitrary precision. It covers
        // all finite Double bounds/steps, including subnormals, with ample room.
        const val MAX_DIGITS = 1024
        val Zero = NumberInputValue(0, "0", 0)
        private val syntax = Regex("^([+-]?)(?:([0-9]+)(?:\\.([0-9]*))?|\\.([0-9]+))(?:[eE]([+-]?[0-9]+))?$")

        fun parse(text: String): NumberInputValue? {
            if (text.length > MAX_DIGITS) return null
            val match = syntax.matchEntire(text.trim()) ?: return null
            val fraction = match.groupValues[3].ifEmpty { match.groupValues[4] }
            val power = match.groupValues[5].let { if (it.isEmpty()) 0 else it.toIntOrNull() } ?: return null
            if (power !in -MAX_DIGITS..MAX_DIGITS) return null
            return normalized(if (match.groupValues[1] == "-") -1 else 1,
                match.groupValues[2] + fraction, power - fraction.length)
        }

        fun from(value: Double): NumberInputValue = checkNotNull(parse(value.toString()))

        private fun normalized(sign: Int, raw: String, exponent: Int): NumberInputValue? {
            val significant = raw.trimStart('0')
            if (significant.isEmpty()) return Zero
            val digits = significant.trimEnd('0')
            val power = exponent + significant.length - digits.length
            val point = digits.length + power
            val expandedLength = when {
                power >= 0 -> point
                point > 0 -> digits.length + 1
                else -> 2 - point + digits.length
            }
            if (expandedLength + (if (sign < 0) 1 else 0) > MAX_DIGITS) return null
            return NumberInputValue(sign, digits, power)
        }
    }
}

/** Public limits are finite Double values; decimal drafts retain their exact digits. */
internal class NumberInputRules(min: Double?, max: Double?, step: Double) {
    init {
        require(min == null || min.isFinite()) { "Number Input minimum must be finite" }
        require(max == null || max.isFinite()) { "Number Input maximum must be finite" }
        require(min == null || max == null || min <= max) { "Number Input minimum must not exceed maximum" }
        require(step.isFinite() && step > 0) { "Number Input step must be finite and positive" }
    }
    private val minimum = min?.let(NumberInputValue::from)
    private val maximum = max?.let(NumberInputValue::from)
    private val increment = NumberInputValue.from(step)

    fun parse(text: String): NumberInputValue? = NumberInputValue.parse(text)?.takeIf { it.finiteDouble() != null }
    private fun clamp(value: NumberInputValue): NumberInputValue = when {
        minimum != null && value < minimum -> minimum
        maximum != null && value > maximum -> maximum
        else -> value
    }

    fun commit(text: String): String? = when {
        text.length > NumberInputValue.MAX_DIGITS -> null
        text.isBlank() -> ""
        else -> parse(text)?.let { clamp(it).toString() }
    }

    fun move(text: String, direction: Int, page: Boolean = false): String? {
        require(direction == -1 || direction == 1)
        if (text.length > NumberInputValue.MAX_DIGITS) return null
        // Empty fields start at zero clamped to the permitted range. Invalid
        // nonempty drafts are never replaced with an unrelated numeric value.
        if (text.isBlank()) return clamp(NumberInputValue.Zero).toString()
        val current = parse(text) ?: return null
        val bounded = clamp(current)
        if (bounded.compareTo(current) != 0) return bounded.toString()
        val proposed = current.plus(increment.step(direction, page)) ?: return null
        val next = clamp(proposed)
        val nextDouble = next.finiteDouble() ?: return null
        // A step must move in the requested direction in the public numeric
        // domain too. Overflow and steps below its resolution are unavailable.
        val currentDouble = current.finiteDouble()!!
        if (direction > 0 && nextDouble <= currentDouble || direction < 0 && nextDouble >= currentDouble) return null
        return next.toString()
    }
}
