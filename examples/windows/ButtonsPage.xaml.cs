using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace LabUI.Buttons;

public sealed partial class ButtonsPage : Page
{
    private int activations;
    private readonly LifetimeProbe? lifetime;

    public ButtonsPage()
    {
        InitializeComponent();
        if (Environment.GetEnvironmentVariable("LABUI_LIFETIME_OBSERVATION") is { } lifetimePath)
        {
            _ = FindName(nameof(LifetimeCommands))
                ?? throw new InvalidOperationException("Не удалось загрузить команды lifetime probe.");
            lifetime = new LifetimeProbe(lifetimePath, LifetimeTarget, ButtonsRow, LifetimeStatus, () => activations);
            Unloaded += UnloadedPage;
        }
    }

    private void Activate(object sender, RoutedEventArgs args)
    {
        Result.Text = $"Действие выполнено: {++activations}";
        lifetime?.Activated(sender);
    }

    private void ArmLifetime(object sender, RoutedEventArgs args) => lifetime?.Arm();
    private void RestoreLifetime(object sender, RoutedEventArgs args) => lifetime?.Restore();
    private void CompleteLifetime(object sender, RoutedEventArgs args) => lifetime?.Complete();

    private void UnloadedPage(object sender, RoutedEventArgs args)
    {
        Unloaded -= UnloadedPage;
        lifetime?.Dispose();
    }

    private void LightTheme(object sender, RoutedEventArgs args) => RequestedTheme = ElementTheme.Light;
    private void DarkTheme(object sender, RoutedEventArgs args) => RequestedTheme = ElementTheme.Dark;

    private void ToggleEnabled(object sender, RoutedEventArgs args)
    {
        Unavailable.IsEnabled = !Unavailable.IsEnabled;
        Unavailable.Content = Unavailable.IsEnabled ? "Продолжить" : "Недоступно";
        ((LabButton)sender).Content = Unavailable.IsEnabled ? "Выключить кнопку" : "Включить кнопку";
    }
}
