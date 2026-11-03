using Microsoft.UI.Xaml;

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
    }
}
