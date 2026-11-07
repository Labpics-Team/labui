using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Markup;
using Microsoft.UI.Xaml.Media;
using System.Diagnostics;

namespace LabUI.Buttons;

// Hosted consumer: меняет штатные Content и Template, наблюдает native layout и selector.
internal sealed class SheetPolicyProbe
{
    private readonly LabSheet sheet;
    private readonly string scenario;
    private readonly PolicySelector? selector;
    private readonly StackPanel? autoContent;
    private readonly List<PolicyStep> steps = [];
    private string status = "pending";
    private string phase;
    private PolicyFailure? failure;
    private RetainedParts? retired;
    private ResourceDictionary? replacementResources;
    private FrameworkElement? previousRoot;

    internal SheetPolicyProbe(LabSheet sheet, string scenario, VerticalAlignment alignment, bool qualify)
    {
        if (!qualify) throw new ArgumentException("Проба политики требует квалификацию содержимого.", nameof(qualify));
        if (Environment.GetEnvironmentVariable("GITHUB_ACTIONS") != "true"
            || Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT") != "github-hosted")
            throw new InvalidOperationException("Квалификация политики требует GitHub hosted Windows.");
        if (alignment != VerticalAlignment.Stretch) throw new ArgumentOutOfRangeException(nameof(alignment));
        if (scenario is not ("selector-retirement" or "flex-recovery"))
            throw new ArgumentException("Неизвестная проба политики Sheet.", nameof(scenario));
        var state = scenario == "selector-retirement" ? LabSheetState.Half : LabSheetState.Flex;
        if (sheet.State != state || sheet.Material != LabSheetMaterial.Solid)
            throw new ArgumentException("Проба политики требует согласованное состояние и Solid.", nameof(sheet));
        this.sheet = sheet;
        this.scenario = scenario;
        phase = scenario == "selector-retirement" ? "initial-a" : "empty";
        if (scenario == "selector-retirement")
        {
            selector = new PolicySelector(sheet);
            // Selector выбирает шаблон сразу; его первый item уже должен быть A.
            sheet.Content = "a";
            sheet.ContentTemplateSelector = selector;
        }
        else
        {
            autoContent = new StackPanel
            {
                Spacing = 8,
                Children =
                {
                    new TextBlock { Text = "Flex", TextWrapping = TextWrapping.Wrap },
                    new TextBlock { Text = "Содержимое с естественной высотой", TextWrapping = TextWrapping.Wrap }
                }
            };
            sheet.Content = null;
        }
    }

    internal async Task CompleteAsync(CancellationToken cancellationToken)
    {
        if (status != "pending") return;
        try
        {
            if (scenario == "selector-retirement") await SelectorRetirement(cancellationToken);
            else await FlexRecovery(cancellationToken);
            status = "complete";
        }
        catch (Exception error)
        {
            status = "failed";
            failure = new(phase, error is OperationCanceledException ? "cancelled"
                : error is TimeoutException ? "layout-timeout" : "native-call", ErrorType(error), error.HResult);
        }
    }

    private async Task SelectorRetirement(CancellationToken cancellationToken)
    {
        await LayoutStep("initial-a", false, cancellationToken);
        phase = "content-b";
        sheet.Content = "b";
        await LayoutStep(phase, false, cancellationToken);

        phase = "sheet-template";
        var parts = Parts();
        var viewport = parts.viewport ?? throw new InvalidOperationException("Нет исходного viewport.");
        var retained = new RetainedParts(sheet.Template ?? throw new InvalidOperationException("Нет исходного Sheet.Template."),
            viewport,
            parts.presenter ?? throw new InvalidOperationException("Нет исходного ContentPresenter."),
            parts.scrollPresenter ?? throw new InvalidOperationException("Нет исходного ScrollContentPresenter."),
            viewport.Template);
        retired = retained;
        sheet.Template = CanonicalSheetTemplate();
        sheet.ApplyTemplate();
        await LayoutStep(phase, false, cancellationToken, () =>
        {
            var active = Parts();
            return !ReferenceEquals(retained.sheetTemplate, sheet.Template)
                && !ReferenceEquals(retained.viewport, active.viewport)
                && !ReferenceEquals(retained.presenter, active.presenter)
                && !ReferenceEquals(retained.scrollPresenter, active.scrollPresenter)
                && !retained.viewport.IsLoaded && !retained.presenter.IsLoaded
                && !Contains(sheet, retained.viewport);
        });

        phase = "content-a";
        sheet.Content = "a";
        await LayoutStep(phase, false, cancellationToken);

        phase = "retired-viewport-template";
        // Retired viewport остаётся вне дерева Sheet. Новый presenter получает только native defaults.
        retained.viewport.Template = (ControlTemplate)XamlReader.Load(RetiredViewportTemplate);
        retained.viewport.ApplyTemplate();
        retained.viewport.UpdateLayout();
        await LayoutStep(phase, false, cancellationToken,
            () => OwnedPresenter(retained.viewport) is not null);
    }

    private async Task FlexRecovery(CancellationToken cancellationToken)
    {
        // Collapsed viewport не обязан иметь положительные размеры или реализованное содержимое.
        await LayoutStep("empty", true, cancellationToken);
        phase = "recovered";
        sheet.Content = autoContent;
        await LayoutStep(phase, false, cancellationToken);
    }

    private ControlTemplate CanonicalSheetTemplate()
    {
        // Загружается production-словарь, а не локальная копия геометрии или материала Sheet.
        replacementResources = new ResourceDictionary
        {
            Source = new Uri("ms-appx:///LabUI.WinUI/Themes/Generic.xaml")
        };
        var style = replacementResources[typeof(LabSheet)] as Style
            ?? throw new InvalidOperationException("Нет canonical Style для Sheet.");
        return style.Setters.OfType<Setter>().Single(setter => setter.Property == Control.TemplateProperty).Value
            as ControlTemplate ?? throw new InvalidOperationException("Нет canonical Sheet.Template.");
    }

    private async Task LayoutStep(string step, bool empty, CancellationToken cancellationToken,
        Func<bool>? additionalReady = null)
    {
        phase = step;
        sheet.UpdateLayout();
        var ready = await Until(() =>
        {
            var parts = Parts();
            var root = GeneratedRoot(parts.presenter);
            return sheet.IsLoaded && sheet.EffectiveMaterial is not null
                && parts.body is { IsLoaded: true, ActualHeight: > 0 }
                && parts.viewport is not null && parts.scrollPresenter is not null
                && (empty
                    ? sheet.Content is null && parts.viewport.Visibility == Visibility.Collapsed
                    : parts.presenter is not null && root is { IsLoaded: true, ActualWidth: > 0, ActualHeight: > 0 }
                        && parts.viewport is { IsLoaded: true, ViewportWidth: > 0, ViewportHeight: > 0 }
                        && (selector is null || RootMatchesContent(root, parts.presenter)))
                && (additionalReady?.Invoke() ?? true);
        }, cancellationToken);
        RecordStep();
        if (!ready) throw new TimeoutException("Native layout перехода не стал доступен.");
    }

    private static async Task<bool> Until(Func<bool> predicate, CancellationToken cancellationToken)
    {
        var clock = Stopwatch.StartNew();
        while (!predicate() && clock.ElapsedMilliseconds < 2000) await Task.Delay(20, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        return predicate();
    }

    private void RecordStep()
    {
        var parts = Parts();
        var root = GeneratedRoot(parts.presenter);
        steps.Add(new(phase, sheet.Content is null, sheet.Content is UIElement, Finite(parts.body?.ActualHeight ?? double.NaN),
            ReadViewport(parts.viewport, parts.scrollPresenter), ReadRoot(root),
            selector?.Sample(ReferenceEquals(sheet.ContentTemplateSelector, selector), RootMatchesContent(root, parts.presenter),
                previousRoot is null ? null : !ReferenceEquals(previousRoot, root)),
            ReadReplacement(parts, root)));
        previousRoot = root;
    }

    internal object Snapshot() => new PolicyWitness("sheet-policy-v1", scenario, status, phase, failure, steps.ToArray());

    private ActiveParts Parts()
    {
        var viewport = FindPart(sheet, "PART_ContentViewport") as ScrollViewer;
        return new(FindPart(sheet, "PART_Body") as Grid, viewport,
            FindPart(sheet, "PART_Content") as ContentPresenter, viewport is null ? null : OwnedPresenter(viewport));
    }

    private FrameworkElement? GeneratedRoot(ContentPresenter? presenter)
    {
        if (presenter is null || VisualTreeHelper.GetChildrenCount(presenter) == 0
            || VisualTreeHelper.GetChild(presenter, 0) is not FrameworkElement root) return null;
        return selector is not null ? root.Tag is "a" or "b" ? root : null
            : ReferenceEquals(root, autoContent) ? root : null;
    }

    private bool RootMatchesContent(FrameworkElement? root, ContentPresenter? presenter) => root is not null
        && presenter is not null && sheet.Content is string token && token is "a" or "b"
        && Equals(root.Tag, token) && Equals(presenter.Content, sheet.Content);

    private RootSample? ReadRoot(FrameworkElement? root)
    {
        if (root is null) return null;
        var available = LayoutInformation.GetAvailableSize(root);
        var slot = LayoutInformation.GetLayoutSlot(root);
        var kind = selector is null ? "auto" : root.Tag switch
        {
            "a" => "a",
            "b" => "b",
            _ => throw new InvalidOperationException("Native корень имеет неизвестный token.")
        };
        return new(kind, root.IsLoaded, double.IsNaN(root.Height),
            new(Finite(available.Width), Finite(available.Height)), !double.IsFinite(available.Width), !double.IsFinite(available.Height),
            new(Finite(root.ActualWidth), Finite(root.ActualHeight)),
            new(Finite(root.DesiredSize.Width), Finite(root.DesiredSize.Height)),
            new(Finite(slot.X), Finite(slot.Y), Finite(slot.Width), Finite(slot.Height)));
    }

    private static ViewportSample? ReadViewport(ScrollViewer? viewport, ScrollContentPresenter? presenter) => viewport is null ? null
        : new(viewport.IsLoaded, viewport.Visibility == Visibility.Visible ? "visible" : "collapsed",
            Finite(viewport.ActualWidth), Finite(viewport.ActualHeight), Finite(viewport.ViewportWidth), Finite(viewport.ViewportHeight),
            Finite(viewport.ExtentWidth), Finite(viewport.ExtentHeight), Finite(viewport.ScrollableWidth), Finite(viewport.ScrollableHeight),
            presenter?.SizesContentToTemplatedParent);

    private ReplacementSample? ReadReplacement(ActiveParts active, FrameworkElement? root)
    {
        if (retired is null) return null;
        var retiredPresenter = OwnedPresenter(retired.viewport);
        return new(!ReferenceEquals(retired.sheetTemplate, sheet.Template), !ReferenceEquals(retired.viewport, active.viewport),
            !ReferenceEquals(retired.presenter, active.presenter), !ReferenceEquals(retired.scrollPresenter, active.scrollPresenter),
            retired.viewport.IsLoaded, retired.presenter.IsLoaded, retired.presenter.Content is null, retired.presenter.ContentTemplate is null,
            !ReferenceEquals(retired.viewportTemplate, retired.viewport.Template), !ReferenceEquals(retired.scrollPresenter, retiredPresenter),
            active.viewport is not null && root is not null && Contains(active.viewport, root) && RootMatchesContent(root, active.presenter),
            retiredPresenter?.SizesContentToTemplatedParent);
    }

    private static FrameworkElement? FindPart(DependencyObject parent, string name)
    {
        if (parent is FrameworkElement element && element.Name == name) return element;
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            if (FindPart(VisualTreeHelper.GetChild(parent, index), name) is { } found) return found;
        return null;
    }

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

    private static bool Contains(DependencyObject parent, DependencyObject content)
    {
        if (ReferenceEquals(parent, content)) return true;
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            if (Contains(VisualTreeHelper.GetChild(parent, index), content)) return true;
        return false;
    }

    private static double? Finite(double value) => double.IsFinite(value) ? value : null;

    private static string? ErrorType(Exception error) => error.GetType() is { } type
        && (type == typeof(System.Runtime.InteropServices.COMException) || type == typeof(InvalidOperationException)
            || type == typeof(ArgumentException) || type == typeof(TimeoutException)
            || type == typeof(OperationCanceledException) || type == typeof(TaskCanceledException)) ? type.Name : null;

    private sealed class PolicySelector : DataTemplateSelector
    {
        private readonly LabSheet owner;
        private readonly DataTemplate templateA = (DataTemplate)XamlReader.Load(TemplateA);
        private readonly DataTemplate templateB = (DataTemplate)XamlReader.Load(TemplateB);
        private int calls, ownerCalls, otherCalls, itemACalls, itemBCalls, otherItemCalls, singleArgumentCalls;

        internal PolicySelector(LabSheet owner) => this.owner = owner;

        protected override DataTemplate SelectTemplateCore(object item, DependencyObject container)
        {
            Track(item, container, false);
            return TemplateFor(item);
        }

        protected override DataTemplate SelectTemplateCore(object item)
        {
            Track(item, null, true);
            return TemplateFor(item);
        }

        private void Track(object item, DependencyObject? container, bool singleArgument)
        {
            if (calls >= 1024) throw new InvalidOperationException("Native selector превысил лимит вызовов пробы.");
            calls++;
            if (ReferenceEquals(container, owner)) ownerCalls++;
            else otherCalls++;
            if (item is "a") itemACalls++;
            else if (item is "b") itemBCalls++;
            else otherItemCalls++;
            if (singleArgument) singleArgumentCalls++;
        }

        private DataTemplate TemplateFor(object item) => item switch
        {
            "a" => templateA,
            "b" => templateB,
            _ => throw new ArgumentException("Selector получил неизвестное содержимое.", nameof(item))
        };

        internal SelectorSample Sample(bool sameSelector, bool rootMatchesContent, bool? generatedRootChanged)
            => new(calls, ownerCalls, otherCalls, itemACalls, itemBCalls, otherItemCalls, singleArgumentCalls,
                sameSelector, rootMatchesContent, generatedRootChanged);
    }

    private sealed record ActiveParts(Grid? body, ScrollViewer? viewport, ContentPresenter? presenter, ScrollContentPresenter? scrollPresenter);
    private sealed record RetainedParts(ControlTemplate sheetTemplate, ScrollViewer viewport, ContentPresenter presenter,
        ScrollContentPresenter scrollPresenter, ControlTemplate? viewportTemplate);
    private sealed record SizeSample(double? width, double? height);
    private sealed record BoundsSample(double? x, double? y, double? width, double? height);
    private sealed record RootSample(string kind, bool loaded, bool heightIsAuto, SizeSample lastMeasure, bool unboundedWidth,
        bool unboundedHeight, SizeSample actual, SizeSample desired, BoundsSample layoutSlot);
    private sealed record ViewportSample(bool loaded, string visibility, double? actualWidth, double? actualHeight,
        double? viewportWidth, double? viewportHeight, double? extentWidth, double? extentHeight, double? scrollableWidth,
        double? scrollableHeight, bool? sizesContentToTemplatedParent);
    private sealed record SelectorSample(int calls, int ownerCalls, int otherCalls, int itemACalls, int itemBCalls,
        int otherItemCalls, int singleArgumentCalls, bool sameSelector, bool rootMatchesContent, bool? generatedRootChanged);
    private sealed record ReplacementSample(bool sheetTemplatesDiffer, bool viewportsDiffer, bool contentPresentersDiffer,
        bool scrollPresentersDiffer, bool retiredViewportLoaded, bool retiredContentPresenterLoaded, bool retiredContentCleared,
        bool retiredContentTemplateCleared, bool retiredTemplateChanged, bool retiredScrollPresentersDiffer,
        bool activeContentPreserved, bool? retiredSizesContentToTemplatedParent);
    private sealed record PolicyStep(string phase, bool contentIsNull, bool contentIsUiElement, double? bodyHeight,
        ViewportSample? viewport, RootSample? root, SelectorSample? selector, ReplacementSample? replacement);
    private sealed record PolicyFailure(string phase, string code, string? type, int hresult);
    private sealed record PolicyWitness(string schema, string scenario, string status, string phase,
        PolicyFailure? failure, PolicyStep[] steps);

    private const string TemplateA = """
        <DataTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
          <StackPanel Tag="a" Spacing="8">
            <TextBlock Text="Содержимое A" TextWrapping="Wrap" />
            <TextBlock Text="Шаблон выбирает native ContentPresenter." TextWrapping="Wrap" />
          </StackPanel>
        </DataTemplate>
        """;
    private const string TemplateB = """
        <DataTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
          <Grid Tag="b">
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto" />
              <RowDefinition Height="Auto" />
            </Grid.RowDefinitions>
            <TextBlock Text="Содержимое B" TextWrapping="Wrap" />
            <TextBlock Grid.Row="1" Text="Второй native корень того же selector." TextWrapping="Wrap" />
          </Grid>
        </DataTemplate>
        """;
    private const string RetiredViewportTemplate = """
        <ControlTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                         xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" TargetType="ScrollViewer">
          <Grid>
            <ScrollContentPresenter x:Name="ScrollContentPresenter"
                Content="{TemplateBinding Content}" ContentTemplate="{TemplateBinding ContentTemplate}"
                HorizontalContentAlignment="{TemplateBinding HorizontalContentAlignment}"
                VerticalContentAlignment="{TemplateBinding VerticalContentAlignment}" />
          </Grid>
        </ControlTemplate>
        """;
}
