import XCTest

final class SettingsExperienceTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }
    func testEditValidateAndSaveThroughNativeAccessibility() {
        let app = XCUIApplication()
        app.launch()
        let open = app.buttons["Параметры проекта"]
        XCTAssertTrue(open.waitForExistence(timeout: 15))
        open.tap()
        print("NATIVE_SHEET_ACCESSIBILITY: \(app.debugDescription)")
        let sheetImage = XCTAttachment(screenshot: app.screenshot())
        sheetImage.name = "Settings sheet"
        sheetImage.lifetime = .keepAlways
        add(sheetImage)
        // Compose exposes editable semantics through UIKit's text-view trait, including single-line inputs.
        let name = app.textViews["Название проекта"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        let keyboardIntroduction = app.otherElements["UIContinuousPathIntroductionView"]
        if keyboardIntroduction.waitForExistence(timeout: 2) {
            keyboardIntroduction.buttons["Continue"].tap()
        }
        let previous = name.value as? String ?? ""
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count))
        reveal(app.buttons["Сохранить изменения"], in: app, towardBottom: true).tap()
        reveal(app.staticTexts["Введите название проекта"], in: app, towardBottom: false)
        name.tap()
        name.typeText("Нативная лаборатория 東京")
        reveal(app.buttons["Сохранить изменения"], in: app, towardBottom: true).tap()
        XCTAssertTrue(app.staticTexts["Изменения сохранены"].waitForExistence(timeout: 5))
        XCTAssertTrue(open.exists)
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = "Settings saved"
        image.lifetime = .keepAlways
        add(image)
    }

    /// Scroll within the visible Sheet body, including when the software keyboard reduces it.
    @discardableResult
    private func reveal(_ element: XCUIElement, in app: XCUIApplication, towardBottom: Bool) -> XCUIElement {
        for _ in 0..<8 {
            if element.exists && element.isHittable { return element }
            let top = app.buttons["Закрыть"].frame.maxY + 24
            let keyboard = app.keyboards.firstMatch
            let assistant = app.otherElements["SystemInputAssistantView"]
            // Keyboard.frame excludes UIKit's prediction/accessory strip above the keys.
            let keyboardTop = min(keyboard.exists ? keyboard.frame.minY : app.frame.maxY,
                                  assistant.exists ? assistant.frame.minY : app.frame.maxY)
            let bottom = keyboardTop - 24
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
