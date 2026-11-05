using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Markup;
using Microsoft.UI.Xaml.Media;
using System.Diagnostics;
using Windows.Foundation;

namespace LabUI.Buttons;

// Диагностический consumer: штатные панели и native API, без собственной layout-политики.
internal sealed class SheetContentProbe
{
    private readonly string scenario;
    private readonly ListView? list;
    private readonly List<ProbeCycle> cycles = [];
    private string status = "pending";
    private string phase = "initial-layout";
    private ProbeFailure? failure;
    private ViewChange? reset;
    private TemplateReplacement? replacement;
    internal FrameworkElement Content { get; }
    internal bool Qualify { get; }

    internal SheetContentProbe(string scenario, VerticalAlignment alignment = VerticalAlignment.Stretch, bool qualify = false)
    {
        if (qualify && (Environment.GetEnvironmentVariable("GITHUB_ACTIONS") != "true"
            || Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT") != "github-hosted"))
            throw new InvalidOperationException("Квалификация содержимого требует GitHub hosted Windows.");
        if (alignment is not (VerticalAlignment.Stretch or VerticalAlignment.Top))
            throw new ArgumentOutOfRangeException(nameof(alignment));
        this.scenario = scenario;
        Qualify = qualify;
        if (scenario == "list")
        {
            if (alignment != VerticalAlignment.Stretch) throw new ArgumentException("ListView требует штатного Stretch.", nameof(alignment));
            list = new ListView { ItemsSource = Enumerable.Range(0, 1000) };
            Content = list;
        }
        else if (scenario is "long" or "short")
        {
            var panel = new StackPanel { VerticalAlignment = alignment };
            for (var index = 0; index < (scenario == "long" ? 30 : 1); index++)
                panel.Children.Add(new TextBlock { Text = $"Строка {index + 1}", Height = 100 });
            Content = panel;
        }
        else throw new ArgumentException("Неизвестная проба содержимого Sheet.", nameof(scenario));
    }

    internal async Task CompleteAsync(ScrollViewer? viewport, CancellationToken cancellationToken)
    {
        if (!Qualify) return;
        try
        {
            if (viewport is null) throw new InvalidOperationException("Нет native viewport.");
            await Cycle("initial", viewport, cancellationToken);
            phase = "template";
            var scroller = list is null ? viewport : Find<ScrollViewer>(Content)
                ?? throw new InvalidOperationException("Нет собственного viewport ListView.");
            reset = await Change(scroller, 0, cancellationToken);
            var previous = OwnedPresenter(viewport)
                ?? throw new InvalidOperationException("Нет исходного native presenter.");
            var previousContentPresent = Contains(viewport, Content);
            // Новый native ControlTemplate проверяет callback владельца; production-шаблон не меняется.
            viewport.Template = (ControlTemplate)XamlReader.Load(ReplacementTemplate);
            viewport.ApplyTemplate();
            viewport.UpdateLayout();
            await Layout(viewport, cancellationToken);
            var current = OwnedPresenter(viewport)
                ?? throw new InvalidOperationException("Нет нового native presenter.");
            replacement = new(!ReferenceEquals(previous, current), previousContentPresent && Contains(viewport, Content),
                previous.IsLoaded, previous.SizesContentToTemplatedParent, current.SizesContentToTemplatedParent);
            await Cycle("replaced", viewport, cancellationToken);
            status = "complete";
        }
        catch (Exception error)
        {
            status = "failed";
            failure = new(phase, error is OperationCanceledException ? "cancelled"
                : error is TimeoutException ? "layout-timeout" : "native-call", ErrorType(error), error.HResult);
        }
    }

    private async Task Cycle(string template, ScrollViewer viewport, CancellationToken cancellationToken)
    {
        phase = template == "initial" ? "initial-layout" : "replacement-layout";
        await Layout(viewport, cancellationToken);
        var before = Read(viewport);
        cycles.Add(new(template, before, null, null));
        phase = template == "initial" ? "initial-scroll" : "replacement-scroll";
        var scroller = list is null ? viewport : Find<ScrollViewer>(Content)
            ?? throw new InvalidOperationException("Нет собственного viewport ListView.");
        var change = await Change(scroller, scroller.ScrollableHeight, cancellationToken);
        viewport.UpdateLayout();
        if (!await Until(() => LastRowVisible(scroller), cancellationToken))
            throw new TimeoutException("Последняя строка не появилась во viewport.");
        cycles[^1] = new(template, before, change, Read(viewport));
    }

    private async Task Layout(ScrollViewer viewport, CancellationToken cancellationToken)
    {
        if (!await Until(() => Content.IsLoaded && Content.ActualWidth > 0 && Content.ActualHeight > 0
            && viewport.IsLoaded && viewport.ViewportHeight > 0
            && (list is null || Find<ScrollViewer>(Content) is { IsLoaded: true, ViewportHeight: > 0 }), cancellationToken))
            throw new TimeoutException("Native layout не стал доступен.");
    }

    private static async Task<ViewChange> Change(ScrollViewer viewport, double target, CancellationToken cancellationToken)
    {
        var before = viewport.VerticalOffset;
        var finalEvents = 0;
        void Changed(object? sender, ScrollViewerViewChangedEventArgs args)
        {
            if (!args.IsIntermediate) finalEvents = Math.Min(finalEvents + 1, 1024);
        }
        viewport.ViewChanged += Changed;
        try
        {
            var accepted = viewport.ChangeView(null, target, null, disableAnimation: true);
            // Readback offset остаётся обязательным даже при объединении native ViewChanged.
            var settled = accepted && await Until(() => double.IsFinite(viewport.VerticalOffset)
                && Math.Abs(viewport.VerticalOffset - target) <= 0.01, cancellationToken);
            return new(Finite(target), accepted, settled, finalEvents, Finite(before), Finite(viewport.VerticalOffset));
        }
        finally { viewport.ViewChanged -= Changed; }
    }

    private static async Task<bool> Until(Func<bool> predicate, CancellationToken cancellationToken)
    {
        var clock = Stopwatch.StartNew();
        while (!predicate() && clock.ElapsedMilliseconds < 2000) await Task.Delay(20, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        return predicate();
    }

    internal object Snapshot(ScrollViewer? viewport)
    {
        var sample = Read(viewport);
        return new
        {
            sample.scenario, sample.contentType, sample.alignment, sample.heightIsAuto, sample.itemCount, sample.rowHeight,
            sample.lastMeasure, sample.unboundedWidth, sample.unboundedHeight, sample.contentLoaded,
            sample.actualHeight, sample.desiredHeight, sample.outer, sample.inner, sample.realizedItems, sample.lastRow,
            sample.observedAtUnixMs,
            qualification = Qualify ? new
            {
                schema = "sheet-content-v1", status, phase, failure, reset, replacement, cycles = cycles.ToArray()
            } : null
        };
    }

    private ContentSample Read(ScrollViewer? viewport)
    {
        var size = LayoutInformation.GetAvailableSize(Content);
        var inner = list is null ? null : Find<ScrollViewer>(Content);
        var scroller = list is null ? viewport : inner;
        var finalRow = list is null ? ((StackPanel)Content).Children.LastOrDefault() as FrameworkElement
            : list.ContainerFromIndex(999) as FrameworkElement;
        return new(scenario, list is null ? "StackPanel" : "ListView", Content.VerticalAlignment.ToString(),
            double.IsNaN(Content.Height), list is null ? ((StackPanel)Content).Children.Count : list.Items.Count,
            list is null ? Finite(finalRow?.Height ?? double.NaN) : null,
            new(Finite(size.Width), Finite(size.Height)), !double.IsFinite(size.Width), !double.IsFinite(size.Height),
            Content.IsLoaded, Finite(Content.ActualHeight), Finite(Content.DesiredSize.Height), ScrollData(viewport),
            ScrollData(inner), list is null ? null : Enumerable.Range(0, 1000).Count(index => list.ContainerFromIndex(index) is not null),
            ReadLastRow(scroller),
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    private RowSample ReadLastRow(ScrollViewer? scroller)
    {
        var finalRow = list is null ? ((StackPanel)Content).Children.LastOrDefault() as FrameworkElement
            : list.ContainerFromIndex(999) as FrameworkElement;
        var parent = finalRow is null ? null : VisualTreeHelper.GetParent(finalRow) as UIElement;
        // Слот строки проверяет всю выделенную область, включая свободное место вокруг текста.
        var bounds = scroller is { IsLoaded: true } && finalRow is { IsLoaded: true } && parent is not null
            ? parent.TransformToVisual(scroller).TransformBounds(LayoutInformation.GetLayoutSlot(finalRow))
            : (Rect?)null;
        return new(finalRow is { IsLoaded: true }, bounds is { } value
            ? new(Finite(value.X), Finite(value.Y), Finite(value.Width), Finite(value.Height)) : null);
    }

    private bool LastRowVisible(ScrollViewer scroller) => ReadLastRow(scroller) is
        { realized: true, bounds: { y: { } top, height: { } height } }
        && height > 0 && top >= -0.01 && top + height <= scroller.ViewportHeight + 0.01;

    private static double? Finite(double value) => double.IsFinite(value) ? value : null;
    private static ScrollSample? ScrollData(ScrollViewer? viewport) => viewport is null ? null
        : new(Finite(viewport.ExtentHeight), Finite(viewport.ViewportHeight), Finite(viewport.ScrollableHeight),
            Finite(viewport.VerticalOffset), OwnedPresenter(viewport)?.SizesContentToTemplatedParent);

    private static string? ErrorType(Exception error) => error.GetType() is { } type
        && (type == typeof(System.Runtime.InteropServices.COMException) || type == typeof(InvalidOperationException)
            || type == typeof(ArgumentException) || type == typeof(TimeoutException)
            || type == typeof(OperationCanceledException) || type == typeof(TaskCanceledException)) ? type.Name : null;

    private static ScrollContentPresenter? OwnedPresenter(DependencyObject parent)
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            var child = VisualTreeHelper.GetChild(parent, index);
            if (child is ScrollContentPresenter presenter && presenter.Name == "ScrollContentPresenter") return presenter;
            if (child is not ScrollViewer && OwnedPresenter(child) is { } found) return found;
        }
        return null;
    }

    private static T? Find<T>(DependencyObject parent) where T : DependencyObject
    {
        if (parent is T found) return found;
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            if (Find<T>(VisualTreeHelper.GetChild(parent, index)) is { } child) return child;
        return null;
    }

    private static bool Contains(DependencyObject parent, DependencyObject content)
    {
        if (ReferenceEquals(parent, content)) return true;
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            if (Contains(VisualTreeHelper.GetChild(parent, index), content)) return true;
        return false;
    }

    private sealed record SizeSample(double? width, double? height);
    private sealed record BoundsSample(double? x, double? y, double? width, double? height);
    private sealed record RowSample(bool realized, BoundsSample? bounds);
    private sealed record ScrollSample(double? extentHeight, double? viewportHeight, double? scrollableHeight,
        double? verticalOffset, bool? sizesContentToTemplatedParent);
    private sealed record ContentSample(string scenario, string contentType, string alignment, bool heightIsAuto,
        int itemCount, double? rowHeight, SizeSample lastMeasure, bool unboundedWidth, bool unboundedHeight,
        bool contentLoaded, double? actualHeight, double? desiredHeight, ScrollSample? outer, ScrollSample? inner,
        int? realizedItems, RowSample lastRow, long observedAtUnixMs);
    private sealed record ViewChange(double? targetOffset, bool accepted, bool settled, int finalEvents,
        double? beforeOffset, double? afterOffset);
    private sealed record ProbeCycle(string template, ContentSample before, ViewChange? changeView, ContentSample? after);
    private sealed record TemplateReplacement(bool presentersDiffer, bool sameContent, bool previousPresenterLoaded,
        bool previousSizesContentToTemplatedParent, bool currentSizesContentToTemplatedParent);
    private sealed record ProbeFailure(string phase, string code, string? type, int? hresult);

    private const string ReplacementTemplate = """
        <ControlTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                         xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" TargetType="ScrollViewer">
          <Grid x:Name="Root">
            <ScrollContentPresenter x:Name="ScrollContentPresenter"
                Content="{TemplateBinding Content}" ContentTemplate="{TemplateBinding ContentTemplate}"
                HorizontalContentAlignment="{TemplateBinding HorizontalContentAlignment}"
                VerticalContentAlignment="{TemplateBinding VerticalContentAlignment}" />
          </Grid>
        </ControlTemplate>
        """;
}
