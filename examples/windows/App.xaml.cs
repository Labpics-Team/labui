using Microsoft.UI.Xaml;
using System.Text.Json;
using Windows.UI.ViewManagement;

namespace LabUI.Buttons;

public partial class App : Application
{
    private Window? window;

    public App() => InitializeComponent();

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var arguments = Environment.GetCommandLineArgs().Skip(1).ToHashSet(StringComparer.Ordinal);
        var sheet = arguments.Contains("--sheet");
        window = new Window
        {
            Title = "LabUI",
            Content = sheet ? new SheetPage(arguments.Contains("--dark"), arguments.Contains("--solid"),
                arguments.Contains("--content")) : new ButtonsPage()
        };
        var sheetPage = window.Content as SheetPage;
        if (sheetPage is not null) sheetPage.HostWindow = window;
        if (sheet) window.AppWindow.ResizeClient(new Windows.Graphics.SizeInt32(375, 812));
        else window.AppWindow.Resize(new Windows.Graphics.SizeInt32(760, 680));
        if (sheetPage is not null) sheetPage.WindowAfterResize = SheetPage.ReadWindowGeometry(window);
        window.Activate();
        if (sheetPage is not null) sheetPage.WindowAfterActivation = SheetPage.ReadWindowGeometry(window);
        WriteAnimationObservation();
    }

    private static void WriteAnimationObservation()
    {
        var path = Environment.GetEnvironmentVariable("LABUI_ANIMATION_OBSERVATION");
        if (path is null) return;
        var observation = new
        {
            pid = Environment.ProcessId,
            animationsEnabled = new UISettings().AnimationsEnabled,
            observedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
        // Harness читает только полностью записанный снимок этого процесса.
        using (var stream = new FileStream(path + ".tmp", FileMode.CreateNew, FileAccess.Write))
            JsonSerializer.Serialize(stream, observation);
        File.Move(path + ".tmp", path);
    }
}
