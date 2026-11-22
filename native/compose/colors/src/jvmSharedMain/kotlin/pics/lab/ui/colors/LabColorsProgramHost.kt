package pics.lab.ui.colors

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import pics.lab.colors.ProgramRuntime
import pics.lab.colors.compileProgramWire
import pics.lab.ui.ColorProgramHost
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabColorOutput
import pics.lab.ui.LabColorContext
import pics.lab.ui.LabPreparedColorProgram
import pics.lab.ui.LabPreferences
import pics.lab.ui.loadLabColorProgram

/** A bounded set of native Programs for one theme scope, with deterministic native resource cleanup. */
public class LabColorsProgramHost : ColorProgramHost {
    private data class Key(val appearance: LabAppearance, val increasedContrast: Boolean)
    private class Entry(val program: ProgramRuntime, val prepared: LabPreparedColorProgram) {
        var revision = 0uL
        var context: LabColorContext? = null
        var colors: LabColorOutput? = null
    }
    private val lock = Any()
    private val entries = mutableMapOf<Key, Entry>()
    private var closed = false

    override suspend fun resolve(preferences: LabPreferences): LabColorOutput = resolve(preferences, null)

    override suspend fun resolve(preferences: LabPreferences, context: LabColorContext?): LabColorOutput = withContext(Dispatchers.Default) {
        val key = Key(preferences.appearance, preferences.increasedContrast)
        synchronized(lock) {
            check(!closed) { "Colors host is closed" }
            entries[key]?.let { return@withContext update(it, context) }
        }
        // Resource I/O can suspend; never hold the native-handle monitor across it.
        val prepared = loadLabColorProgram(preferences)
        synchronized(lock) {
            check(!closed) { "Colors host is closed" }
            entries[key]?.let { return@withContext update(it, context) }
            val program = compileProgramWire(prepared.bytes, 1u)
            try {
                val entry = Entry(program, prepared)
                val output = update(entry, context)
                entries[key] = entry
                output
            } catch (error: Throwable) {
                program.close()
                throw error
            }
        }
    }

    private fun update(entry: Entry, context: LabColorContext?): LabColorOutput {
        if (entry.colors != null && entry.context == context) return entry.colors!!
        check(entry.revision != ULong.MAX_VALUE) { "Colors revision exhausted" }
        val backgrounds = context?.encoded() ?: entry.prepared.background
        val scenarios = List(backgrounds.size / 3) { (it + 1).toUInt() }
        val output = entry.program.updateObserved(++entry.revision, scenarios, backgrounds, 1u).use { snapshot ->
            val state = snapshot.state()
            check(state == "ready") { "Colors output is not ready: $state" }
            val count = snapshot.outputCount()
            require(count <= Int.MAX_VALUE.toULong() / 3u) { "Colors output exceeds the supported array size" }
            val slots = IntArray(count.toInt())
            val rgb = ByteArray(slots.size * 3)
            val opacity = DoubleArray(slots.size)
            for (index in slots.indices) {
                slots[index] = snapshot.outputSlot(index.toUInt()).toInt()
                val channels = snapshot.outputRgb(index.toUInt())
                require(channels.size == 3) { "Invalid Colors RGB output" }
                channels.copyInto(rgb, index * 3)
                opacity[index] = snapshot.outputOpacity(index.toUInt())
            }
            entry.prepared.output(slots, rgb, opacity)
        }
        entry.context = context
        entry.colors = output
        return output
    }

    override fun close() {
        synchronized(lock) {
            if (closed) return
            closed = true
            entries.values.forEach { it.program.close() }
            entries.clear()
        }
    }
}
