import XCTest

final class SettingsExperienceTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }
    func testEditValidateAndSaveThroughNativeAccessibility() throws {
        let app = XCUIApplication()
        app.launch()
        let open = app.buttons["Редактировать"]
        XCTAssertTrue(open.waitForExistence(timeout: 15))
        captureSettledFrame("Workspace", in: app)
        open.tap()
        print("NATIVE_SHEET_ACCESSIBILITY: \(app.debugDescription)")
        captureSettledFrame("Settings sheet", in: app)
        // Compose exposes editable semantics through UIKit's text-view trait, including single-line inputs.
        let name = app.textViews["Название"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        let previousName = try XCTUnwrap(name.value as? String)
        let changedName = previousName == "Нативная лаборатория 東京"
            ? "Новая лаборатория 東京" : "Нативная лаборатория 東京"
        name.tap()
        let keyboardIntroduction = app.otherElements["UIContinuousPathIntroductionView"]
        if keyboardIntroduction.waitForExistence(timeout: 2) {
            keyboardIntroduction.buttons["Continue"].tap()
        }
        clear(name, in: app)
        name.typeText("Не сохранять")
        reveal(app.buttons["Отмена"], in: app, towardBottom: true).tap()
        XCTAssertTrue(app.staticTexts[previousName].waitForExistence(timeout: 5))
        open.tap()
        name.tap()
        XCTAssertEqual(name.value as? String, previousName)
        clear(name, in: app)
        reveal(app.buttons["Сохранить"], in: app, towardBottom: true).tap()
        reveal(message("Введите название", in: app), in: app, towardBottom: false)
        name.tap()
        name.typeText(changedName)
        expectValue(changedName, in: name)
        reveal(app.buttons["Сохранить"], in: app, towardBottom: true).tap()
        // A slow XCTest snapshot can outlive the automatic Snackbar. The save contract
        // is the committed workspace, then the same data after a fresh process launch.
        XCTAssertTrue(app.staticTexts[changedName].waitForExistence(timeout: 15))
        XCTAssertTrue(open.exists)
        captureSettledFrame("Settings saved", in: app)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts[changedName].waitForExistence(timeout: 15))
        open.tap()
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        XCTAssertEqual(name.value as? String, changedName)
        captureSettledFrame("Restored settings", in: app)
    }

    func testUndoRestoresThePreviousSavedWorkspace() throws {
        let app = XCUIApplication()
        app.launchEnvironment["LABUI_UI_TEST_SNACKBAR_DURATION_MS"] = "60000"
        app.launch()
        let open = app.buttons["Редактировать"]
        XCTAssertTrue(open.waitForExistence(timeout: 15))
        open.tap()
        let name = app.textViews["Название"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        let previousName = try XCTUnwrap(name.value as? String)
        let changedName = previousName == "Отменяемая лаборатория"
            ? "Другая лаборатория" : "Отменяемая лаборатория"
        name.tap()
        let keyboardIntroduction = app.otherElements["UIContinuousPathIntroductionView"]
        if keyboardIntroduction.waitForExistence(timeout: 2) {
            keyboardIntroduction.buttons["Continue"].tap()
        }
        clear(name, in: app)
        name.typeText(changedName)
        expectValue(changedName, in: name)
        reveal(app.buttons["Сохранить"], in: app, towardBottom: true).tap()
        XCTAssertTrue(app.staticTexts[changedName].waitForExistence(timeout: 15))
        let undo = app.buttons["Отменить"]
        XCTAssertTrue(undo.waitForExistence(timeout: 15))
        undo.tap()
        XCTAssertTrue(app.staticTexts[previousName].waitForExistence(timeout: 15))
        open.tap()
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        XCTAssertEqual(name.value as? String, previousName)
    }

    private func clear(_ editor: XCUIElement, in app: XCUIApplication) {
        // A tap places the caret at the tapped glyph, not at the end. Use the
        // native selection menu so deletion does not depend on text geometry.
        editor.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        editor.press(forDuration: 1.1)
        let selectAll = app.menuItems["Select All"]
        XCTAssertTrue(selectAll.waitForExistence(timeout: 3), app.debugDescription)
        selectAll.tap()
        editor.typeText(XCUIKeyboardKey.delete.rawValue)
        expectValue("", in: editor)
    }

    private func expectValue(_ value: String, in editor: XCUIElement) {
        // Compose's UIKit bridge represents an empty EditableText without a
        // placeholder as nil. Non-empty text must still match exactly, and a
        // missing element must never be mistaken for a successfully cleared one.
        var observed: Any?
        let updated = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in
                guard editor.exists else { return false }
                let actual = editor.value
                observed = actual
                return (actual as? String) == value || (value.isEmpty && actual == nil)
            }, object: editor)
        XCTAssertEqual(XCTWaiter.wait(for: [updated], timeout: 5), .completed,
                       "Native input did not reach \(value.debugDescription); " +
                       "actual: \(String(reflecting: observed)); " +
                       "type: \(observed.map { String(reflecting: type(of: $0)) } ?? "nil"); " +
                       "scalars: \((observed as? String)?.unicodeScalars.map(\.value) ?? [])\n" +
                       editor.debugDescription)
    }

    private func message(_ label: String, in app: XCUIApplication) -> XCUIElement {
        // Compose live regions use UIKit's generic accessibility element, not StaticText.
        // The public announcement is its label; its UIKit trait is an implementation detail.
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func captureSettledFrame(_ title: String, in app: XCUIApplication) {
        var previous: Data? = nil
        var unchanged = 0
        for _ in 0..<80 {
            let screenshot = app.screenshot()
            let data = screenshot.pngRepresentation
            unchanged = previous == data ? unchanged + 1 : 0
            if unchanged >= 4 {
                let image = XCTAttachment(screenshot: screenshot)
                image.name = title
                image.lifetime = .keepAlways
                add(image)
                return
            }
            previous = data
            Thread.sleep(forTimeInterval: 0.1)
        }
        XCTFail("Native frame did not settle: \(title)")
    }

    /// Scroll within the visible Sheet body, including when the software keyboard reduces it.
    @discardableResult
    private func reveal(_ element: XCUIElement, in app: XCUIApplication, towardBottom: Bool) -> XCUIElement {
        for _ in 0..<8 {
            if element.exists && element.isHittable { return element }
            let headerBottom = max(app.buttons["Закрыть"].frame.maxY,
                                   app.staticTexts["Настройки пространства"].frame.maxY)
            let keyboard = app.keyboards.firstMatch
            let assistant = app.otherElements["SystemInputAssistantView"]
            // Keyboard.frame excludes UIKit's prediction/accessory strip above the keys.
            let keyboardTop = min(keyboard.exists ? keyboard.frame.minY : app.frame.maxY,
                                  assistant.exists ? assistant.frame.minY : app.frame.maxY)
            let bottom = keyboardTop - 24
            // A wrapping title can extend below the close button. Start in the body,
            // beyond the header gap, so a downward gesture scrolls instead of dismissing.
            let top = headerBottom + (bottom - headerBottom) * 0.25
            XCTAssertGreaterThan(bottom, top, "Sheet must leave a scrollable body above the keyboard")
            let origin = app.coordinate(withNormalizedOffset: .zero)
            let upper = origin.withOffset(CGVector(dx: app.frame.midX, dy: top))
            let lower = origin.withOffset(CGVector(dx: app.frame.midX, dy: bottom))
            (towardBottom ? lower : upper).press(forDuration: 0.1, thenDragTo: towardBottom ? upper : lower)
        }
        XCTFail("Sheet element did not become reachable: \(element)\n\(app.debugDescription)")
        return element
    }
}
