using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System.Globalization;
using System.Text.Json;
using Windows.Foundation;

namespace LabUI.Buttons;

public sealed partial class SheetPage : Page
{
    private readonly string? observationPath = Environment.GetEnvironmentVariable("LABUI_SHEET_OBSERVATION");
    private bool imageLoaded;
    private bool snapshotQueued;
    private bool snapshotWritten;
    private readonly SheetContentProbe? contentProbe;
    private readonly SheetPolicyProbe? policyProbe;
    private readonly CancellationTokenSource? contentCancellation;
    internal Window? HostWindow { get; set; }
    internal object? WindowAfterResize { get; set; }
    internal object? WindowAfterActivation { get; set; }

    public SheetPage(bool dark, bool solid, bool withContent)
    {
        InitializeComponent();
        RequestedTheme = dark ? ElementTheme.Dark : ElementTheme.Light;
        Sheet.Material = solid ? LabSheetMaterial.Solid : LabSheetMaterial.Blur;
        var arguments = Environment.GetCommandLineArgs();
        if (arguments.FirstOrDefault(value => value.StartsWith("--sheet-state=", StringComparison.Ordinal)) is { } state)
            Sheet.State = state[14..] switch
            {
                "full" => LabSheetState.Full,
                "two-thirds" => LabSheetState.TwoThirds,
                "half" => LabSheetState.Half,
                "one-third" => LabSheetState.OneThird,
                "flex" => LabSheetState.Flex,
                _ => throw new ArgumentException("Неизвестное состояние Sheet."),
            };
        if (arguments.FirstOrDefault(value => value.StartsWith("--sheet-scale=", StringComparison.Ordinal)) is { } scale)
            Sheet.GeometryScale = double.Parse(scale[14..], CultureInfo.InvariantCulture);
        if (observationPath is not null)
        {
            Backdrop.ImageOpened += ImageOpened;
            Backdrop.ImageFailed += ImageFailed;
            Sheet.EffectiveMaterialChanged += MaterialReady;
            Loaded += LoadedPage;
            Unloaded += UnloadedPage;
            Application.Current.UnhandledException += Unhandled;
        }
        const string contentPrefix = "--sheet-content=";
        if (arguments.FirstOrDefault(value => value.StartsWith(contentPrefix, StringComparison.Ordinal)) is { } content)
        {
            const string alignmentPrefix = "--sheet-content-alignment=";
            var alignment = arguments.FirstOrDefault(value => value.StartsWith(alignmentPrefix, StringComparison.Ordinal))
                is { } value ? value[alignmentPrefix.Length..] switch
                {
                    "stretch" => VerticalAlignment.Stretch,
                    "top" => VerticalAlignment.Top,
                    _ => throw new ArgumentException("Неизвестное выравнивание пробы содержимого.")
                } : VerticalAlignment.Stretch;
            var qualify = arguments.Contains("--sheet-content-qualify", StringComparer.Ordinal);
            var scenario = content[contentPrefix.Length..];
            if (scenario is "selector-retirement" or "flex-recovery")
                policyProbe = new SheetPolicyProbe(Sheet, scenario, alignment, qualify);
            else
            {
                contentProbe = new SheetContentProbe(scenario, alignment, qualify);
                Sheet.Content = contentProbe.Content;
            }
            if (qualify) contentCancellation = new();
        }
        else if (withContent)
        {
            var result = new TextBlock { Text = "Выберите действие", TextWrapping = TextWrapping.Wrap };
            var action = new LabButton { Content = "Продолжить", HorizontalAlignment = HorizontalAlignment.Left };
            action.Click += (_, _) => result.Text = "Действие выполнено";
            Sheet.Content = new StackPanel { Spacing = 16, Children = { result, action } };
        }
    }

    private void LoadedPage(object sender, RoutedEventArgs args) => QueueSnapshot();
    private void ImageOpened(object sender, RoutedEventArgs args) { imageLoaded = true; QueueSnapshot(); }
    private void MaterialReady(object? sender, EventArgs args) => QueueSnapshot();
    private void ImageFailed(object sender, ExceptionRoutedEventArgs args)
        => WriteSnapshot(new("image", null, null));
    private void Unhandled(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs args)
        => WriteSnapshot(new("unhandled", ErrorType(args.Exception), args.Exception?.HResult,
            SheetFailureSite.Read(args.Exception), SheetSourceTopology.Read(args.Exception),
            SheetSourceTopology.ReadFactory(args.Exception), SheetSourceTopology.ReadBranches(args.Exception),
            SheetSourceTopology.ReadClamping(args.Exception)));

    private sealed record ObservationError(string origin, string? type, int? hresult, string? site = null,
        object? topology = null, object? factory = null, object? branches = null, object? clamping = null);

    private static string? ErrorType(Exception? error)
    {
        var type = error?.GetType();
        return type is not null && (type == typeof(System.Runtime.InteropServices.COMException)
            || type == typeof(ArgumentException) || type == typeof(ArgumentOutOfRangeException)
            || type == typeof(InvalidOperationException) || type == typeof(ObjectDisposedException)
            || type == typeof(FileNotFoundException) || type == typeof(IOException)
            || type == typeof(NotSupportedException) || type == typeof(NullReferenceException)
            || type == typeof(TypeLoadException) || type == typeof(OutOfMemoryException)
            || type == typeof(UnauthorizedAccessException) || type == typeof(AggregateException)
            || type == typeof(Exception)) ? type.Name : null;
    }

    private void UnloadedPage(object sender, RoutedEventArgs args)
    {
        contentCancellation?.Cancel();
        contentCancellation?.Dispose();
        Backdrop.ImageOpened -= ImageOpened;
        Backdrop.ImageFailed -= ImageFailed;
        Sheet.EffectiveMaterialChanged -= MaterialReady;
        Loaded -= LoadedPage;
        Unloaded -= UnloadedPage;
        Application.Current.UnhandledException -= Unhandled;
    }

    private void QueueSnapshot()
    {
        if (snapshotQueued || snapshotWritten || !IsLoaded || !imageLoaded || Sheet.EffectiveMaterial is null) return;
        snapshotQueued = true;
        if (!DispatcherQueue.TryEnqueue(Microsoft.UI.Dispatching.DispatcherQueuePriority.Low, async () =>
        {
            try
            {
                if (IsLoaded && contentProbe is { Qualify: true })
                    await contentProbe.CompleteAsync(FindPart(Sheet, "PART_ContentViewport") as ScrollViewer, contentCancellation!.Token);
                else if (IsLoaded && policyProbe is not null)
                    await policyProbe.CompleteAsync(contentCancellation!.Token);
                if (IsLoaded) WriteSnapshot(null);
            }
            finally { snapshotQueued = false; }
        })) throw new InvalidOperationException("Не удалось запланировать снимок Sheet.");
    }

    private FrameworkElement? FindPart(DependencyObject parent, string name)
    {
        if (parent is FrameworkElement element && element.Name == name) return element;
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            if (FindPart(VisualTreeHelper.GetChild(parent, index), name) is { } found) return found;
        return null;
    }

    private object? Bounds(FrameworkElement? element)
    {
        if (element is null) return null;
        var bounds = element.TransformToVisual(this).TransformBounds(new Rect(0, 0, element.ActualWidth, element.ActualHeight));
        return new { x = bounds.X, y = bounds.Y, width = bounds.Width, height = bounds.Height };
    }

    internal static object ReadWindowGeometry(Window window)
    {
        try
        {
            var appWindow = window.AppWindow;
            var display = Microsoft.UI.Windowing.DisplayArea.GetFromWindowId(appWindow.Id,
                Microsoft.UI.Windowing.DisplayAreaFallback.Nearest);
            return new
            {
                status = "complete",
                client = new { width = appWindow.ClientSize.Width, height = appWindow.ClientSize.Height },
                frame = new { x = appWindow.Position.X, y = appWindow.Position.Y,
                    width = appWindow.Size.Width, height = appWindow.Size.Height },
                workArea = new { x = display.WorkArea.X, y = display.WorkArea.Y,
                    width = display.WorkArea.Width, height = display.WorkArea.Height },
                outerBounds = new { x = display.OuterBounds.X, y = display.OuterBounds.Y,
                    width = display.OuterBounds.Width, height = display.OuterBounds.Height },
                presenter = appWindow.Presenter.Kind.ToString(),
                visible = appWindow.IsVisible,
                extendsContentIntoTitleBar = window.ExtendsContentIntoTitleBar
            };
        }
        catch (Exception exception)
        {
            // Ошибка дополнительного readback не подменяет первичный renderer failure.
            return new { status = "failed", type = exception.GetType().Name, hresult = exception.HResult };
        }
    }

    private void WriteSnapshot(ObservationError? error)
    {
        if (observationPath is null || snapshotWritten) return;
        var body = FindPart(Sheet, "PART_Body");
        var handle = FindPart(Sheet, "PART_Indicator");
        var contentWitness = policyProbe?.Snapshot()
            ?? contentProbe?.Snapshot(FindPart(Sheet, "PART_ContentViewport") as ScrollViewer);
        var observation = new
        {
            pid = Environment.ProcessId,
            windowHandle = HostWindow is null ? null : WinRT.Interop.WindowNative.GetWindowHandle(HostWindow).ToInt64().ToString(System.Globalization.CultureInfo.InvariantCulture),
            observedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            theme = ActualTheme.ToString(),
            rasterizationScale = XamlRoot?.RasterizationScale,
            windowGeometry = new
            {
                afterResize = WindowAfterResize,
                afterActivation = WindowAfterActivation,
                observed = HostWindow is null ? null : ReadWindowGeometry(HostWindow)
            },
            viewport = Bounds(Sheet),
            body = Bounds(body),
            handle = Bounds(handle),
            layoutReady = IsLoaded && ActualWidth > 0 && ActualHeight > 0 && body is not null && handle is not null,
            imageLoaded,
            rendererReady = Sheet.EffectiveMaterial is not null,
            requestedMaterial = Sheet.Material.ToString(),
            requestedState = Sheet.State.ToString(),
            geometryScale = Sheet.GeometryScale,
            contentViewport = Bounds(FindPart(Sheet, "PART_ContentViewport")),
            contentWitness,
            effectiveMaterial = Sheet.EffectiveMaterial?.ToString(),
            materialReason = Sheet.MaterialReason?.ToString(),
            error
        };
        using (var stream = new FileStream(observationPath + ".tmp", FileMode.CreateNew, FileAccess.Write))
            JsonSerializer.Serialize(stream, observation);
        File.Move(observationPath + ".tmp", observationPath);
        snapshotWritten = true;
    }
}
