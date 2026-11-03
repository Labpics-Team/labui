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
        window = new Window { Title = "LabUI", Content = new ButtonsPage() };
        window.AppWindow.Resize(new Windows.Graphics.SizeInt32(760, 680));
        window.Activate();
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
