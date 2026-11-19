package pics.lab.ui.colors

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import pics.lab.colors.ProgramRuntime
import pics.lab.colors.compileProgramWire
import pics.lab.ui.ColorProgramHost
import pics.lab.ui.LabAppearance
import pics.lab.ui.LabColorOutput
import pics.lab.ui.LabPreferences
import pics.lab.ui.loadLabColorProgram

/** A bounded set of native Programs for one theme scope, with deterministic native resource cleanup. */
public class LabColorsProgramHost : ColorProgramHost {
    private data class Key(val appearance: LabAppearance, val increasedContrast: Boolean)
    private data class Entry(val program: ProgramRuntime, val colors: LabColorOutput)
    private val lock = Any()
    private val entries = mutableMapOf<Key, Entry>()
    private var closed = false

    override suspend fun resolve(preferences: LabPreferences): LabColorOutput = withContext(Dispatchers.Default) {
        val key = Key(preferences.appearance, preferences.increasedContrast)
        synchronized(lock) {
            check(!closed) { "Colors host is closed" }
            entries[key]?.let { return@withContext it.colors }
        }
        // Resource I/O can suspend; never hold the native-handle monitor across it.
        val prepared = loadLabColorProgram(preferences)
        synchronized(lock) {
            check(!closed) { "Colors host is closed" }
            entries[key]?.let { return@withContext it.colors }
            val program = compileProgramWire(prepared.bytes, 1u)
            try {
                val output = program.updateObserved(1uL, listOf(1u), prepared.background, 1u).use { snapshot ->
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
                    prepared.output(slots, rgb, opacity)
                }
                entries[key] = Entry(program, output)
                output
            } catch (error: Throwable) {
                program.close()
                throw error
            }
        }
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
