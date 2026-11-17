import SwiftUI
import LabUIExample

@main
struct LabUIExampleApp: App {
    var body: some Scene { WindowGroup { LabUIView().ignoresSafeArea(.keyboard) } }
}

struct LabUIView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController { MainKt.MainViewController() }
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
