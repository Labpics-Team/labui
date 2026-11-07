using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System.Runtime.ExceptionServices;

namespace LabUI.WinUI;

/// <summary>Живая сцена в Content и отдельная поверхность Sheet поверх неё.</summary>
public sealed class LabSheetHost : ContentControl
{
    public static readonly DependencyProperty SheetProperty = DependencyProperty.Register(
        nameof(Sheet), typeof(LabSheet), typeof(LabSheetHost),
        new PropertyMetadata(null, SheetChanged));

    public LabSheet? Sheet
    {
        get => (LabSheet?)GetValue(SheetProperty);
        set => SetValue(SheetProperty, value);
    }

    private Grid? scene;
    private ContentPresenter? surface;
    private LabSheet? bound;
    private long generation;
    private long templateGeneration;

    public LabSheetHost()
    {
        DefaultStyleKey = typeof(LabSheetHost);
        Loaded += (_, _) => Connect();
        Unloaded += (_, _) => Disconnect();
    }

    protected override void OnApplyTemplate()
    {
        var currentTemplate = ++templateGeneration;
        var previousScene = scene;
        var previousSurface = surface;
        scene = null;
        surface = null;
        List<Exception> errors = [];
        try { Disconnect(); }
        catch (Exception error) { errors.Add(error); }
        if (previousScene is not null)
        {
            previousScene.SizeChanged -= SceneResized;
            previousScene.Loaded -= SceneLifecycleChanged;
            previousScene.Unloaded -= SceneLifecycleChanged;
        }
        try { if (previousSurface is not null) previousSurface.Content = null; }
        catch (Exception error) { errors.Add(error); }
        if (errors.Count > 1) throw new AggregateException("Ошибка освобождения шаблона LabSheetHost.", errors);
        if (errors.Count == 1) ExceptionDispatchInfo.Capture(errors[0]).Throw();
        if (currentTemplate != templateGeneration) return;
        base.OnApplyTemplate();
        if (currentTemplate != templateGeneration) return;
        scene = GetTemplateChild("PART_Scene") as Grid
            ?? throw new InvalidOperationException("LabSheetHost требует PART_Scene (Grid).");
        surface = GetTemplateChild("PART_Sheet") as ContentPresenter
            ?? throw new InvalidOperationException("LabSheetHost требует PART_Sheet (ContentPresenter).");
        // Источник и поверхность — соседние поддеревья: capture никогда не содержит Sheet.
        if (VisualTreeHelper.GetParent(scene) is not Grid parent
            || !ReferenceEquals(parent, VisualTreeHelper.GetParent(surface)))
            throw new InvalidOperationException("Сцена и Sheet должны быть соседями одного viewport.");
        scene.SizeChanged += SceneResized;
        scene.Loaded += SceneLifecycleChanged;
        scene.Unloaded += SceneLifecycleChanged;
        surface.Content = Sheet;
        if (IsLoaded) Connect();
    }

    private static void SheetChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
    {
        var host = (LabSheetHost)sender;
        var current = host.Disconnect();
        if (current != host.generation) return;
        if (host.surface is not null) host.surface.Content = host.Sheet;
        if (host.IsLoaded) host.Connect();
    }

    private void Connect()
    {
        if (scene is null || surface is null || Sheet is not { } next || ReferenceEquals(bound, next)) return;
        var current = Disconnect();
        if (current != generation || !IsLoaded || !ReferenceEquals(Sheet, next)) return;
        bound = next;
        try { next.BindScene(this, scene); }
        catch (Exception primary)
        {
            if (current == generation && ReferenceEquals(bound, next))
            {
                bound = null;
                try { next.UnbindScene(this); }
                catch (Exception cleanup) { throw new AggregateException("Ошибка подключения и освобождения сцены Sheet.", primary, cleanup); }
            }
            throw;
        }
    }

    private long Disconnect()
    {
        var current = ++generation;
        var previous = bound;
        bound = null;
        previous?.UnbindScene(this);
        return current;
    }

    private void SceneResized(object sender, SizeChangedEventArgs args) => bound?.SceneGeometryChanged(this);
    private void SceneLifecycleChanged(object sender, RoutedEventArgs args) => bound?.SceneGeometryChanged(this);
}
