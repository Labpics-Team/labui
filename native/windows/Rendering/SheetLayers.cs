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

namespace LabUI.WinUI.Rendering;

// Ghost и Body используют одну backdrop-кисть и один итоговый SpriteVisual.
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

    private (LabSheetMaterial Material, LabSheetMaterialReason Reason) ResolveMaterial()
    {
        if (requested == LabSheetMaterial.Solid) return (requested, LabSheetMaterialReason.Requested);
        if (settings?.AdvancedEffectsEnabled == false)
            return (LabSheetMaterial.Solid, LabSheetMaterialReason.TransparencyDisabled);
        if (capabilities?.AreEffectsSupported() != true)
            return (LabSheetMaterial.Solid, LabSheetMaterialReason.EffectsUnsupported);
        if (!capabilities.AreEffectsFast()) return (LabSheetMaterial.Solid, LabSheetMaterialReason.EffectsNotFast);
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
            var candidate = BuildFrame(compositor, metrics, resolved.Material, resolved.Reason);
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

    private Frame BuildFrame(Compositor compositor, SheetMetrics metrics, LabSheetMaterial material, LabSheetMaterialReason reason)
    {
        var result = new Frame(compositor, material, reason);
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
            Transform2DEffect Layer(int index, string sourceName = "atlas") => Effect(new Transform2DEffect
            {
                Source = Source(sourceName),
                TransformMatrix = atlas.Cell(index).EffectTransform,
                InterpolationMode = CanvasImageInterpolation.Linear,
                BorderMode = EffectBorderMode.Soft,
            });
            IGraphicsEffectSource Paint(SolidColorBrush brush) => Effect(new OpacityEffect
            {
                Opacity = (float)brush.Opacity,
                Source = Effect(new ColorSourceEffect { Color = brush.Color }),
            });
            CompositeEffect Over(IGraphicsEffectSource background, IGraphicsEffectSource foreground)
                => Effect(new CompositeEffect { Mode = CanvasComposite.SourceOver, Sources = { background, foreground } });
            AlphaMaskEffect Mask(IGraphicsEffectSource source, IGraphicsEffectSource mask)
                => Effect(new AlphaMaskEffect { Source = source, AlphaMask = mask });
            IGraphicsEffectSource Blur(IGraphicsEffectSource source, double radius) => Effect(new GaussianBlurEffect
            {
                Source = source, BlurAmount = (float)(radius * RadiusToSigma), BorderMode = EffectBorderMode.Hard,
            });

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
                IGraphicsEffect progressiveGraph, IGraphicsEffect ghostSourceGraph,
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
                    // Удалить временное имя отказа после RCA и проверенного owner fix.
                    try
                    {
                        if (factoryName == "final"
                            && operation is ("factory" or "brush" or "binding"))
                        {
                            primary.Data["LabUI.SheetFactoryFailure"] = new Dictionary<string, object?>
                            { ["name"] = factoryName, ["operation"] = operation };
                            if (operation == "factory")
                            {
                                // Исходные progressive и Ghost до внешней маски принадлежат Frame.
                                SheetSourceTopologyProbe.RecordBranches(primary, compositor,
                                    progressiveGraph, ghostSourceGraph);
                            }
                        }
                    }
                    catch { }
                    throw;
                }
            }
            CompositeEffect WithNoise(IGraphicsEffectSource source, double opacity) => Over(source,
                Effect(new OpacityEffect { Source = Layer(noise), Opacity = (float)opacity }));

            // Каждый authored уровень сохраняет свою Gaussian-ветвь и маску.
            IGraphicsEffectSource[] branches = new IGraphicsEffectSource[SheetBlurProfile.Levels.Length];
            for (var index = 0; index < branches.Length; index++)
                branches[index] = Mask(index == 0 ? Backdrop()
                    : Blur(Backdrop(), SheetBlurProfile.Levels[index] * Geometry.SheetGhostBlurRadius * metrics.Scale), Layer(ghostMasks[index]));
            var progressive = Effect(new CompositeEffect { Mode = CanvasComposite.Add });
            for (var index = 0; index < branches.Length; index++)
                progressive.Sources.Add(branches[index]);
            // Alpha Ghost tint не управляет существованием backdrop/noise.
            var ghostSource = WithNoise(Over(progressive, Paint(Ghost!)), Geometry.SheetGhostNoiseOpacity);
            var ghost = Mask(ghostSource, Layer(ghostMask));
            var tinted = Over(Blur(Backdrop(), Geometry.SheetBodyBlurRadius * metrics.Scale), Paint(Tint!));
            var blended = Effect(new BlendEffect
            {
                Background = tinted, Foreground = Paint(Blend!),
                Mode = ActualTheme == ElementTheme.Dark ? BlendEffectMode.Overlay : BlendEffectMode.ColorDodge,
            });
            var bodySource = WithNoise(blended, Geometry.SheetBodyNoiseOpacity);
            var bodyAlphaMask = Layer(bodyMask, "bodyMaskAtlas");
            var body = Mask(bodySource, bodyAlphaMask);
            var sheet = Over(Over(ghost, Layer(outer)), body);
            var graph = Over(sheet, Layer(border));
            result.Visual.Brush = Brush("final", graph, progressive, ghostSource,
                ("backdrop", backdropBrush), ("atlas", atlasBrush), ("bodyMaskAtlas", atlasBrush));
            return result;
        }
        catch (Exception error)
        {
            try { result.Dispose(); }
            catch (Exception cleanup) { throw new AggregateException("Ошибка создания и освобождения Sheet.", error, cleanup); }
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

    // Снимок владеет каждым COM/effect ресурсом, в том числе при частичном построении.
    private sealed class Frame : IDisposable
    {
        private readonly List<IDisposable> owned = [];
        internal SpriteVisual Visual { get; }
        internal LabSheetMaterial Material { get; }
        internal LabSheetMaterialReason Reason { get; }
        internal Frame(Compositor compositor, LabSheetMaterial material, LabSheetMaterialReason reason)
        {
            Material = material;
            Reason = reason;
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
