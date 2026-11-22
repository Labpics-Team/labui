import Foundation
import LabUIExample
import XCTest

/// Exercise the exported suspend API from Swift, including an NSError from a Swift host.
/// Kotlin-only callers cannot catch an unannotated exception crossing this boundary.
@MainActor
final class ThemeContextTests: XCTestCase {
    func testRejectedContextRetainsTheThemeAndAllowsRecovery() async throws {
        let light = LabPreferences(appearance: .light, increasedContrast: false,
                                   reducedMotion: false, reducedTransparency: false)
        let dark = LabPreferences(appearance: .dark, increasedContrast: false,
                                  reducedMotion: false, reducedTransparency: false)
        let initial = LabInitialColorsKt.initialLabColors(preferences: light)
        let white = try LabColorContext(backgrounds: [LabSrgb8(red: 255, green: 255, blue: 255)])
        let black = try LabColorContext(backgrounds: [LabSrgb8(red: 0, green: 0, blue: 0)])
        let state = LabThemeState(initialColors: initial, initialPreferences: light,
                                  initialContext: white)
        let host = ThemeTestHost(output: initial)
        defer { host.close() }

        do {
            _ = try await state.update(host: host, next: dark, context: black)
            XCTFail("A rejected Colors update must return an error to Swift")
        } catch {
            XCTAssertTrue(state.colors === initial)
            XCTAssertEqual(state.preferences, light)
            XCTAssertEqual(state.context, white)
        }

        host.reject = false
        _ = try await state.update(host: host, next: dark, context: black)
        XCTAssertEqual(state.preferences, dark)
        XCTAssertEqual(state.context, black)
        XCTAssertEqual(host.contexts, [black, black])
    }
}

private final class ThemeTestHost: NSObject, ColorProgramHost {
    let output: LabColorOutput
    var reject = true
    var contexts: [LabColorContext?] = []

    init(output: LabColorOutput) { self.output = output }

    func resolve(preferences: LabPreferences,
                 completionHandler: @escaping (LabColorOutput?, Error?) -> Void) {
        resolve(preferences: preferences, context: nil, completionHandler: completionHandler)
    }

    func resolve(preferences: LabPreferences, context: LabColorContext?,
                 completionHandler: @escaping (LabColorOutput?, Error?) -> Void) {
        contexts.append(context)
        if reject {
            completionHandler(nil, NSError(domain: "LabUI.ThemeContextTests", code: 1))
        } else {
            completionHandler(output, nil)
        }
    }

    func close() {}
}
