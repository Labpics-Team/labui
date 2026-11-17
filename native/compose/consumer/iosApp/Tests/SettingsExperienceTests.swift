import XCTest

final class SettingsExperienceTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }
    func testEditValidateAndSaveThroughNativeAccessibility() {
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
        name.tap()
        let keyboardIntroduction = app.otherElements["UIContinuousPathIntroductionView"]
        if keyboardIntroduction.waitForExistence(timeout: 2) {
            keyboardIntroduction.buttons["Continue"].tap()
        }
        let previous = name.value as? String ?? ""
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count))
        XCTAssertEqual(name.value as? String, "", "Clearing the editor must finish before editing the draft")
        name.typeText("Не сохранять")
        reveal(app.buttons["Отмена"], in: app, towardBottom: true).tap()
        XCTAssertTrue(app.staticTexts["Лаборатория"].waitForExistence(timeout: 5))
        open.tap()
        name.tap()
        XCTAssertEqual(name.value as? String, "Лаборатория")
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "Лаборатория".count))
        XCTAssertEqual(name.value as? String, "", "Validation must submit an actually empty name")
        reveal(app.buttons["Сохранить"], in: app, towardBottom: true).tap()
        reveal(app.staticTexts["Введите название"], in: app, towardBottom: false)
        name.tap()
        name.typeText("Нативная лаборатория 東京")
        reveal(app.buttons["Сохранить"], in: app, towardBottom: true).tap()
        XCTAssertTrue(app.staticTexts["Изменения сохранены"].waitForExistence(timeout: 5))
        XCTAssertTrue(open.exists)
        captureSettledFrame("Settings saved", in: app)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["Нативная лаборатория 東京"].waitForExistence(timeout: 15))
        open.tap()
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        XCTAssertEqual(name.value as? String, "Нативная лаборатория 東京")
        captureSettledFrame("Restored settings", in: app)
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
