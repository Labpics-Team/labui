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

// Высоты наблюдаются в макете независимо от алгоритма и generated tokens.
foreach (var (state, top, body, ghost, content) in new[]
{
    (LabSheetState.Full, 36d, 776d, 68d, 712d),
    (LabSheetState.TwoThirds, 272d, 540d, 304d, 476d),
    (LabSheetState.Half, 390d, 422d, 422d, 358d),
    (LabSheetState.OneThird, 542d, 270d, 574d, 206d),
    (LabSheetState.Flex, 772d, 40d, 804d, 0d),
})
{
    var metrics = SheetMetrics.Create(375, 812, state);
    Equal(metrics.BodyTop, top, $"{state}: body top");
    Equal(metrics.BodyHeight, body, $"{state}: body height");
    Equal(metrics.GhostHeight, ghost, $"{state}: ghost height");
    Equal(metrics.ContentHeight, content, $"{state}: content height");
}
Equal(SheetMetrics.Create(375, 1200, LabSheetState.Full).BodyHeight, 776, "Full stays fixed when taller");
Equal(SheetMetrics.Create(375, 1200, LabSheetState.TwoThirds).BodyHeight, 540, "TwoThirds stays fixed when taller");
Equal(SheetMetrics.Create(375, 1200, LabSheetState.OneThird).BodyHeight, 270, "OneThird stays fixed when taller");
Equal(SheetMetrics.Create(375, 1200, LabSheetState.Half).BodyHeight, 616, "Half shares available height");
var flex = SheetMetrics.Create(375, 812, LabSheetState.Flex, contentHeight: 100, hasContent: true);
Equal(flex.BodyHeight, 164, "Flex hugs content plus anatomy");
Equal(flex.ContentHeight, 100, "Flex preserves desired content height");
Equal(flex.ContentTop, 696, "Flex content keeps 24px gap");
Equal(SheetMetrics.Create(375, 812, LabSheetState.Flex, contentHeight: 100).BodyHeight, 40,
    "Removed content leaves only drag area and bottom inset");
Equal(SheetMetrics.Create(375, 400, LabSheetState.Full).BodyTop, 0, "Full clamps at viewport top");
var scaledHalf = SheetMetrics.Create(375, 812, LabSheetState.Half, geometryScale: 2);
Equal(scaledHalf.BodyTop, 374, "Half scales overlap without scaling viewport");
Equal(scaledHalf.BodyHeight, 438, "Half scales shared overlap");
Equal(scaledHalf.ContentHeight, 310, "Half scales anatomy");
Equal(SheetMetrics.Create(375, 812, LabSheetState.Full, geometryScale: .5).BodyHeight, 388,
    "Full scales fixed height");
var scaledFlex = SheetMetrics.Create(375, 812, LabSheetState.Flex, contentHeight: 100, hasContent: true, geometryScale: 2);
Equal(scaledFlex.BodyHeight, 228, "Flex scales shell around measured content");
Equal(scaledFlex.ContentHeight, 100, "Measured content is not scaled twice");

foreach (var state in Enum.GetValues<LabSheetState>())
foreach (var height in new[] { 16d, 32d, 40d, 64d, 96d, 812d, 1200d })
foreach (var scale in new[] { .5, 1d, 1.5, 2d })
{
    var metrics = SheetMetrics.Create(250, height, state, contentHeight: 3000, hasContent: true, geometryScale: scale);
    Equal(metrics.BodyTop + metrics.BodyHeight, height, $"{state}: bottom alignment");
    if (metrics.BodyTop < 0 || metrics.BodyHeight > height || metrics.GhostHeight > height
        || metrics.ContentHeight < 0 || metrics.ContentTop > height)
        throw new Exception($"{state}: геометрия выходит из viewport при scale={scale}");
}
Invalid(() => SheetMetrics.Create(375, 812, (LabSheetState)99));
foreach (var invalid in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity, 0, -1, double.MaxValue, (double)float.MaxValue })
    Invalid(() => SheetMetrics.Create(375, 812, LabSheetState.Full, geometryScale: invalid));
foreach (var invalid in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity, -1 })
    Invalid(() => SheetMetrics.Create(375, 812, LabSheetState.Flex, contentHeight: invalid));

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
Console.WriteLine("Sheet geometry/profile: PASS (five authored states, Flex, scale, resize, invalid inputs, spatial weights)");
