using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System.Text.Json;
using Windows.Foundation;

namespace LabUI.Buttons;

public sealed partial class SheetPage : Page
{
    private readonly string? observationPath = Environment.GetEnvironmentVariable("LABUI_SHEET_OBSERVATION");
    private bool imageLoaded;
    private bool snapshotQueued;
    private bool snapshotWritten;
    internal Window? HostWindow { get; set; }

    public SheetPage(bool dark, bool solid, bool withContent)
    {
        InitializeComponent();
        RequestedTheme = dark ? ElementTheme.Dark : ElementTheme.Light;
        Sheet.Material = solid ? LabSheetMaterial.Solid : LabSheetMaterial.Blur;
        if (observationPath is not null)
        {
            Backdrop.ImageOpened += ImageOpened;
            Backdrop.ImageFailed += ImageFailed;
            Sheet.EffectiveMaterialChanged += MaterialReady;
            Loaded += LoadedPage;
            Unloaded += UnloadedPage;
            Application.Current.UnhandledException += Unhandled;
        }
        if (withContent)
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
            SheetSourceTopology.ReadFactory(args.Exception), SheetSourceTopology.ReadTransforms(args.Exception)));

    private sealed record ObservationError(string origin, string? type, int? hresult, string? site = null,
        object? topology = null, object? factory = null, object? transforms = null);

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
        if (!DispatcherQueue.TryEnqueue(Microsoft.UI.Dispatching.DispatcherQueuePriority.Low, () =>
        {
            snapshotQueued = false;
            if (IsLoaded) WriteSnapshot(null);
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

    private void WriteSnapshot(ObservationError? error)
    {
        if (observationPath is null || snapshotWritten) return;
        var body = FindPart(Sheet, "PART_Body");
        var handle = FindPart(Sheet, "PART_Indicator");
        var observation = new
        {
            pid = Environment.ProcessId,
            windowHandle = HostWindow is null ? null : WinRT.Interop.WindowNative.GetWindowHandle(HostWindow).ToInt64().ToString(System.Globalization.CultureInfo.InvariantCulture),
            observedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            theme = ActualTheme.ToString(),
            rasterizationScale = XamlRoot?.RasterizationScale,
            viewport = Bounds(Sheet),
            body = Bounds(body),
            handle = Bounds(handle),
            layoutReady = IsLoaded && ActualWidth > 0 && ActualHeight > 0 && body is not null && handle is not null,
            imageLoaded,
            rendererReady = Sheet.EffectiveMaterial is not null,
            requestedMaterial = Sheet.Material.ToString(),
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
