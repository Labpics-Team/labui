using LabUI.WinUI;
using LabUI.WinUI.Rendering;

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
