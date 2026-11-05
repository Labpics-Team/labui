using LabUI.WinUI.Rendering;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation.Peers;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;
using Windows.Foundation;

namespace LabUI.WinUI;

public enum LabSheetMaterial { Blur, Solid }
public enum LabSheetMaterialReason { Requested, TransparencyDisabled, EffectsUnsupported, EffectsNotFast }

/// <summary>Content — содержимое поверхности; сам Sheet занимает конечный viewport.</summary>
public sealed class LabSheet : ContentControl
{
    public static readonly DependencyProperty StateProperty = DependencyProperty.Register(
        nameof(State), typeof(LabSheetState), typeof(LabSheet),
        new PropertyMetadata(LabSheetState.Half, GeometryChanged));

    public static readonly DependencyProperty GeometryScaleProperty = DependencyProperty.Register(
        nameof(GeometryScale), typeof(double), typeof(LabSheet),
        new PropertyMetadata(1d, GeometryChanged));

    public LabSheetState State
    {
        get => (LabSheetState)GetValue(StateProperty);
        set { SheetMetrics.ValidateState(value); SetValue(StateProperty, value); }
    }

    /// <summary>Масштаб размеров в DIP; системные DPI и масштаб текста применяются отдельно.</summary>
    public double GeometryScale
    {
        get => (double)GetValue(GeometryScaleProperty);
        set { SheetMetrics.ValidateScale(value); SetValue(GeometryScaleProperty, value); }
    }

    public static readonly DependencyProperty MaterialProperty = DependencyProperty.Register(
        nameof(Material), typeof(LabSheetMaterial), typeof(LabSheet),
        new PropertyMetadata(LabSheetMaterial.Blur, MaterialChanged));

    public LabSheetMaterial Material
    {
        get => (LabSheetMaterial)GetValue(MaterialProperty);
        set => SetValue(MaterialProperty, value);
    }

    /// <summary>Фактический материал после системной политики, доступен после Loaded.</summary>
    public LabSheetMaterial? EffectiveMaterial => layers?.EffectiveMaterial;
    public LabSheetMaterialReason? MaterialReason => layers?.MaterialReason;
    public event EventHandler? EffectiveMaterialChanged;

    private SheetLayers? layers;
    private Grid? body;
    private Grid? dragArea;
    private Border? indicator;
    private ScrollViewer? contentViewport;
    private ContentPresenter? contentPresenter;
    private long? viewportTemplateToken;
    private bool attached;
    private EventHandler? materialForwarder;

    public LabSheet()
    {
        DefaultStyleKey = typeof(LabSheet);
        Loaded += LoadedControl;
        Unloaded += UnloadedControl;
        SizeChanged += Resized;
    }

    protected override AutomationPeer OnCreateAutomationPeer() => new LabSheetAutomationPeer(this);

    private sealed class LabSheetAutomationPeer(LabSheet owner) : FrameworkElementAutomationPeer(owner)
    {
        protected override string GetClassNameCore() => nameof(LabSheet);
        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Group;
    }

    protected override void OnApplyTemplate()
    {
        DetachParts();
        if (contentPresenter is not null)
        {
            contentPresenter.Content = null;
            contentPresenter.ContentTemplate = null;
        }
        if (contentViewport is not null && viewportTemplateToken is { } token)
            contentViewport.UnregisterPropertyChangedCallback(Control.TemplateProperty, token);
        viewportTemplateToken = null;
        base.OnApplyTemplate();
        layers = Part<SheetLayers>("PART_Layers");
        body = Part<Grid>("PART_Body");
        dragArea = Part<Grid>("PART_DragArea");
        indicator = Part<Border>("PART_Indicator");
        contentViewport = Part<ScrollViewer>("PART_ContentViewport");
        contentPresenter = Part<ContentPresenter>("PART_Content");
        // Native presenter сохраняет templated LabSheet и выбранный им шаблон после смены визуального родителя.
        contentViewport.Content = null;
        contentViewport.Content = new ContentExtentHost(contentPresenter);
        ConfigureContentViewport(contentViewport);
        viewportTemplateToken = contentViewport.RegisterPropertyChangedCallback(Control.TemplateProperty,
            static (sender, _) => ConfigureContentViewport((ScrollViewer)sender));
        ApplyMetrics();
        if (IsLoaded) AttachParts();
    }

    private T Part<T>(string name) where T : DependencyObject => GetTemplateChild(name) as T
        ?? throw new InvalidOperationException($"Шаблон LabSheet требует {name} ({typeof(T).Name}).");

    private sealed class ContentExtentHost : Panel
    {
        private readonly ContentPresenter presenter;

        public ContentExtentHost(ContentPresenter presenter)
        {
            this.presenter = presenter;
            Children.Add(presenter);
        }

        protected override Size MeasureOverride(Size availableSize)
        {
            presenter.Measure(availableSize);
            return presenter.DesiredSize;
        }

        protected override Size ArrangeOverride(Size finalSize)
        {
            presenter.Arrange(new Rect(0, 0, finalSize.Width, finalSize.Height));
            if (VisualTreeHelper.GetChildrenCount(presenter) == 0
                || VisualTreeHelper.GetChild(presenter, 0) is not FrameworkElement child) return finalSize;
            var maximum = Math.Max(child.MinHeight,
                Math.Min(child.MaxHeight, double.IsNaN(child.Height) ? double.PositiveInfinity : child.Height));
            var height = Math.Max(0, Math.Min(child.ActualHeight, maximum) + child.Margin.Top + child.Margin.Bottom);
            if (!double.IsFinite(height)) throw new InvalidOperationException("Содержимое Sheet требует конечный extent.");
            if (height <= finalSize.Height) return finalSize;
            // Measure остаётся конечным; Arrange сохраняет extent и снимает внутренний clip переполнения.
            var slot = LayoutInformation.GetLayoutSlot(child);
            presenter.Arrange(new Rect(0, 0, finalSize.Width, height));
            child.Arrange(new Rect(slot.X, slot.Y, slot.Width, height));
            return new Size(finalSize.Width, height);
        }
    }

    private static void ConfigureContentViewport(ScrollViewer viewport)
    {
        viewport.ApplyTemplate();
        var presenter = FindContentPresenter(viewport)
            ?? throw new InvalidOperationException("Шаблон viewport Sheet требует ScrollContentPresenter.");
        // Только native presenter этой поверхности получает конечный размер измерения.
        if (!presenter.SizesContentToTemplatedParent) presenter.SizesContentToTemplatedParent = true;
    }

    private static ScrollContentPresenter? FindContentPresenter(DependencyObject parent)
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            var child = VisualTreeHelper.GetChild(parent, index);
            if (child is ScrollContentPresenter presenter && presenter.Name == "ScrollContentPresenter") return presenter;
            // Собственный ScrollViewer содержимого остаётся у его владельца.
            if (child is not ScrollViewer && FindContentPresenter(child) is { } found) return found;
        }
        return null;
    }

    private void LoadedControl(object sender, RoutedEventArgs args)
    {
        ApplyTemplate();
        AttachParts();
    }

    private void UnloadedControl(object sender, RoutedEventArgs args) => DetachParts();

    private void AttachParts()
    {
        if (attached || layers is null) return;
        attached = true;
        var source = layers;
        EventHandler? forwarder = null;
        forwarder = (sender, args) =>
        {
            if (ReferenceEquals(materialForwarder, forwarder)) ForwardMaterial(sender, args);
        };
        materialForwarder = forwarder;
        source.EffectiveMaterialChanged += forwarder;
        source.Attach(Material);
        ApplyMetrics();
    }

    private void DetachParts()
    {
        if (!attached) return;
        attached = false;
        var source = layers;
        var forwarder = materialForwarder;
        try { source?.Detach(); }
        finally
        {
            // Утрата готовности уже передана. Callback мог подключить тот же слой заново.
            if (source is not null && forwarder is not null) source.EffectiveMaterialChanged -= forwarder;
            if (ReferenceEquals(materialForwarder, forwarder)) materialForwarder = null;
        }
    }

    private void ForwardMaterial(object? sender, EventArgs args) => EffectiveMaterialChanged?.Invoke(this, args);
    private void Resized(object sender, SizeChangedEventArgs args) => ApplyMetrics();

    private static void GeometryChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
    {
        var sheet = (LabSheet)sender;
        SheetMetrics.ValidateState(sheet.State);
        SheetMetrics.ValidateScale(sheet.GeometryScale);
        sheet.InvalidateMeasure();
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        ApplyMetrics(availableSize.Width, availableSize.Height);
        return base.MeasureOverride(availableSize);
    }

    private static void MaterialChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
    {
        var sheet = (LabSheet)sender;
        if (sheet.Material is not (LabSheetMaterial.Blur or LabSheetMaterial.Solid))
            throw new ArgumentOutOfRangeException(nameof(Material));
        sheet.layers?.SetMaterial(sheet.Material);
    }

    private void ApplyMetrics() => ApplyMetrics(ActualWidth, ActualHeight);

    private void ApplyMetrics(double width, double height)
    {
        if (body is null || dragArea is null || indicator is null || contentViewport is null
            || !double.IsFinite(width) || width <= 0 || !double.IsFinite(height) || height <= 0) return;
        ConfigureContentViewport(contentViewport);
        var hasContent = Content is not null;
        contentViewport.Visibility = State == LabSheetState.Flex && !hasContent ? Visibility.Collapsed : Visibility.Visible;
        var desiredContent = 0d;
        if (State == LabSheetState.Flex && hasContent)
        {
            // Конечная высота сохраняет собственную прокрутку виртуализирующего содержимого.
            var availableContentHeight = Math.Max(0, height - (Geometry.SheetDragArea + Geometry.SheetGap + Geometry.SheetInset) * GeometryScale);
            contentViewport.Measure(new Size(Math.Max(0, width - Geometry.SheetInset * GeometryScale * 2), availableContentHeight));
            desiredContent = contentViewport.DesiredSize.Height;
        }
        var metrics = SheetMetrics.Create(width, height, State, desiredContent, hasContent, GeometryScale);
        body.Padding = new Thickness(metrics.Inset, 0, metrics.Inset, metrics.Inset);
        body.RowSpacing = metrics.ContentGap;
        body.Height = metrics.BodyHeight;
        body.Margin = new Thickness(0, metrics.BodyTop, 0, 0);
        body.Clip = new RectangleGeometry { Rect = new Rect(0, 0, metrics.Width, metrics.BodyHeight) };
        dragArea.Height = metrics.DragArea;
        indicator.Width = Geometry.SheetIndicatorWidth * metrics.Scale;
        indicator.Height = Geometry.SheetIndicatorHeight * metrics.Scale;
        indicator.Margin = new Thickness(Geometry.SheetIndicatorShift * metrics.Scale * 2,
            Geometry.SheetIndicatorOffset * metrics.Scale, 0, 0);
        indicator.CornerRadius = new CornerRadius(indicator.Height / 2);
        layers?.SetMetrics(metrics);
    }
}
