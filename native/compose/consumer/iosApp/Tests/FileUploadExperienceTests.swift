import XCTest

final class FileUploadExperienceTests: XCTestCase {
    func testImportsReadsCancelsAndRemovesARealDocument() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["LABUI_UI_TEST_FILE_UPLOAD"] = "1"
        app.launch()
        func button(_ label: String) -> XCUIElement {
            let element = app.buttons[label]
            XCTAssertTrue(element.waitForExistence(timeout: 15), app.debugDescription)
            return element
        }
        func item(_ label: String) -> XCUIElement {
            let element = app.descendants(matching: .any)
                .matching(NSPredicate(format: "label == %@", label)).firstMatch
            XCTAssertTrue(element.waitForExistence(timeout: 10), app.debugDescription)
            return element
        }
        button("Document: No file chosen").tap()
        button("Cancel").tap()
        button("Document: No file chosen").tap()
        let browse = app.buttons["Browse"]
        if browse.waitForExistence(timeout: 2) { browse.tap() }
        item("On My iPhone").tap()
        item("Lab UI").tap()
        let document = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "lab-upload-document")).firstMatch
        XCTAssertTrue(document.waitForExistence(timeout: 10), app.debugDescription)
        document.tap()
        let selected = "Document: lab-upload-document.txt"
        button(selected)
        let imported = app.staticTexts["Document imported through the system picker."]
        XCTAssertTrue(imported.waitForExistence(timeout: 10), app.debugDescription)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Document imported through UIDocumentPicker"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        button(selected).tap()
        button("Cancel").tap()
        button(selected)
        XCTAssertTrue(imported.exists)
        button("Remove lab-upload-document.txt").tap()
        button("Document: No file chosen")
        let removed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: imported)
        XCTAssertEqual(XCTWaiter.wait(for: [removed], timeout: 5), .completed)
    }
}
