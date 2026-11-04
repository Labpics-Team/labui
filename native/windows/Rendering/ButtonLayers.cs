using System.Numerics;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.Brushes;
using Microsoft.Graphics.Canvas.Effects;
using Microsoft.Graphics.Canvas.Geometry;
using Microsoft.Graphics.Canvas.UI.Composition;
using Microsoft.Graphics.DirectX;
using Microsoft.UI.Composition;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Hosting;
using Microsoft.UI.Xaml.Media;
using Windows.Foundation;
using Windows.Graphics;
using Windows.UI;

namespace LabUI.WinUI.Rendering;

// XAML создаёт элемент по имени типа; рисование остаётся внутренней частью Button.
public sealed class ButtonLayers : Grid
{
    public static readonly DependencyProperty FillProperty = PaintProperty(nameof(Fill));
    public static readonly DependencyProperty LightProperty = PaintProperty(nameof(Light));
    public static readonly DependencyProperty DarkProperty = PaintProperty(nameof(Dark));
    public static readonly DependencyProperty ShadowOpacityProperty = DependencyProperty.Register(
        nameof(ShadowOpacity), typeof(double), typeof(ButtonLayers), new PropertyMetadata(0d, PaintChanged));

    public SolidColorBrush? Fill { get => (SolidColorBrush?)GetValue(FillProperty); set => SetValue(FillProperty, value); }
    public SolidColorBrush? Light { get => (SolidColorBrush?)GetValue(LightProperty); set => SetValue(LightProperty, value); }
    public SolidColorBrush? Dark { get => (SolidColorBrush?)GetValue(DarkProperty); set => SetValue(DarkProperty, value); }
    public double ShadowOpacity { get => (double)GetValue(ShadowOpacityProperty); set => SetValue(ShadowOpacityProperty, value); }

    private CanvasDevice? device;
    private CompositionGraphicsDevice? graphics;
    private ContainerVisual? container;
    private readonly List<CompositionDrawingSurface> surfaces = [];
    private readonly List<CompositionSurfaceBrush> brushes = [];
    private readonly List<SpriteVisual> visuals = [];
    private readonly List<(DependencyObject Owner, DependencyProperty Property, long Token)> paintCallbacks = [];
    private XamlRoot? root;
    private ButtonMetrics metrics;
    private bool active;
    private bool queued;
    private bool recovering;
    private bool recoveryFailed;
    private long generation;
    internal event EventHandler? VisualsChanged;
    internal event EventHandler? VisualsChanging;
    internal SpriteVisual HoverVisual => visuals[1];
    internal SpriteVisual PressedVisual => visuals[2];

    internal void Attach(ButtonMetrics value)
    {
        if (active) return;
        metrics = value;
        active = true;
        recoveryFailed = false;
        generation++;
        root = XamlRoot;
        if (root is not null) root.Changed += RootChanged;
        SizeChanged += Resized;
        ObservePaints();
        Render();
    }

    internal void SetMetrics(ButtonMetrics value)
    {
        metrics = value;
        QueueRedraw();
    }

    internal void Detach()
    {
        if (!active) return;
        active = false;
        generation++;
        queued = false;
        SizeChanged -= Resized;
        if (root is not null) root.Changed -= RootChanged;
        root = null;
        ClearPaintCallbacks();
        ReleaseGraphics();
    }

    private static DependencyProperty PaintProperty(string name) => DependencyProperty.Register(
        name, typeof(SolidColorBrush), typeof(ButtonLayers), new PropertyMetadata(null, PaintChanged));

    private static void PaintChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
    {
        var layers = (ButtonLayers)sender;
        if (!layers.active) return;
        layers.ObservePaints();
        layers.QueueRedraw();
    }

    private void ObservePaints()
    {
        ClearPaintCallbacks();
        foreach (var paint in new[] { Fill, Light, Dark }.OfType<SolidColorBrush>().Distinct())
        {
            foreach (var property in new[] { SolidColorBrush.ColorProperty, Brush.OpacityProperty })
            {
                var token = paint.RegisterPropertyChangedCallback(property, (_, _) => QueueRedraw());
                paintCallbacks.Add((paint, property, token));
            }
        }
    }

    private void ClearPaintCallbacks()
    {
        foreach (var (owner, property, token) in paintCallbacks)
            owner.UnregisterPropertyChangedCallback(property, token);
        paintCallbacks.Clear();
    }

    private void Resized(object sender, SizeChangedEventArgs args) => QueueRedraw();
    private void RootChanged(XamlRoot sender, XamlRootChangedEventArgs args) => QueueRedraw();

    private void QueueRedraw()
    {
        if (!active || queued || recoveryFailed) return;
        queued = true;
        var current = generation;
        if (!DispatcherQueue.TryEnqueue(() =>
        {
            if (!active || current != generation || recoveryFailed) return;
            queued = false;
            Render();
        })) queued = false;
    }

    private void Render(bool recreate = false)
    {
        try
        {
            if (recreate) ReleaseGraphics();
            if (device is null) CreateGraphics();
            Redraw();
        }
        // Внешняя граница включает Dispose drawing session: ошибка может возникнуть
        // при завершении рисования. Остальные исключения сохраняют исходную причину.
        catch (Exception error) when (!recovering && device is { } failed && failed.IsDeviceLost(error.HResult))
        {
            failed.RaiseDeviceLost();
        }
        catch (Exception error)
        {
            // Терминальный отказ завершает владение и при частичном CreateGraphics.
            recoveryFailed = true;
            try
            {
                ReleaseGraphics();
            }
            catch (Exception cleanupError)
            {
                throw new AggregateException("Ошибка рисования и освобождения ресурсов LabButton.", error, cleanupError);
            }
            throw;
        }
    }

    private void CreateGraphics()
    {
        device = CanvasDevice.GetSharedDevice();
        device.DeviceLost += DeviceLost;
        var compositor = ElementCompositionPreview.GetElementVisual(this).Compositor;
        graphics = CanvasComposition.CreateCompositionGraphicsDevice(compositor, device);
        container = compositor.CreateContainerVisual();
        for (var index = 0; index < 3; index++)
        {
            var surface = graphics.CreateDrawingSurface(new Size(0, 0),
                DirectXPixelFormat.B8G8R8A8UIntNormalized, DirectXAlphaMode.Premultiplied);
            surfaces.Add(surface);
            var brush = compositor.CreateSurfaceBrush(surface);
            brushes.Add(brush);
            var visual = compositor.CreateSpriteVisual();
            visuals.Add(visual);
            visual.Brush = brush;
            visual.Opacity = index == 0 ? 1 : 0;
            container.Children.InsertAtTop(visual);
        }
        ElementCompositionPreview.SetElementChildVisual(this, container);
        VisualsChanged?.Invoke(this, EventArgs.Empty);
    }

    private void DeviceLost(CanvasDevice sender, object args)
    {
        var current = generation;
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!active || current != generation || !ReferenceEquals(sender, device) || recoveryFailed) return;
            recovering = true;
            try
            {
                Render(recreate: true);
            }
            finally
            {
                recovering = false;
            }
        });
    }

    private void ReleaseGraphics()
    {
        var ownedDevice = device;
        var ownedContainer = container;
        var ownedGraphics = graphics;
        var ownedVisuals = visuals.ToArray();
        var ownedBrushes = brushes.ToArray();
        var ownedSurfaces = surfaces.ToArray();
        device = null;
        container = null;
        graphics = null;
        visuals.Clear();
        brushes.Clear();
        surfaces.Clear();

        List<Exception> errors = [];
        void Attempt(Action release)
        {
            try { release(); }
            catch (Exception error) { errors.Add(error); }
        }

        // Отказ одного Close не пропускает остальные объекты и снятие подписки.
        Attempt(() => VisualsChanging?.Invoke(this, EventArgs.Empty));
        if (ownedDevice is not null) Attempt(() => ownedDevice.DeviceLost -= DeviceLost);
        Attempt(() => ElementCompositionPreview.SetElementChildVisual(this, null));
        foreach (var visual in ownedVisuals) Attempt(visual.Dispose);
        foreach (var brush in ownedBrushes) Attempt(brush.Dispose);
        foreach (var surface in ownedSurfaces) Attempt(surface.Dispose);
        if (ownedContainer is not null) Attempt(ownedContainer.Dispose);
        if (ownedGraphics is not null) Attempt(ownedGraphics.Dispose);
        // SharedDevice принадлежит Win2D; контрол освобождает только свои ресурсы.
        if (errors.Count == 1) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(errors[0]).Throw();
        if (errors.Count > 1) throw new AggregateException("Не удалось освободить ресурсы LabButton.", errors);
    }

    private void Redraw()
    {
        if (!active || device is null || ActualWidth <= 0 || ActualHeight <= 0) return;
        if (Fill is null || Light is null || Dark is null)
            throw new InvalidOperationException("Button требует готовые LabUI brushes из LabColors.");
        var scale = XamlRoot?.RasterizationScale ?? 1;
        var pixels = new Size(Math.Ceiling(ActualWidth * scale), Math.Ceiling(ActualHeight * scale));
        var bounds = new Rect(0, 0, ActualWidth, ActualHeight);
        var radius = (float)Math.Min(metrics.Radius, Math.Min(ActualWidth, ActualHeight) / 2);
        using var shape = CanvasGeometry.CreateRoundedRectangle(device, bounds, radius, radius);
        for (var index = 0; index < surfaces.Count; index++)
        {
            surfaces[index].Resize(new SizeInt32(checked((int)pixels.Width), checked((int)pixels.Height)));
            visuals[index].Size = new Vector2((float)ActualWidth, (float)ActualHeight);
            using var drawing = CanvasComposition.CreateDrawingSession(surfaces[index],
                new Rect(0, 0, pixels.Width, pixels.Height), (float)(96 * scale));
            drawing.Clear(Color.FromArgb(0, 0, 0, 0));
            using var clip = drawing.CreateLayer(1, shape);
            using var fill = Paint(Fill);
            drawing.FillRectangle(bounds, fill);
            DrawSheen(drawing, bounds, index);
            if (index == 2) DrawGlow(drawing, bounds);
            DrawInset(drawing, bounds, radius, index == 2);
        }
    }

    private CanvasSolidColorBrush Paint(SolidColorBrush paint, double opacity = 1)
        => new(device, paint.Color) { Opacity = (float)(paint.Opacity * opacity) };

    private void DrawSheen(CanvasDrawingSession drawing, Rect bounds, int state)
    {
        var paint = state == 2 ? Dark! : Light!;
        var color = paint.Color;
        using var gradient = new CanvasLinearGradientBrush(device, new[]
        {
            new CanvasGradientStop { Position = 0, Color = color },
            new CanvasGradientStop { Position = 1, Color = Color.FromArgb(0, color.R, color.G, color.B) },
        })
        {
            StartPoint = Vector2.Zero,
            EndPoint = new Vector2(0, (float)bounds.Height),
            Opacity = (float)(paint.Opacity * (state == 2 ? Geometry.ShadeOpacity
                : state == 1 ? Geometry.SheenHoverOpacity : Geometry.SheenOpacity)),
        };
        drawing.FillRectangle(bounds, gradient);
    }

    private void DrawGlow(CanvasDrawingSession drawing, Rect bounds)
    {
        using var source = new CanvasCommandList(device);
        using (var sourceDrawing = source.CreateDrawingSession())
        using (var light = Paint(Light!, Geometry.GlowOpacity))
            sourceDrawing.FillCircle(new Vector2((float)(bounds.Width / 2 + metrics.GlowShift),
                (float)(bounds.Height / 2)), (float)(Geometry.GlowSize / 2), light);
        // CSS filter blur задаёт σ, а не радиус ядра.
        using var blur = new GaussianBlurEffect
        {
            Source = source, BlurAmount = (float)Geometry.GlowBlur, BorderMode = EffectBorderMode.Soft,
        };
        drawing.DrawImage(blur);
    }

    private void DrawInset(CanvasDrawingSession drawing, Rect bounds, float radius, bool pressed)
    {
        var offset = (pressed ? 1 : -1) * Geometry.ShadowOffset;
        var padding = Geometry.ShadowBlur * 3 + Math.Abs(offset);
        using var outside = CanvasGeometry.CreateRectangle(device,
            new Rect(-padding, -padding, bounds.Width + padding * 2, bounds.Height + padding * 2));
        using var hole = CanvasGeometry.CreateRoundedRectangle(device,
            new Rect(0, offset, bounds.Width, bounds.Height), radius, radius);
        using var mask = outside.CombineWith(hole, Matrix3x2.Identity, CanvasGeometryCombine.Exclude);
        using var source = new CanvasCommandList(device);
        using (var sourceDrawing = source.CreateDrawingSession())
        using (var dark = Paint(Dark!, ShadowOpacity)) sourceDrawing.FillGeometry(mask, dark);
        // В CSS box-shadow blur-radius равен 2σ; внешний clip оставляет только внутренний край.
        using var blur = new GaussianBlurEffect
        {
            Source = source, BlurAmount = (float)(Geometry.ShadowBlur / 2), BorderMode = EffectBorderMode.Soft,
        };
        drawing.DrawImage(blur);
    }
}
