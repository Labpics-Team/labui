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
        let previous = name.value as? String ?? ""
        name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count))
        app.buttons["Сохранить изменения"].tap()
        XCTAssertTrue(app.staticTexts["Введите название проекта"].waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Нативная лаборатория 東京")
        app.buttons["Сохранить изменения"].tap()
        XCTAssertTrue(app.staticTexts["Изменения сохранены"].waitForExistence(timeout: 5))
        XCTAssertTrue(open.exists)
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = "Settings saved"
        image.lifetime = .keepAlways
        add(image)
    }
}
