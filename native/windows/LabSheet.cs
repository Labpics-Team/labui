using LabUI.WinUI.Rendering;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace LabUI.WinUI;

public enum LabSheetMaterial { Blur, Solid }
public enum LabSheetMaterialReason { Requested, TransparencyDisabled, EffectsUnsupported, EffectsNotFast }

/// <summary>Нативный Half Sheet. Content — содержимое поверхности, сам контрол занимает viewport.</summary>
public sealed class LabSheet : ContentControl
{
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
    private bool attached;

    public LabSheet()
    {
        DefaultStyleKey = typeof(LabSheet);
        Loaded += LoadedControl;
        Unloaded += UnloadedControl;
        SizeChanged += Resized;
    }

    protected override void OnApplyTemplate()
    {
        DetachParts();
        base.OnApplyTemplate();
        layers = Part<SheetLayers>("PART_Layers");
        body = Part<Grid>("PART_Body");
        dragArea = Part<Grid>("PART_DragArea");
        indicator = Part<Border>("PART_Indicator");
        ApplyMetrics();
        if (IsLoaded) AttachParts();
    }

    private T Part<T>(string name) where T : DependencyObject => GetTemplateChild(name) as T
        ?? throw new InvalidOperationException($"Шаблон LabSheet требует {name} ({typeof(T).Name}).");

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
        layers.EffectiveMaterialChanged += ForwardMaterial;
        layers.Attach(Material);
        ApplyMetrics();
    }

    private void DetachParts()
    {
        if (!attached) return;
        attached = false;
        if (layers is not null)
        {
            layers.EffectiveMaterialChanged -= ForwardMaterial;
            layers.Detach();
        }
    }

    private void ForwardMaterial(object? sender, EventArgs args) => EffectiveMaterialChanged?.Invoke(this, args);
    private void Resized(object sender, SizeChangedEventArgs args) => ApplyMetrics();

    private static void MaterialChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
    {
        var sheet = (LabSheet)sender;
        if (sheet.Material is not (LabSheetMaterial.Blur or LabSheetMaterial.Solid))
            throw new ArgumentOutOfRangeException(nameof(Material));
        sheet.layers?.SetMaterial(sheet.Material);
    }

    private void ApplyMetrics()
    {
        if (body is null || dragArea is null || indicator is null) return;
        body.Padding = new Thickness(Geometry.SheetInset, 0, Geometry.SheetInset, Geometry.SheetInset);
        body.RowSpacing = Geometry.SheetGap;
        dragArea.Height = Geometry.SheetDragArea;
        indicator.Width = Geometry.SheetIndicatorWidth;
        indicator.Height = Geometry.SheetIndicatorHeight;
        indicator.Margin = new Thickness(Geometry.SheetIndicatorShift * 2, Geometry.SheetIndicatorOffset, 0, 0);
        indicator.CornerRadius = new CornerRadius(Geometry.SheetIndicatorHeight / 2);
        if (ActualWidth <= 0 || ActualHeight <= 0) return;
        var metrics = SheetMetrics.Half(ActualWidth, ActualHeight);
        body.Margin = new Thickness(0, metrics.BodyTop, 0, 0);
    }
}
