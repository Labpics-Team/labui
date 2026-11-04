using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;

namespace LabUI.Buttons;

// Пассивная проба живого измерения; включается только через --sheet-content.
internal sealed class SheetContentProbe
{
    private readonly string scenario;
    private readonly ListView? list;
    internal FrameworkElement Content { get; }

    internal SheetContentProbe(string scenario)
    {
        this.scenario = scenario;
        if (scenario == "list")
        {
            list = new ListView { ItemsSource = Enumerable.Range(0, 1000) };
            Content = list;
        }
        else if (scenario is "long" or "short")
        {
            var panel = new StackPanel();
            for (var index = 0; index < (scenario == "long" ? 30 : 1); index++)
                panel.Children.Add(new TextBlock { Text = $"Строка {index + 1}", Height = 100 });
            Content = panel;
        }
        else throw new ArgumentException("Неизвестная проба содержимого Sheet.", nameof(scenario));
    }

    internal object Snapshot(ScrollViewer? viewport)
    {
        var size = LayoutInformation.GetAvailableSize(Content);
        return new
        {
            scenario,
            lastMeasure = new { width = Finite(size.Width), height = Finite(size.Height) },
            unboundedWidth = !double.IsFinite(size.Width),
            unboundedHeight = !double.IsFinite(size.Height),
            contentLoaded = Content.IsLoaded,
            actualHeight = Finite(Content.ActualHeight),
            desiredHeight = Finite(Content.DesiredSize.Height),
            outer = ScrollData(viewport),
            inner = ScrollData(Find<ScrollViewer>(Content)),
            realizedItems = list is null ? (int?)null : Enumerable.Range(0, 1000).Count(index => list.ContainerFromIndex(index) is not null)
        };
    }

    private static double? Finite(double value) => double.IsFinite(value) ? value : null;
    private static object? ScrollData(ScrollViewer? viewport) => viewport is null ? null : new
    {
        extentHeight = Finite(viewport.ExtentHeight),
        viewportHeight = Finite(viewport.ViewportHeight),
        scrollableHeight = Finite(viewport.ScrollableHeight),
        sizesContentToTemplatedParent = Find<ScrollContentPresenter>(viewport)?.SizesContentToTemplatedParent
    };

    private static T? Find<T>(DependencyObject parent) where T : DependencyObject
    {
        if (parent is T found) return found;
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            if (Find<T>(VisualTreeHelper.GetChild(parent, index)) is { } child) return child;
        return null;
    }
}
