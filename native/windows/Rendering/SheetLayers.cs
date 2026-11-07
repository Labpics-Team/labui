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
using Windows.Graphics.Effects;
using Windows.UI;
using Windows.UI.ViewManagement;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Buttons")]

namespace LabUI.WinUI.Rendering;

internal readonly record struct SheetMaterialCapabilities(bool? AdvancedEffectsEnabled,
    bool? AreEffectsSupported, bool? AreEffectsFast);

// Ghost и Body используют один captured backdrop и один итоговый LayerVisual.
public sealed class SheetLayers : Grid
{
    public static readonly DependencyProperty TintProperty = PaintProperty(nameof(Tint));
    public static readonly DependencyProperty BlendProperty = PaintProperty(nameof(Blend));
    public static readonly DependencyProperty GhostProperty = PaintProperty(nameof(Ghost));
    public static readonly DependencyProperty BorderProperty = PaintProperty(nameof(Border));
    public static readonly DependencyProperty NoiseProperty = PaintProperty(nameof(Noise));
    public static readonly DependencyProperty ShadowInkProperty = PaintProperty(nameof(ShadowInk));
    public static readonly DependencyProperty SolidProperty = PaintProperty(nameof(Solid));

    public SolidColorBrush? Tint { get => (SolidColorBrush?)GetValue(TintProperty); set => SetValue(TintProperty, value); }
    public SolidColorBrush? Blend { get => (SolidColorBrush?)GetValue(BlendProperty); set => SetValue(BlendProperty, value); }
    public SolidColorBrush? Ghost { get => (SolidColorBrush?)GetValue(GhostProperty); set => SetValue(GhostProperty, value); }
    public SolidColorBrush? Border { get => (SolidColorBrush?)GetValue(BorderProperty); set => SetValue(BorderProperty, value); }
    public SolidColorBrush? Noise { get => (SolidColorBrush?)GetValue(NoiseProperty); set => SetValue(NoiseProperty, value); }
    public SolidColorBrush? ShadowInk { get => (SolidColorBrush?)GetValue(ShadowInkProperty); set => SetValue(ShadowInkProperty, value); }
    public SolidColorBrush? Solid { get => (SolidColorBrush?)GetValue(SolidProperty); set => SetValue(SolidProperty, value); }

    internal LabSheetMaterial? EffectiveMaterial => frame?.Material;
    internal LabSheetMaterialReason? MaterialReason => frame?.Reason;
    internal SheetMaterialCapabilities? MaterialCapabilities => frame?.Capabilities;
    internal event EventHandler? EffectiveMaterialChanged;

    private readonly List<(DependencyObject Owner, DependencyProperty Property, long Token)> paintCallbacks = [];
    private CanvasDevice? device;
    private CompositionGraphicsDevice? graphics;
    private Frame? frame;
    private SheetMetrics? geometry;
    private XamlRoot? root;
    private UISettings? settings;
    private CompositionCapabilities? capabilities;
    private LabSheetMaterial requested;
    private bool active;
    private bool queued;
    private bool recovering;
    private bool recoveryFailed;
    private long generation;

    // Экспериментальная проекция: Figma radius не доказан равным Win2D sigma.
    // Начальная гипотеза radius / 2 проверяется на эталонном backdrop отдельно от paints.
    internal const double RadiusToSigma = 0.5;
    // Дискретные Gaussian-ветви с линейными весами, не маска одного сильного blur.
    // Число ветвей и зерно требуют визуальной и GPU-квалификации.

    internal void Attach(LabSheetMaterial material)
    {
        if (active) return;
        active = true;
        recoveryFailed = false;
        generation++;
        requested = material;
        root = XamlRoot;
        if (root is not null) root.Changed += RootChanged;
        settings = new UISettings();
        settings.AdvancedEffectsEnabledChanged += AdvancedEffectsChanged;
        capabilities = new CompositionCapabilities();
        capabilities.Changed += CapabilitiesChanged;
        SizeChanged += Resized;
        ActualThemeChanged += ThemeChanged;
        ObservePaints();
        Render();
    }

    internal void SetMaterial(LabSheetMaterial material)
    {
        if (material is not (LabSheetMaterial.Blur or LabSheetMaterial.Solid))
            throw new ArgumentOutOfRangeException(nameof(material));
        requested = material;
        QueueRedraw();
    }

    internal void SetMetrics(SheetMetrics metrics)
    {
        if (geometry == metrics) return;
        geometry = metrics;
        QueueRedraw();
    }

    internal void Detach()
    {
        if (!active) return;
        active = false;
        generation++;
        queued = false;
        SizeChanged -= Resized;
        ActualThemeChanged -= ThemeChanged;
        if (root is not null) root.Changed -= RootChanged;
        if (settings is not null) settings.AdvancedEffectsEnabledChanged -= AdvancedEffectsChanged;
        if (capabilities is not null) capabilities.Changed -= CapabilitiesChanged;
        root = null;
        settings = null;
        capabilities = null;
        ClearPaintCallbacks();
        ReleaseGraphics();
    }

    private static DependencyProperty PaintProperty(string name) => DependencyProperty.Register(
        name, typeof(SolidColorBrush), typeof(SheetLayers), new PropertyMetadata(null, PaintChanged));

    private static void PaintChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
    {
        var layers = (SheetLayers)sender;
        if (!layers.active) return;
        layers.ObservePaints();
        layers.QueueRedraw();
    }

    private void ObservePaints()
    {
        ClearPaintCallbacks();
        foreach (var paint in new[] { Tint, Blend, Ghost, Border, Noise, ShadowInk, Solid }.OfType<SolidColorBrush>().Distinct())
            foreach (var property in new[] { SolidColorBrush.ColorProperty, Brush.OpacityProperty })
            {
                var token = paint.RegisterPropertyChangedCallback(property, (_, _) => QueueRedraw());
                paintCallbacks.Add((paint, property, token));
            }
    }

    private void ClearPaintCallbacks()
    {
        foreach (var (owner, property, token) in paintCallbacks) owner.UnregisterPropertyChangedCallback(property, token);
        paintCallbacks.Clear();
    }

    private void Resized(object sender, SizeChangedEventArgs args) => QueueRedraw();
    private void RootChanged(XamlRoot sender, XamlRootChangedEventArgs args) => QueueRedraw();
    private void ThemeChanged(FrameworkElement sender, object args) => QueueRedraw();
    private void AdvancedEffectsChanged(UISettings sender, object args) => QueueFromAnyThread();
    private void CapabilitiesChanged(CompositionCapabilities sender, object args) => QueueFromAnyThread();

    private void QueueFromAnyThread()
    {
        var current = generation;
        DispatcherQueue.TryEnqueue(() => { if (active && current == generation) QueueRedraw(); });
    }

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

    private (LabSheetMaterial Material, LabSheetMaterialReason Reason, SheetMaterialCapabilities Capabilities) ResolveMaterial()
    {
        var facts = new SheetMaterialCapabilities(settings?.AdvancedEffectsEnabled,
            capabilities?.AreEffectsSupported(), capabilities?.AreEffectsFast());
        var resolved = ResolveMaterial(requested, facts);
        return (resolved.Material, resolved.Reason, facts);
    }

    private static (LabSheetMaterial Material, LabSheetMaterialReason Reason) ResolveMaterial(
        LabSheetMaterial requested, SheetMaterialCapabilities facts)
    {
        if (requested == LabSheetMaterial.Solid) return (requested, LabSheetMaterialReason.Requested);
        if (facts.AdvancedEffectsEnabled == false)
            return (LabSheetMaterial.Solid, LabSheetMaterialReason.TransparencyDisabled);
        if (facts.AreEffectsSupported != true)
            return (LabSheetMaterial.Solid, LabSheetMaterialReason.EffectsUnsupported);
        // Fast — наблюдаемый сигнал стоимости; поддержанный Blur требует отдельной квалификации.
        return (LabSheetMaterial.Blur, LabSheetMaterialReason.Requested);
    }

    private void Render(bool recreate = false)
    {
        if (!active || ActualWidth <= 0 || ActualHeight <= 0 || geometry is not { } metrics) return;
        var current = generation;
        try
        {
            if (Tint is null || Blend is null || Ghost is null || Border is null || Noise is null || ShadowInk is null || Solid is null)
                throw new InvalidOperationException("Sheet требует готовые LabUI brushes из LabColors.");
            if (Solid.Opacity != 1 || Solid.Color.A != byte.MaxValue)
                throw new InvalidOperationException("Solid Sheet требует непрозрачную краску LabColors.");
            if (recreate)
            {
                ReleaseGraphics();
                // Уведомление об утрате готовности может выгрузить или переподключить контрол.
                if (!active || current != generation) return;
            }
            var compositor = ElementCompositionPreview.GetElementVisual(this).Compositor;
            if (device is null)
            {
                device = CanvasDevice.GetSharedDevice();
                device.DeviceLost += DeviceLost;
                graphics = CanvasComposition.CreateCompositionGraphicsDevice(compositor, device);
            }
            var resolved = ResolveMaterial();
            var candidate = BuildFrame(compositor, metrics, resolved.Material, resolved.Reason, resolved.Capabilities);
            try { ElementCompositionPreview.SetElementChildVisual(this, candidate.Visual); }
            catch (Exception error)
            {
                try { candidate.Dispose(); }
                catch (Exception cleanup) { throw new AggregateException("Ошибка подключения и освобождения Sheet.", error, cleanup); }
                throw;
            }
            var previous = frame;
            frame = candidate;
            previous?.Dispose();
            var changed = previous?.Material != candidate.Material || previous?.Reason != candidate.Reason;
            if (changed) EffectiveMaterialChanged?.Invoke(this, EventArgs.Empty);
        }
        catch (Exception) when (current != generation)
        {
            // Callback уже сменил владельца полей. Ошибка старого вызова не относится к преемнику.
            throw;
        }
        catch (Exception error) when (!recovering && device is { } failed && failed.IsDeviceLost(error.HResult))
        {
            failed.RaiseDeviceLost();
        }
        catch (Exception error)
        {
            recoveryFailed = true;
            try { ReleaseGraphics(); }
            catch (Exception cleanup) { throw new AggregateException("Ошибка рисования и освобождения Sheet.", error, cleanup); }
            throw;
        }
    }

    private void DeviceLost(CanvasDevice sender, object args)
    {
        var current = generation;
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!active || current != generation || !ReferenceEquals(sender, device) || recoveryFailed) return;
            recovering = true;
            try { Render(recreate: true); }
            finally { recovering = false; }
        });
    }

    private void ReleaseGraphics()
    {
        var ownedDevice = device;
        var ownedGraphics = graphics;
        var ownedFrame = frame;
        device = null;
        graphics = null;
        frame = null;
        List<Exception> errors = [];
        void Attempt(Action release) { try { release(); } catch (Exception error) { errors.Add(error); } }
        if (ownedDevice is not null) Attempt(() => ownedDevice.DeviceLost -= DeviceLost);
        Attempt(() => ElementCompositionPreview.SetElementChildVisual(this, null));
        if (ownedFrame is not null) Attempt(ownedFrame.Dispose);
        if (ownedGraphics is not null) Attempt(ownedGraphics.Dispose);
        if (ownedFrame is not null) Attempt(() => EffectiveMaterialChanged?.Invoke(this, EventArgs.Empty));
        // SharedDevice освобождает Win2D; Sheet не владеет им.
        Frame.ThrowCleanup(errors);
    }

    private Frame BuildFrame(Compositor compositor, SheetMetrics metrics, LabSheetMaterial material,
        LabSheetMaterialReason reason, SheetMaterialCapabilities capabilities)
    {
        var result = new Frame(compositor, material, reason, capabilities);
        SurfaceStages? stages = null;
        try
        {
            var scale = XamlRoot?.RasterizationScale ?? 1;
            var pixelWidth = checked((int)Math.Ceiling(metrics.Width * scale));
            var pixelHeight = checked((int)Math.Ceiling(metrics.Height * scale));
            using var bodyShape = BodyShape(metrics);

            CompositionSurfaceBrush Surface(Action<CanvasDrawingSession> draw)
            {
                var surface = result.Own(graphics!.CreateDrawingSurface(new Size(pixelWidth, pixelHeight),
                    DirectXPixelFormat.B8G8R8A8UIntNormalized, DirectXAlphaMode.Premultiplied));
                using (var drawing = CanvasComposition.CreateDrawingSession(surface,
                    new Rect(0, 0, pixelWidth, pixelHeight), (float)(96 * scale)))
                {
                    drawing.Clear(Color.FromArgb(0, 0, 0, 0));
                    draw(drawing);
                }
                return result.Own(compositor.CreateSurfaceBrush(surface));
            }

            void DrawBorder(CanvasDrawingSession drawing)
            {
                using var clip = drawing.CreateLayer(1, bodyShape);
                using var ink = new CanvasSolidColorBrush(device, Border!.Color) { Opacity = (float)Border.Opacity };
                drawing.DrawGeometry(bodyShape, ink, (float)(Geometry.SheetBorderWidth * metrics.Scale * 2));
            }

            result.Visual.Size = new Vector2((float)metrics.Width, (float)metrics.Height);
            if (material == LabSheetMaterial.Solid)
            {
                // Отказ Composition effects не должен пытаться построить другой effect graph.
                result.Visual.Brush = Surface(drawing =>
                {
                    DrawShadows(drawing, metrics, bodyShape);
                    using var ink = new CanvasSolidColorBrush(device, Solid!.Color);
                    drawing.FillGeometry(bodyShape, ink);
                    DrawBorder(drawing);
                });
                return result;
            }

            var atlas = SheetAtlasLayout.Create(pixelWidth, pixelHeight, result.Visual.Size, scale,
                SheetBlurProfile.Levels.Length + 5);
            List<Action<CanvasDrawingSession>> atlasDrawings = [];
            T Effect<T>(T effect) where T : IGraphicsEffect, IDisposable
            {
                result.Own(effect);
                return effect;
            }
            int AddLayer(Action<CanvasDrawingSession> draw)
            {
                var index = atlasDrawings.Count;
                atlas.Cell(index);
                atlasDrawings.Add(draw);
                return index;
            }
            IGraphicsEffectSource Source(string name) => new CompositionEffectSourceParameter(name);
            IGraphicsEffectSource Backdrop() => Source("backdrop");
            Transform2DEffect Layer(int index) => Effect(new Transform2DEffect
            {
                Source = Source("atlas"),
                TransformMatrix = atlas.Cell(index).EffectTransform,
                InterpolationMode = CanvasImageInterpolation.Linear,
                BorderMode = EffectBorderMode.Soft,
            });
            IGraphicsEffectSource Paint(SolidColorBrush brush, string sourceName) => Effect(new OpacityEffect
            {
                Opacity = (float)brush.Opacity,
                Source = Source(sourceName),
            });
            CompositeEffect Mask(IGraphicsEffectSource source, IGraphicsEffectSource mask)
                => Effect(new CompositeEffect { Mode = CanvasComposite.DestinationIn, Sources = { source, mask } });
            GaussianBlurEffect Blur(IGraphicsEffectSource source, double radius, string? name = null)
            {
                var blur = Effect(new GaussianBlurEffect
                {
                    Source = source, BlurAmount = (float)(radius * RadiusToSigma), BorderMode = EffectBorderMode.Hard,
                });
                if (name is not null) blur.Name = name;
                return blur;
            }

            // Белая структурная маска не является краской поверхности.
            var maskInk = Color.FromArgb(255, 255, 255, 255);
            var bodyMask = AddLayer(drawing => drawing.FillGeometry(bodyShape, maskInk));
            var outer = AddLayer(drawing => DrawShadows(drawing, metrics, bodyShape));
            var noise = AddLayer(drawing => DrawNoise(drawing, pixelWidth, pixelHeight, scale));
            int[] ghostMasks = new int[SheetBlurProfile.Levels.Length];
            for (var index = 0; index < SheetBlurProfile.Levels.Length; index++)
            {
                var level = index;
                ghostMasks[index] = AddLayer(drawing =>
                {
                    var stops = SheetBlurProfile.Stops(level).Select(stop => new CanvasGradientStop
                    { Position = stop.Position, Color = Color.FromArgb((byte)(stop.Weight * 255), maskInk.R, maskInk.G, maskInk.B) }).ToArray();
                    using var gradient = new CanvasLinearGradientBrush(device, stops)
                    { StartPoint = Vector2.Zero, EndPoint = new(0, (float)metrics.GhostHeight) };
                    drawing.FillRectangle(new Rect(0, 0, metrics.Width, metrics.GhostHeight), gradient);
                });
            }
            var ghostMask = AddLayer(drawing =>
                drawing.FillRectangle(new Rect(0, 0, metrics.Width, metrics.GhostHeight), maskInk));
            var border = AddLayer(DrawBorder);
            if (atlasDrawings.Count != atlas.CellCount)
                throw new InvalidOperationException("Sheet atlas требует все authored raster-слои.");
            var atlasSurface = result.Own(graphics!.CreateVirtualDrawingSurface(
                new Windows.Graphics.SizeInt32 { Width = atlas.Width, Height = atlas.Height },
                DirectXPixelFormat.B8G8R8A8UIntNormalized, DirectXAlphaMode.Premultiplied));
            void DrawAtlasCell(int index)
            {
                var cell = atlas.Cell(index);
                using var drawing = CanvasComposition.CreateDrawingSession(atlasSurface,
                    new Rect(cell.PixelX, cell.PixelY, pixelWidth, pixelHeight), (float)(96 * scale));
                drawing.Clear(Color.FromArgb(0, 0, 0, 0));
                // Win2D включает returned BeginDraw offset; callback рисует локально.
                atlasDrawings[index](drawing);
            }
            for (var index = 0; index < atlasDrawings.Count; index++) DrawAtlasCell(index);
            var atlasBrush = result.Own(compositor.CreateSurfaceBrush(atlasSurface));
            atlasBrush.Stretch = CompositionStretch.None;
            atlasBrush.HorizontalAlignmentRatio = 0;
            atlasBrush.VerticalAlignmentRatio = 0;
            atlasBrush.Scale = atlas.BrushScale;
            atlasBrush.Offset = atlas.BrushOffset;
            var backdropBrush = result.Own(compositor.CreateBackdropBrush());
            CompositionEffectBrush Brush(string factoryName, IGraphicsEffect graph,
                params (string Name, CompositionBrush Source)[] bindings)
            {
                var operation = "factory";
                try
                {
                    var factory = result.Own(SheetSourceTopologyProbe.CreateFactory(compositor,
                        graph, Geometry.SheetGhostBlurRadius * metrics.Scale * RadiusToSigma,
                        Geometry.SheetBodyBlurRadius * metrics.Scale * RadiusToSigma));
                    operation = "brush";
                    var brush = result.Own(factory.CreateBrush());
                    operation = "binding";
                    foreach (var (name, source) in bindings) brush.SetSourceParameter(name, source);
                    return brush;
                }
                catch (Exception primary)
                {
                    try
                    {
                        primary.Data["LabUI.SheetFactoryFailure"] = new Dictionary<string, object?>
                        { ["name"] = factoryName, ["operation"] = operation };
                    }
                    catch { }
                    throw;
                }
            }
            CompositionEffectBrush MaskBrush(string factoryName, int index) =>
                Brush(factoryName, Mask(Source("Backdrop"), Layer(index)), ("atlas", atlasBrush));

            // Каждый authored уровень сохраняет свою Gaussian-ветвь и маску.
            IGraphicsEffectSource[] branches = new IGraphicsEffectSource[SheetBlurProfile.Levels.Length];
            for (var index = 0; index < branches.Length; index++)
                branches[index] = Mask(index == 0 ? Backdrop()
                    : Blur(Backdrop(), SheetBlurProfile.Levels[index] * Geometry.SheetGhostBlurRadius * metrics.Scale,
                        $"ghostBlur{index}"), Layer(ghostMasks[index]));
            stages = new SurfaceStages(result, compositor);
            var seedGraph = Effect(new OpacityEffect { Source = Backdrop(), Opacity = 1 });
            var seed = stages.CreateVisual(Brush("progressiveSeed", seedGraph, ("backdrop", backdropBrush)));
            result.Visual.Children.InsertAtBottom(seed);
            var capturedBackdrop = stages.Capture(seed);
            seed.Opacity = 0;

            var progressiveSources = new CompositionSurfaceBrush[branches.Length];
            for (var index = 0; index < branches.Length; index++)
            {
                var leaf = stages.CreateVisual(Brush($"progressiveLeaf{index}", (IGraphicsEffect)branches[index],
                    ("backdrop", capturedBackdrop), ("atlas", atlasBrush)));
                progressiveSources[index] = stages.Capture(leaf);
            }
            // Бинарные Add материализуются перед следующим уровнем суммы.
            for (var count = progressiveSources.Length; count > 1; count /= 2)
                for (var index = 0; index < count; index += 2)
                {
                    var pair = Effect(new CompositeEffect
                    { Mode = CanvasComposite.Add, Sources = { Source("left"), Source("right") } });
                    var sum = stages.CreateVisual(Brush("progressiveSum", pair,
                        ("left", progressiveSources[index]), ("right", progressiveSources[index + 1])));
                    progressiveSources[index / 2] = stages.Capture(sum);
                }
            var capturedProgressive = progressiveSources[0];
            // Alpha Color и float Opacity остаются раздельными входами LabColors.
            var ghostPaint = result.Own(compositor.CreateColorBrush(Ghost!.Color));
            var tintPaint = result.Own(compositor.CreateColorBrush(Tint!.Color));
            var blendPaint = result.Own(compositor.CreateColorBrush(Blend!.Color));
            // Маска применяется к сведённым Ghost слоям; alpha tint не ослабляет backdrop/noise.
            var ghostBackdrop = stages.CreateVisual(capturedProgressive);
            var ghostTint = stages.CreateVisual(ghostPaint, (float)Ghost!.Opacity);
            var noiseBrush = Brush("ghost", Layer(noise), ("atlas", atlasBrush));
            var ghostNoise = stages.CreateVisual(noiseBrush, (float)Geometry.SheetGhostNoiseOpacity);
            var ghostVisual = stages.CreateLayer(ghostBackdrop, ghostTint, ghostNoise);
            ghostVisual.Effect = MaskBrush("ghost", ghostMask);
            var bodyBackdrop = stages.CreateVisual(Brush("body",
                Blur(Backdrop(), Geometry.SheetBodyBlurRadius * metrics.Scale), ("backdrop", capturedBackdrop)));
            var bodyTint = stages.CreateVisual(tintPaint, (float)Tint!.Opacity);
            var tinted = stages.CreateLayer(bodyBackdrop, bodyTint);
            var blended = Effect(new BlendEffect
            {
                Background = Source("Backdrop"), Foreground = Paint(Blend!, "blendPaint"),
                Mode = ActualTheme == ElementTheme.Dark ? BlendEffectMode.Overlay : BlendEffectMode.ColorDodge,
            });
            tinted.Effect = Brush("body", blended, ("blendPaint", blendPaint));
            var bodyNoise = stages.CreateVisual(noiseBrush, (float)Geometry.SheetBodyNoiseOpacity);
            var bodyVisual = stages.CreateLayer(tinted, bodyNoise);
            bodyVisual.Effect = MaskBrush("body", bodyMask);
            var outerVisual = stages.CreateVisual(Brush("outer", Layer(outer),
                ("atlas", atlasBrush)));
            var borderVisual = stages.CreateVisual(Brush("border", Layer(border),
                ("atlas", atlasBrush)));
            // Штатный LayerVisual сводит SourceOver четырёх слоёв до opacity предков.
            // Дополнительные captures Ghost/Body и общий inline effect graph не нужны.
            var output = stages.CreateLayer(ghostVisual, outerVisual, bodyVisual, borderVisual);
            result.Visual.Children.InsertAtTop(output);
            result.Own(stages);
            return result;
        }
        catch (Exception error)
        {
            List<Exception> errors = [error];
            try { stages?.Dispose(); }
            catch (Exception cleanup) { errors.Add(cleanup); }
            try { result.Dispose(); }
            catch (Exception cleanup) { errors.Add(cleanup); }
            if (errors.Count > 1) throw new AggregateException("Ошибка создания и освобождения Sheet.", errors);
            throw;
        }
    }

    private CanvasGeometry BodyShape(SheetMetrics metrics, double offsetY = 0)
    {
        var radius = (float)Math.Min(Geometry.SheetRadius * metrics.Scale, Math.Min(metrics.Width / 2, metrics.BodyHeight));
        var left = 0f;
        var right = (float)metrics.Width;
        var top = (float)(metrics.BodyTop + offsetY);
        var bottom = (float)(metrics.Height + offsetY);
        using var path = new CanvasPathBuilder(device);
        path.BeginFigure(left + radius, top);
        path.AddLine(right - radius, top);
        path.AddArc(new Vector2(right, top + radius), radius, radius, 0, CanvasSweepDirection.Clockwise, CanvasArcSize.Small);
        path.AddLine(right, bottom);
        path.AddLine(left, bottom);
        path.AddLine(left, top + radius);
        path.AddArc(new Vector2(left + radius, top), radius, radius, 0, CanvasSweepDirection.Clockwise, CanvasArcSize.Small);
        path.EndFigure(CanvasFigureLoop.Closed);
        return CanvasGeometry.CreatePath(path);
    }

    private void DrawShadows(CanvasDrawingSession drawing, SheetMetrics metrics, CanvasGeometry body)
    {
        using var viewport = CanvasGeometry.CreateRectangle(device, new Rect(0, 0, metrics.Width, metrics.Height));
        using var outside = viewport.CombineWith(body, Matrix3x2.Identity, CanvasGeometryCombine.Exclude);
        using var clip = drawing.CreateLayer(1, outside);
        // showShadowBehindNode=false: полупрозрачная заливка не скрывает внутреннюю тень сама.
        for (var index = Geometry.SheetShadows.Length - 1; index >= 0; index--)
        {
            var shadow = Geometry.SheetShadows[index];
            using var shifted = BodyShape(metrics, shadow.OffsetY * metrics.Scale);
            using var source = new CanvasCommandList(device);
            using (var sourceDrawing = source.CreateDrawingSession())
            using (var ink = new CanvasSolidColorBrush(device, ShadowInk!.Color)
            { Opacity = (float)(ShadowInk.Opacity * shadow.Opacity) }) sourceDrawing.FillGeometry(shifted, ink);
            using var blur = new GaussianBlurEffect
            { Source = source, BlurAmount = (float)(shadow.BlurRadius * metrics.Scale * RadiusToSigma), BorderMode = EffectBorderMode.Soft };
            drawing.DrawImage(blur);
        }
    }

    private void DrawNoise(CanvasDrawingSession drawing, int width, int height, double scale)
    {
        var paint = Noise!;
        var pixels = new byte[checked(width * height * 4)];
        uint state = 0x9E3779B9;
        for (var offset = 0; offset < pixels.Length; offset += 4)
        {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            var alpha = (byte)Math.Round((state & 255) * paint.Opacity * paint.Color.A / 255);
            pixels[offset] = (byte)(paint.Color.B * alpha / 255);
            pixels[offset + 1] = (byte)(paint.Color.G * alpha / 255);
            pixels[offset + 2] = (byte)(paint.Color.R * alpha / 255);
            pixels[offset + 3] = alpha;
        }
        // Пока один sample на физический пиксель; Figma noiseSize=0.2 не квалифицирован.
        using var bitmap = CanvasBitmap.CreateFromBytes(device, pixels, width, height,
            Windows.Graphics.DirectX.DirectXPixelFormat.B8G8R8A8UIntNormalized, (float)(96 * scale), CanvasAlphaMode.Premultiplied);
        drawing.DrawImage(bitmap);
    }

    // Один unlink owner разрывает capture/tree ссылки перед Frame-owned COM cleanup.
    private sealed class SurfaceStages(Frame frame, Compositor compositor) : IDisposable
    {
        private readonly List<SpriteVisual> visuals = [];
        private readonly List<CompositionVisualSurface> surfaces = [];
        private readonly List<LayerVisual> layers = [];

        internal SpriteVisual CreateVisual(CompositionBrush brush, float opacity = 1)
        {
            var visual = frame.Own(compositor.CreateSpriteVisual());
            visuals.Add(visual);
            visual.Size = frame.Visual.Size;
            visual.CompositeMode = CompositionCompositeMode.SourceOver;
            visual.Opacity = opacity;
            visual.Brush = brush;
            return visual;
        }

        internal LayerVisual CreateLayer(params Visual[] children)
        {
            var layer = frame.Own(compositor.CreateLayerVisual());
            layers.Add(layer);
            layer.Size = frame.Visual.Size;
            layer.CompositeMode = CompositionCompositeMode.SourceOver;
            foreach (var child in children) layer.Children.InsertAtTop(child);
            return layer;
        }

        internal CompositionSurfaceBrush Capture(SpriteVisual visual)
        {
            var surface = frame.Own(compositor.CreateVisualSurface());
            surfaces.Add(surface);
            surface.SourceVisual = visual;
            surface.SourceOffset = Vector2.Zero;
            surface.SourceSize = visual.Size;
            var brush = frame.Own(compositor.CreateSurfaceBrush(surface));
            brush.Stretch = CompositionStretch.Fill;
            brush.HorizontalAlignmentRatio = 0;
            brush.VerticalAlignmentRatio = 0;
            return brush;
        }

        public void Dispose()
        {
            if (visuals.Count == 0 && surfaces.Count == 0 && layers.Count == 0) return;
            var captured = surfaces.ToArray();
            var rendered = visuals.ToArray();
            var flattened = layers.ToArray();
            surfaces.Clear();
            visuals.Clear();
            layers.Clear();
            List<Exception> errors = [];
            try { frame.Visual.Children.RemoveAll(); }
            catch (Exception error) { errors.Add(error); }
            foreach (var surface in captured)
                try { surface.SourceVisual = null; }
                catch (Exception error) { errors.Add(error); }
            foreach (var layer in flattened)
            {
                try { layer.Effect = null; }
                catch (Exception error) { errors.Add(error); }
                try { layer.Children.RemoveAll(); }
                catch (Exception error) { errors.Add(error); }
            }
            foreach (var visual in rendered)
                try { visual.Brush = null; }
                catch (Exception error) { errors.Add(error); }
            Frame.ThrowCleanup(errors);
        }
    }

    // Снимок владеет каждым COM/effect ресурсом, в том числе при частичном построении.
    private sealed class Frame : IDisposable
    {
        private readonly List<IDisposable> owned = [];
        internal SpriteVisual Visual { get; }
        internal LabSheetMaterial Material { get; }
        internal LabSheetMaterialReason Reason { get; }
        internal SheetMaterialCapabilities Capabilities { get; }
        internal Frame(Compositor compositor, LabSheetMaterial material, LabSheetMaterialReason reason,
            SheetMaterialCapabilities capabilities)
        {
            Material = material;
            Reason = reason;
            Capabilities = capabilities;
            Visual = Own(compositor.CreateSpriteVisual());
        }
        internal T Own<T>(T value) where T : IDisposable { owned.Add(value); return value; }
        public void Dispose()
        {
            if (owned.Count == 0) return;
            var resources = owned.ToArray();
            owned.Clear();
            List<Exception> errors = [];
            // Visual перестаёт удерживать граф до закрытия его кистей и поверхностей.
            try { Visual.Brush = null; } catch (Exception error) { errors.Add(error); }
            for (var index = resources.Length - 1; index >= 0; index--)
                try { resources[index].Dispose(); } catch (Exception error) { errors.Add(error); }
            ThrowCleanup(errors);
        }
        internal static void ThrowCleanup(List<Exception> errors)
        {
            if (errors.Count == 1) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(errors[0]).Throw();
            if (errors.Count > 1) throw new AggregateException("Не удалось освободить ресурсы Sheet.", errors);
        }
    }
}
