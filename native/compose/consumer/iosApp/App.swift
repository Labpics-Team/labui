import SwiftUI
import LabUIExample

@main
struct LabUIExampleApp: App {
    // Compose owns safeDrawingPadding and IME insets for the whole scene.
    var body: some Scene { WindowGroup { LabUIView().ignoresSafeArea() } }
}

struct LabUIView: UIViewControllerRepresentable {
    final class Coordinator {
        let colors = LabColorsProgramHost()
        deinit { colors.close() }
    }
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIViewController(context: Context) -> UIViewController {
        var snackbarDuration = LabSnackbarDefaults.shared.durationMillis
        #if DEBUG
        if ProcessInfo.processInfo.environment["LABUI_UI_TEST_FILE_UPLOAD"] == "1" {
            // The native document provider exposes this application's Documents folder.
            // XCTest still picks the file through UIDocumentPicker and reads its returned URL.
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let file = documents.appendingPathComponent("lab-upload-document.txt")
            try! Data("Document imported through the system picker.".utf8).write(to: file)
            return MainKt.FileUploadViewController()
        }
        // XCTest snapshots can take longer than the authored action interval.
        // Only the Undo test supplies a longer interval; release uses the profile.
        if let raw = ProcessInfo.processInfo.environment["LABUI_UI_TEST_SNACKBAR_DURATION_MS"],
           let interval = Int64(raw), interval > 0 {
            snackbarDuration = interval
        }
        #endif
        return MainKt.MainViewController(host: context.coordinator.colors,
                                         snackbarDurationMillis: snackbarDuration)
    }
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
    static func dismantleUIViewController(_ uiViewController: UIViewController, coordinator: Coordinator) {
        coordinator.colors.close()
    }
}
