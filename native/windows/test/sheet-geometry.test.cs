using LabUI.WinUI;
using LabUI.WinUI.Rendering;
using System.Numerics;

static void Equal(double actual, double expected, string name)
{
    if (Math.Abs(actual - expected) > 1e-9) throw new Exception($"{name}: {actual} != {expected}");
}

static void Invalid(Action action)
{
    try { action(); }
    catch (ArgumentOutOfRangeException) { return; }
    throw new Exception("Недопустимый viewport принят");
}

// Независимые размеры принятого Half, включая реальный Content slot.
var authored = SheetMetrics.Half(375, 812);
Equal(authored.BodyTop, 390, "body top");
Equal(authored.BodyHeight, 422, "body height");
Equal(authored.GhostHeight, 422, "ghost height");
Equal(authored.ContentTop, 438, "content top");
Equal(authored.ContentHeight, 358, "content height");
Equal(Geometry.SheetRadius, 32, "radius");
Equal(Geometry.SheetInset, 16, "inset");
Equal(Geometry.SheetGap, 24, "gap");
Equal(Geometry.SheetDragArea, 24, "drag area");
Equal(Geometry.SheetIndicatorWidth, 36, "indicator width");
Equal(Geometry.SheetIndicatorHeight, 4, "indicator height");
Equal(Geometry.SheetIndicatorOffset, 14, "indicator y");
Equal(Geometry.SheetIndicatorShift, 0.5, "indicator x shift");

foreach (var height in new[] { 16d, 32d, 96d, 812d, 1200d })
{
    var resized = SheetMetrics.Half(500, height);
    Equal(resized.BodyTop + resized.BodyHeight, height, "body remains bottom aligned");
    if (resized.BodyTop < 0 || resized.ContentHeight < 0 || resized.GhostHeight > height)
        throw new Exception("Геометрия выходит из небольшого viewport");
    if (height >= 32) Equal(resized.BodyHeight, resized.GhostHeight, "equal halves with overlap");
}
foreach (var invalid in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity, 0, -1 })
{
    Invalid(() => SheetMetrics.Half(invalid, 812));
    Invalid(() => SheetMetrics.Half(375, invalid));
}

// Интерполяция градиентных stops независимо от кода renderer.
static double Weight((float Position, float Weight)[] stops, double at)
{
    for (var index = 1; index < stops.Length; index++)
    {
        var a = stops[index - 1];
        var b = stops[index];
        if (at <= b.Position) return a.Weight + (b.Weight - a.Weight) * (at - a.Position) / (b.Position - a.Position);
    }
    return stops[^1].Weight;
}

for (var row = 0; row <= 422; row++)
{
    var at = row / 422d;
    var weights = Enumerable.Range(0, SheetBlurProfile.Levels.Length)
        .Select(index => Weight(SheetBlurProfile.Stops(index), at)).ToArray();
    if (weights.Any(weight => weight < 0 || weight > 1)) throw new Exception("Отрицательный вес Gaussian");
    Equal(weights.Sum(), 1, "partition of unity");
    double average = 0;
    for (var index = 0; index < weights.Length; index++) average += weights[index] * SheetBlurProfile.Levels[index];
    Equal(average, at, "profile radius grows toward body");
}
Equal(Weight(SheetBlurProfile.Stops(0), 0.5), 0, "middle does not retain sharp source");
Console.WriteLine("Sheet geometry/profile: PASS (authored Half, resize, invalid inputs, spatial weights)");

// Независимые authored anchors: сохранены все восемь Gaussian levels и их stops.
float[] expectedLevels = [0, 0.015625f, 0.03125f, 0.0625f, 0.125f, 0.25f, 0.5f, 1];
(float, float)[][] expectedStops =
[
    [(0, 1), (0.015625f, 0), (1, 0)],
    [(0, 0), (0.015625f, 1), (0.03125f, 0), (1, 0)],
    [(0, 0), (0.015625f, 0), (0.03125f, 1), (0.0625f, 0), (1, 0)],
    [(0, 0), (0.03125f, 0), (0.0625f, 1), (0.125f, 0), (1, 0)],
    [(0, 0), (0.0625f, 0), (0.125f, 1), (0.25f, 0), (1, 0)],
    [(0, 0), (0.125f, 0), (0.25f, 1), (0.5f, 0), (1, 0)],
    [(0, 0), (0.25f, 0), (0.5f, 1), (1, 0)],
    [(0, 0), (0.5f, 0), (1, 1)],
];
if (!SheetBlurProfile.Levels.SequenceEqual(expectedLevels)) throw new Exception("Authored blur level changed");
for (var index = 0; index < expectedStops.Length; index++)
    if (!SheetBlurProfile.Stops(index).SequenceEqual(expectedStops[index])) throw new Exception($"Authored stops changed at {index}");

// Только managed geometry/math. Ни WinUI/Win2D references, ни GUI/OS вызовов.
static void Near(double actual, double expected, double tolerance, string name)
{
    if (!double.IsFinite(actual) || Math.Abs(actual - expected) > tolerance)
        throw new Exception($"{name}: {actual} != {expected}, tolerance {tolerance}");
}

Equal(SheetAtlasLayout.PaddingPixels, 2, "transparent padding for linear sampling");

// Pinned SurfaceBrush default: Uniform, centered. Authored fractions distinguish
// this projection from independent Fill ratios, without a native API dependency.
var uniformAnchor = SheetAtlasLayout.Create(470, 937, new(375.25f, 749.5f), 1.25, 13);
Near(uniformAnchor.BrushScale.X, 1501d / 1880, 1e-7, "authored Uniform X scale");
Near(uniformAnchor.BrushScale.Y, 1501d / 1880, 1e-7, "authored Uniform Y scale");
Near(uniformAnchor.BrushOffset.X, 0, 1e-7, "authored Uniform X offset");
Near(uniformAnchor.BrushOffset.Y, 2623d / 3760, 1e-7, "authored Uniform Y offset");

static void Atlas(int pixelWidth, int pixelHeight, Vector2 visualSize, double scale)
{
    var layout = SheetAtlasLayout.Create(pixelWidth, pixelHeight, visualSize, scale, 13);
    Equal(layout.CellCount, 13, "eight masks plus five existing raster layers");
    Equal(layout.PixelWidth, pixelWidth, "original update width");
    Equal(layout.PixelHeight, pixelHeight, "original update height");
    if (layout.Width > 16777216 || layout.Height > 16777216)
        throw new Exception("Virtual surface intrinsic extent exceeded");
    if (layout.Width != pixelWidth && layout.Height != pixelHeight)
        throw new Exception("Packing added exterior padding to both original axes");
    Equal(Math.Max(layout.Width, layout.Height),
        Math.Max(Math.Max(pixelWidth, pixelHeight), 13 * (Math.Min(pixelWidth, pixelHeight) + 4)),
        "strip fits the original checked noise-array domain");

    var q = Math.Min((double)visualSize.X / pixelWidth, (double)visualSize.Y / pixelHeight);
    var offsetX = (visualSize.X - pixelWidth * q) / 2;
    var offsetY = (visualSize.Y - pixelHeight * q) / 2;
    const double floatUnit = 1d / 8388608;
    Near(layout.BrushScale.X, q, 2 * floatUnit * q, "uniform X projection");
    Near(layout.BrushScale.Y, q, 2 * floatUnit * q, "uniform Y projection");
    Equal(layout.BrushScale.X, layout.BrushScale.Y, "aspect ratio preserved");
    Near(layout.BrushOffset.X, offsetX, 2 * floatUnit * visualSize.X, "centered X letterbox");
    Near(layout.BrushOffset.Y, offsetY, 2 * floatUnit * visualSize.Y, "centered Y letterbox");

    var cells = Enumerable.Range(0, 13).Select(layout.Cell).ToArray();
    var stackAlongX = cells[1].PixelX != cells[0].PixelX;
    if (pixelWidth == 1 && pixelHeight == 1)
        Equal(stackAlongX ? visualSize.X : visualSize.Y, Math.Min(visualSize.X, visualSize.Y),
            "one-pixel strip uses the Uniform fit axis");

    for (var index = 0; index < cells.Length; index++)
    {
        var cell = cells[index];
        if (cell.PixelX < 0 || cell.PixelY < 0
            || cell.PixelX + pixelWidth > layout.Width || cell.PixelY + pixelHeight > layout.Height)
            throw new Exception("Original updateRect outside virtual surface");
        if (stackAlongX)
        {
            Equal(cell.PixelY, 0, "no exterior padding on Y");
            if (cell.PixelX < 2 || cell.PixelX + pixelWidth + 2 > layout.Width)
                throw new Exception("X gutters outside virtual surface");
        }
        else
        {
            Equal(cell.PixelX, 0, "no exterior padding on X");
            if (cell.PixelY < 2 || cell.PixelY + pixelHeight + 2 > layout.Height)
                throw new Exception("Y gutters outside virtual surface");
        }
        for (var other = index + 1; other < cells.Length; other++)
        {
            var next = cells[other];
            var separated = cell.PixelX + pixelWidth + 4 <= next.PixelX || next.PixelX + pixelWidth + 4 <= cell.PixelX
                || cell.PixelY + pixelHeight + 4 <= next.PixelY || next.PixelY + pixelHeight + 4 <= cell.PixelY;
            if (!separated) throw new Exception("Cell updateRects overlap their transparent gutters");
        }

        // Float matrix error bounds qualify this managed projection only.
        // BeginDraw offsets, native clipping and filtering are not simulated.
        var toleranceX = 4 * floatUnit * Math.Max(1, (cell.PixelX + pixelWidth) * q + Math.Abs(offsetX));
        var toleranceY = 4 * floatUnit * Math.Max(1, (cell.PixelY + pixelHeight) * q + Math.Abs(offsetY));
        foreach (var (x, y) in new[]
        {
            (0.5, 0.5), (pixelWidth / 2d, pixelHeight / 2d),
            (pixelWidth - 0.5, pixelHeight - 0.5),
        })
        {
            var atlasPoint = new Vector2(
                (float)((cell.PixelX + x) * layout.BrushScale.X + layout.BrushOffset.X),
                (float)((cell.PixelY + y) * layout.BrushScale.Y + layout.BrushOffset.Y));
            var projected = Vector2.Transform(atlasPoint, cell.EffectTransform);
            Near(projected.X, x * q + offsetX, toleranceX, "cell-local Uniform X projection");
            Near(projected.Y, y * q + offsetY, toleranceY, "cell-local Uniform Y projection");
        }

        // Across the whole viewport, a linear half-pixel footprint on the strip
        // axis stays in this cell or its gutters, including tiny letterboxes.
        var origin = stackAlongX ? cell.PixelX : cell.PixelY;
        var extent = stackAlongX ? pixelWidth : pixelHeight;
        var visual = stackAlongX ? visualSize.X : visualSize.Y;
        var brushScale = stackAlongX ? layout.BrushScale.X : layout.BrushScale.Y;
        var brushOffset = stackAlongX ? layout.BrushOffset.X : layout.BrushOffset.Y;
        var translation = stackAlongX ? cell.EffectTransform.M31 : cell.EffectTransform.M32;
        var minimumSample = (-brushOffset - (double)translation) / brushScale;
        var maximumSample = (visual - (double)brushOffset - translation) / brushScale;
        var samplingTolerance = 8 * floatUnit * Math.Max(1, origin + extent);
        if (minimumSample - 0.5 < origin - 2 - samplingTolerance
            || maximumSample + 0.5 > origin + extent + 2 + samplingTolerance)
            throw new Exception("Viewport sampling can reach a neighboring cell");
    }
    Invalid(() => layout.Cell(-1));
    Invalid(() => layout.Cell(13));
}

var sizes = new[]
{
    (375d, 812d, 1d), (375d, 812d, 1.25d), (375.25d, 749.5d, 1.25d),
    (375.3d, 812.2d, 1.5d), (500.2d, 96.4d, 1.75d), (1920d, 1080d, 2d),
    (7680d, 4320d, 2d), (7680d, 4320d, 3d),
    (1d, 64d, 1d), (64d, 1d, 1d), (0.000001d, 64d, 1d), (64d, 0.000001d, 1d),
    (1d, 64.125d, 1d), (64.125d, 1d, 1d), (0.000001d, 1.1d, 1d), (1.1d, 0.000001d, 1d),
    (1d, 1d, 1d), (0.75d, 0.125d, 1d), (0.125d, 0.75d, 1d),
    (0.99999d, 0.99999d, 1d), (1e-20d, 0.8d, 1d), (0.8d, 1e-20d, 1d),
    (0.5d, 0.25d, 2d), (0.25d, 0.5d, 2d),
    (4096d, 4096d, 1d), (6016d, 3384d, 1d), (3384d, 6016d, 1d),
    (16384d, 16384d, 1d), (23170d, 23170d, 1d),
    (16777216d, 31d, 1d), (31d, 16777216d, 1d),
    (16777216d, 1d, 1d), (1d, 16777216d, 1d),
};
foreach (var (width, height, scale) in sizes)
{
    var pixelWidth = checked((int)Math.Ceiling(width * scale));
    var pixelHeight = checked((int)Math.Ceiling(height * scale));
    Atlas(pixelWidth, pixelHeight, new((float)width, (float)height), scale);
}

var large = SheetAtlasLayout.Create(4096, 4096, new(4096, 4096), 1, 13);
Equal(large.Width, 4096, "original 4096-pixel long axis retained");
Equal(large.Height, 53300, "virtual strip is not capped by the 16384-pixel dense extent");
var elongated = SheetAtlasLayout.Create(16777216, 31, new(16777216, 31), 1, 13);
Equal(elongated.Width, 16777216, "intrinsic long-axis boundary has no added padding");
Equal(elongated.Height, 455, "only the short axis is padded and packed");

foreach (var invalid in new[] { 0, -1, 16777217, int.MaxValue })
{
    Invalid(() => SheetAtlasLayout.Create(invalid, 1, new(1, 1), 1, 13));
    Invalid(() => SheetAtlasLayout.Create(1, invalid, new(1, 1), 1, 13));
}
foreach (var invalid in new[] { float.NaN, float.PositiveInfinity, float.NegativeInfinity, 0, -1 })
{
    Invalid(() => SheetAtlasLayout.Create(375, 812, new(invalid, 812), 1, 13));
    Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, invalid), 1, 13));
}
foreach (var invalid in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity, 0, -1, 1e-200, 1e-40, double.MaxValue })
    Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), invalid, 13));
Invalid(() => SheetAtlasLayout.Create(16777216, 1, new(float.Epsilon, 1), 1, 13));
Invalid(() => SheetAtlasLayout.Create(1, 1, new(float.MaxValue, float.MaxValue), 1, 13));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1, 0));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1, -1));
Invalid(() => SheetAtlasLayout.Create(1, 1, new(1, 1), 1, 3355444));

static void Overflow(Action action)
{
    try { action(); }
    catch (OverflowException) { return; }
    throw new Exception("Original checked noise/strip overflow was accepted");
}
Overflow(() => SheetAtlasLayout.Create(23171, 23171, new(23171, 23171), 1, 13));
Overflow(() => SheetAtlasLayout.Create(16777216, 32, new(16777216, 32), 1, 13));
Overflow(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1, int.MaxValue));
Console.WriteLine($"Sheet virtual atlas INERT managed geometry: PASS ({sizes.Length} size/DPI cases, authored Uniform, original domain, gutters, malformed inputs)");
