using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System.Text.Json;
using Windows.Foundation;
using Windows.UI.ViewManagement;

namespace LabUI.Buttons;

// Однократное наблюдение начальной геометрии примера; не является API компонента.
internal static class LayoutObservation
{
    internal static void Write(Page page, string path)
    {
        if (!page.IsLoaded || page.XamlRoot is null)
            throw new InvalidOperationException("Страница выгружена до снимка геометрии.");
        page.UpdateLayout();
        var buttons = Descendants(page).OfType<LabButton>()
            .Where(button => AutomationProperties.GetAutomationId(button).StartsWith("LabButton", StringComparison.Ordinal))
            .Select(button => new
            {
                automationId = AutomationProperties.GetAutomationId(button),
                size = button.Size.ToString(),
                isEnabled = button.IsEnabled,
                bounds = Bounds(button, page),
                texts = Descendants(button).OfType<TextBlock>()
                    .Where(text => text.Name is "PART_Label" or "PART_Description" && text.Visibility == Visibility.Visible)
                    .Select(text => new
                    {
                        part = text.Name,
                        text = text.Text,
                        bounds = Bounds(text, page),
                        desiredWidth = text.DesiredSize.Width,
                        desiredHeight = text.DesiredSize.Height,
                        fontSize = text.FontSize,
                        lineHeight = text.LineHeight,
                        lineStackingStrategy = text.LineStackingStrategy.ToString(),
                        isTextScaleFactorEnabled = text.IsTextScaleFactorEnabled
                    }).ToArray()
            }).ToArray();
        if (buttons.Length != 7 || buttons.Any(button => button.bounds.width <= 0 || button.bounds.height <= 0 || button.texts.Length == 0))
            throw new InvalidOperationException("Начальная геометрия семи кнопок ещё недоступна.");
        var observation = new
        {
            schemaVersion = 1,
            pid = Environment.ProcessId,
            observedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            textScaleFactor = new UISettings().TextScaleFactor,
            rasterizationScale = page.XamlRoot.RasterizationScale,
            theme = page.ActualTheme.ToString(),
            page = Bounds(page, page),
            buttons
        };
        // FontSize и LineHeight — исходные DIP, масштаб текста нелинеен.
        // Bounds описывает layout, но не удостоверяет отсутствие обрезанных глифов.
        using (var stream = new FileStream(path + ".tmp", FileMode.CreateNew, FileAccess.Write))
            JsonSerializer.Serialize(stream, observation);
        File.Move(path + ".tmp", path);
    }

    private sealed record Box(double x, double y, double width, double height);

    private static Box Bounds(FrameworkElement element, Page page)
    {
        var rect = element.TransformToVisual(page).TransformBounds(new Rect(0, 0, element.ActualWidth, element.ActualHeight));
        return new Box(rect.X, rect.Y, rect.Width, rect.Height);
    }

    private static IEnumerable<DependencyObject> Descendants(DependencyObject parent)
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            var child = VisualTreeHelper.GetChild(parent, index);
            yield return child;
            foreach (var descendant in Descendants(child)) yield return descendant;
        }
    }
}
