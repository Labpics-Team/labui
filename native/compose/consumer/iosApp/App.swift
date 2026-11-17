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
        MainKt.MainViewController(host: context.coordinator.colors)
    }
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
    static func dismantleUIViewController(_ uiViewController: UIViewController, coordinator: Coordinator) {
        coordinator.colors.close()
    }
}
