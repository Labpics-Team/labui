import AppKit
import CoreGraphics
import Foundation

if CommandLine.arguments.count == 2, let pid = Int32(CommandLine.arguments[1]) {
    guard let application = NSRunningApplication(processIdentifier: pid), application.activate(options: [.activateAllWindows]) else {
        throw NSError(domain: "WindowProbe", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not activate the requested browser process"])
    }
    RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1))
}

let windows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let frontmost = NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0
let rows = windows.enumerated().map { index, window in
    [
        "order": index,
        "id": window[kCGWindowNumber as String] ?? 0,
        "pid": window[kCGWindowOwnerPID as String] ?? 0,
        "owner": window[kCGWindowOwnerName as String] ?? "",
        "layer": window[kCGWindowLayer as String] ?? 0,
        "bounds": window[kCGWindowBounds as String] ?? [:],
        "onscreen": window[kCGWindowIsOnscreen as String] ?? false,
        "frontmostPid": frontmost
    ] as [String: Any]
}
let data = try JSONSerialization.data(withJSONObject: rows, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
