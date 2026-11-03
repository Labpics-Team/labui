using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace LabUI.Buttons;

public sealed partial class ButtonsPage : Page
{
    private int activations;

    public ButtonsPage() => InitializeComponent();

    private void Activate(object sender, RoutedEventArgs args)
        => Result.Text = $"Действие выполнено: {++activations}";

    private void LightTheme(object sender, RoutedEventArgs args) => RequestedTheme = ElementTheme.Light;
    private void DarkTheme(object sender, RoutedEventArgs args) => RequestedTheme = ElementTheme.Dark;

    private void ToggleEnabled(object sender, RoutedEventArgs args)
    {
        Unavailable.IsEnabled = !Unavailable.IsEnabled;
        Unavailable.Content = Unavailable.IsEnabled ? "Продолжить" : "Недоступно";
        ((LabButton)sender).Content = Unavailable.IsEnabled ? "Выключить кнопку" : "Включить кнопку";
    }
}
