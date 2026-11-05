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
foreach (var (width, height, scale) in new[]
{
    (375d, 812d, 1d), (375d, 812d, 1.25d), (375.3d, 812.2d, 1.5d),
    (500.2d, 96.4d, 1.75d), (1d, 64d, 1d), (1920d, 1080d, 2d),
})
{
    var pixelWidth = checked((int)Math.Ceiling(width * scale));
    var pixelHeight = checked((int)Math.Ceiling(height * scale));
    var visualSize = new Vector2((float)width, (float)height);
    var layout = SheetAtlasLayout.Create(pixelWidth, pixelHeight, visualSize, scale, 13, 16384);
    Equal(layout.CellCount, 13, "eight masks plus five existing raster layers");
    Equal(layout.BrushScale.X, visualSize.X / pixelWidth, "same X projection as standalone Fill surface");
    Equal(layout.BrushScale.Y, visualSize.Y / pixelHeight, "same Y projection as standalone Fill surface");
    if (layout.Width > 16384 || layout.Height > 16384) throw new Exception("Device bitmap extent exceeded");

    var cells = Enumerable.Range(0, 13).Select(layout.Cell).ToArray();
    for (var index = 0; index < cells.Length; index++)
    {
        var cell = cells[index];
        if (cell.PixelX < 2 || cell.PixelY < 2 || cell.PixelX + pixelWidth + 2 > layout.Width
            || cell.PixelY + pixelHeight + 2 > layout.Height) throw new Exception("Cell or padding outside bitmap");
        for (var other = index + 1; other < cells.Length; other++)
        {
            var next = cells[other];
            var separated = cell.PixelX + pixelWidth + 4 <= next.PixelX || next.PixelX + pixelWidth + 4 <= cell.PixelX
                || cell.PixelY + pixelHeight + 4 <= next.PixelY || next.PixelY + pixelHeight + 4 <= cell.PixelY;
            if (!separated) throw new Exception("Raster cells do not have independent transparent gutters");
        }

        // Float matrix rounding bound is based on the tested atlas extent, not renderer output.
        var pixelTolerance = 4 * Math.Pow(2, -23) * Math.Max(layout.Width, layout.Height);
        var visualTolerance = pixelTolerance * Math.Max(layout.BrushScale.X, layout.BrushScale.Y);
        foreach (var local in new[] { new Vector2(0.5f, 0.5f), new Vector2(pixelWidth / 2f, pixelHeight / 2f), new Vector2(pixelWidth - 0.5f, pixelHeight - 0.5f) })
        {
            var drawPoint = Vector2.Transform(local / (float)scale, Matrix3x2.CreateTranslation(cell.DrawingOffset));
            Near(drawPoint.X * scale, cell.PixelX + local.X, pixelTolerance, "local drawing X into pixel cell");
            Near(drawPoint.Y * scale, cell.PixelY + local.Y, pixelTolerance, "local drawing Y into pixel cell");
            var atlasPoint = new Vector2((cell.PixelX + local.X) * layout.BrushScale.X, (cell.PixelY + local.Y) * layout.BrushScale.Y);
            var projected = Vector2.Transform(atlasPoint, cell.EffectTransform);
            Near(projected.X, local.X * visualSize.X / pixelWidth, visualTolerance, "effect X extracts the original projected pixel");
            Near(projected.Y, local.Y * visualSize.Y / pixelHeight, visualTolerance, "effect Y extracts the original projected pixel");
            if (cell.PixelX + local.X - 0.5 < cell.PixelX - 2 || cell.PixelX + local.X + 0.5 > cell.PixelX + pixelWidth + 2
                || cell.PixelY + local.Y - 0.5 < cell.PixelY - 2 || cell.PixelY + local.Y + 0.5 > cell.PixelY + pixelHeight + 2)
                throw new Exception("Linear sample footprint reaches another cell");
        }
    }
    Invalid(() => layout.Cell(-1));
    Invalid(() => layout.Cell(13));
}

var constrained = SheetAtlasLayout.Create(1000, 1000, new(1000, 1000), 1, 13, 4096);
Equal(constrained.Width, 4016, "four columns are required by device limit");
Equal(constrained.Height, 4016, "four rows are required by device limit");
Invalid(() => SheetAtlasLayout.Create(1000, 1000, new(1000, 1000), 1, 13, 3000));
Invalid(() => SheetAtlasLayout.Create(0, 812, new(375, 812), 1, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 0, new(375, 812), 1, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(float.NaN, 812), 1, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 0), 1, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 0, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), double.NaN, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1e-200, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), double.MaxValue, 13, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1, 0, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1, int.MaxValue, 16384));
Invalid(() => SheetAtlasLayout.Create(375, 812, new(375, 812), 1, 13, 0));
try { SheetAtlasLayout.Create(int.MaxValue, 812, new(375, 812), 1, 13, 16384); throw new Exception("Stride overflow accepted"); }
catch (OverflowException) { }
Console.WriteLine("Sheet atlas INERT managed geometry: PASS (exact levels/stops, cell isolation, DPI/ceil mapping, checked capacity)");
