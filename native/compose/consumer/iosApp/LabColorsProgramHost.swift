import Foundation
import LabColors
import LabUIExample

/// The SwiftPM solver sits behind the shared Kotlin host protocol; UI components only see roles.
final class LabColorsProgramHost: NSObject, ColorProgramHost {
    private struct Entry {
        let program: ProgramRuntime
        let colors: LabColorOutput
    }
    private let queue = DispatchQueue(label: "pics.lab.ui.colors", qos: .userInitiated)
    private var entries: [String: Entry] = [:]
    private var closed = false

    func resolve(preferences: LabPreferences, completionHandler: @escaping (LabColorOutput?, Error?) -> Void) {
        let key = "\(preferences.appearance.name):\(preferences.increasedContrast)"
        // Start Kotlin's exported suspend loader on main. Native solving happens on the private
        // queue; callbacks leave that queue before returning to Kotlin or disposing the host.
        DispatchQueue.main.async {
            LabColorProgramsKt.loadLabColorProgram(preferences: preferences) { prepared, error in
                guard let prepared else {
                    completionHandler(nil, error ?? Self.failure("No prepared Colors program"))
                    return
                }
                self.queue.async {
                    let result: Result<LabColorOutput, Error> = Result {
                        guard !self.closed else { throw Self.failure("Colors host is closed") }
                        if let entry = self.entries[key] { return entry.colors }
                        let program = try compileProgramWire(bytes: Self.data(prepared.bytes), streamId: 1)
                        let snapshot = try program.updateObserved(revision: 1, scenarioIds: [1],
                            surfaces: Self.data(prepared.background), surfaceCount: 1)
                        guard snapshot.outputCount() <= UInt64(Int32.max / 3) else {
                            throw Self.failure("Colors output exceeds the supported array size")
                        }
                        let count = Int32(snapshot.outputCount())
                        let slots = KotlinIntArray(size: count)
                        let rgb = KotlinByteArray(size: count * 3)
                        let opacity = KotlinDoubleArray(size: count)
                        for index in 0..<count {
                            slots.set(index: index, value: Int32(bitPattern: try snapshot.outputSlot(index: UInt32(index))))
                            let channels = try snapshot.outputRgb(index: UInt32(index))
                            guard channels.count == 3 else { throw Self.failure("Invalid Colors RGB output") }
                            for channel in 0..<3 {
                                rgb.set(index: index * 3 + Int32(channel), value: Int8(bitPattern: channels[channel]))
                            }
                            opacity.set(index: index, value: try snapshot.outputOpacity(index: UInt32(index)))
                        }
                        let colors = try prepared.output(outputSlots: slots, rgb: rgb, opacity: opacity)
                        self.entries[key] = Entry(program: program, colors: colors)
                        return colors
                    }
                    DispatchQueue.main.async {
                        switch result {
                        case .success(let colors): completionHandler(colors, nil)
                        case .failure(let error): completionHandler(nil, error)
                        }
                    }
                }
            }
        }
    }

    func close() {
        queue.sync {
            closed = true
            entries.removeAll() // UniFFI releases native Programs when their Swift references die.
        }
    }

    private static func data(_ bytes: KotlinByteArray) -> Data {
        Data((0..<bytes.size).map { UInt8(bitPattern: bytes.get(index: $0)) })
    }

    private static func failure(_ message: String) -> NSError {
        NSError(domain: "pics.lab.ui.colors", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
