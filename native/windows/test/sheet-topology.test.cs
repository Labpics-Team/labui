using System.Collections;
using System.Text.Json;
using LabUI.Buttons;
using LabUI.WinUI.Rendering;
using Microsoft.Graphics.Canvas.Effects;
using Microsoft.UI.Composition;
using Windows.Graphics.Effects;

void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

void CheckGraph(IGraphicsEffect graph, ExpectedGraph expected, ReadOnlySpan<float> blurWidths)
{
    List<IGraphicsEffect> effects = [];
    List<IGraphicsEffectSource> branches = [];
    void ReadSum(IGraphicsEffectSource source)
    {
        if (source is ArithmeticCompositeEffect sum)
        {
            effects.Add(sum);
            Check(sum.MultiplyAmount == 0 && sum.Source1Amount == 1 && sum.Source2Amount == 1
                && sum.Offset == 0 && !sum.ClampOutput, "Arithmetic не является незажатой суммой ветвей.");
            ReadSum(sum.Source1 ?? throw new InvalidOperationException("Сумма потеряла Source1."));
            ReadSum(sum.Source2 ?? throw new InvalidOperationException("Сумма потеряла Source2."));
        }
        else branches.Add(source);
    }

    if (expected.Combine == "Add")
    {
        Check(graph is CompositeEffect, "Подпись Add не соответствует корневому эффекту.");
        var add = (CompositeEffect)graph;
        Check(add.Mode == Microsoft.Graphics.Canvas.CanvasComposite.Add, "Composite потерял Add.");
        effects.Add(add);
        branches.AddRange(add.Sources);
    }
    else
    {
        Check(graph is ArithmeticCompositeEffect, "Подпись Arithmetic не соответствует корневому эффекту.");
        ReadSum(graph);
    }
    Check(branches.Count == expected.Inputs, "Исследуемое число ветвей не соответствует графу.");

    List<CompositionEffectSourceParameter> sources = [];
    for (var index = 0; index < branches.Count; index++)
    {
        var branch = branches[index];
        if (expected.Mask)
        {
            Check(branch is AlphaMaskEffect, "Подпись mask не соответствует ветви.");
            var mask = (AlphaMaskEffect)branch;
            effects.Add(mask);
            Check(mask.AlphaMask is CompositionEffectSourceParameter input && input.Name == $"mask{index}",
                "Маска привязана к чужому имени источника.");
            branch = mask.Source ?? throw new InvalidOperationException("Маска потеряла Source.");
        }
        if (expected.Blur && index > 0)
        {
            Check(branch is GaussianBlurEffect, "Подпись blur не соответствует ветви.");
            var blur = (GaussianBlurEffect)branch;
            effects.Add(blur);
            Check(blur.BlurAmount == blurWidths[index] && blur.BorderMode == EffectBorderMode.Hard,
                "Blur потерял выбранную ширину или границу.");
            branch = blur.Source ?? throw new InvalidOperationException("Blur потерял Source.");
        }
        Check(branch is CompositionEffectSourceParameter, "Ветвь содержит лишний эффект либо потеряла источник.");
        var source = (CompositionEffectSourceParameter)branch;
        var expectedName = expected.Source == "distinct" ? $"backdrop{index}" : "backdrop";
        Check(source.Name == expectedName, "Подпись источников не соответствует их фактическим именам.");
        sources.Add(source);
    }
    var identities = sources.Cast<object>().Distinct(ReferenceEqualityComparer.Instance).Count();
    Check(identities == (expected.Source == "shared" ? 1 : sources.Count),
        "Подпись shared/repeat/distinct не соответствует идентичности источников.");
    Check(expected.Named
        ? effects.All(effect => effect.Name.Length > 0) && effects.Select(effect => effect.Name).Distinct().Count() == effects.Count
        : effects.All(effect => effect.Name.Length == 0), "Подпись named не соответствует именам эффектов.");
}

// Набор различителей задан до исполнения; подпись probe не выбирает ожидаемый граф.
ExpectedGraph[] expectedCases =
[
    new(2, "Arithmetic", "shared"), new(3, "Arithmetic", "shared"),
    new(3, "Arithmetic", "repeat"), new(3, "Arithmetic", "distinct"),
    new(3, "Arithmetic", "shared", true), new(3, "Arithmetic", "distinct", true),
    new(2, "Add", "shared"), new(3, "Add", "shared"),
    new(8, "Add", "shared"), new(8, "Add", "distinct"),
    new(3, "Add", "shared", true), new(8, "Add", "repeat"),
    new(8, "Add", "distinct", true),
    new(8, "Add", "shared", true, false),
    new(8, "Add", "shared", true, true, false),
];
Check(expectedCases[8] with { Source = "repeat" } == expectedCases[11],
    "Matched Add8 отличается от контроля не только идентичностью источников.");

// Ожидаемые ширины независимы от построителя и его Levels; второй вход ловит
// подстановку постоянной sigma, в том числе штатного Win2D значения 3.
(double Sigma, float[] Widths)[] expectedBlurSamples =
[
    (12, [0, 0.1875f, 0.375f, 0.75f, 1.5f, 3, 6, 12]),
    (20, [0, 0.3125f, 0.625f, 1.25f, 2.5f, 5, 10, 20]),
];

var graph = new AlphaMaskEffect
{
    Source = new CompositionEffectSourceParameter("backdrop"),
    AlphaMask = new CompositionEffectSourceParameter("mask"),
};
var healthy = new Compositor();
var result = SheetSourceTopologyProbe.CreateFactory(healthy, graph, 12);
Check(healthy.Calls == 1 && healthy.Factories.Count == 1 && !result.Disposed,
    "Успешный путь обязан вернуть исходную factory без диагностики.");
Check(healthy.Graphs.Count == 1 && ReferenceEquals(healthy.Graphs[0], graph),
    "Успешный путь заменил исходный граф.");
result.Dispose();

foreach (var (sigma, blurWidths) in expectedBlurSamples)
foreach (var cleanupFault in new[] { false, true })
{
    Fixture.Created = Fixture.Disposed = 0;
    Fixture.CleanupFault = cleanupFault;
    var primary = new ArgumentException(Fixture.Marker);
    primary.Data["unrelated"] = Fixture.Marker;
    var compositor = new Compositor { Primary = primary };
    Exception? failure = null;
    try { SheetSourceTopologyProbe.CreateFactory(compositor, graph, sigma); }
    catch (Exception error) { failure = error; }
    Check(ReferenceEquals(primary, failure) && primary.Message == Fixture.Marker &&
        primary.HResult == -2147024809 && (string?)primary.Data["unrelated"] == Fixture.Marker,
        "Probe изменил исходный exception либо посторонние Data.");
    var rows = SheetSourceTopology.Read(failure) ?? throw new InvalidOperationException("Probe не передал матрицу.");
    Check(rows.Length == 15 && compositor.Calls == 16, "Probe не выполнил конечную матрицу.");
    Check(compositor.Graphs.Count == 16 && ReferenceEquals(compositor.Graphs[0], graph),
        "Compositor не получил исходный граф и все диагностические графы.");
    Check(expectedCases.Length == rows.Length, "Обязательный набор различителей изменился.");
    for (var index = 0; index < rows.Length; index++)
    {
        var required = expectedCases[index];
        var row = rows[index];
        Check((int)row["inputs"]! == required.Inputs && (string)row["combine"]! == required.Combine
            && (string)row["source"]! == required.Source && (bool)row["named"]! == required.Named
            && (bool)row["blur"]! == required.Blur && (bool)row["mask"]! == required.Mask,
            $"Попытка {index} не выполнила обязательный различитель.");
        Check((string?)row["stage"] == "factory", "Построенный граф потерял стадию factory.");
        CheckGraph(compositor.Graphs[index + 1], required, blurWidths);
    }
    Check(Fixture.Created == Fixture.Disposed && compositor.Factories.All(factory => factory.Disposed),
        "Один cleanup отказ прервал освобождение остальных ресурсов.");
    Check(rows!.Select(row => (int)row["index"]!).SequenceEqual(Enumerable.Range(0, 15)), "Порядок матрицы потерян.");
    Check(rows.All(row => (bool)row["blur"]! || (bool)row["mask"]!), "Случай потерял исследуемую ветвь.");
    Check(rows.Any(row => (int)row["hresult"]! != 0) && rows.Any(row => (int)row["hresult"]! == 0),
        "Диагностика не различает собственный успех и отказ.");
    Check(rows.Any(row => row["stage"] is "factory" && row["hresult"] is -2147024809),
        "Контроль factory не воспроизвёл тот же HRESULT, что и build failure.");
    Check(rows.Any(row => row["cleanupHresult"] is int) == cleanupFault, "Cleanup HRESULT потерян либо придуман.");
    Check(!JsonSerializer.Serialize(rows).Contains(Fixture.Marker, StringComparison.Ordinal),
        "Проектор опубликовал текст исключения.");
    Check(SheetSourceTopology.Read(new AggregateException(primary))?.Length == 15,
        "Cleanup wrapper скрыл диагностику исходного отказа.");
}

Fixture.Created = Fixture.Disposed = 0;
Fixture.CleanupFault = false;
Fixture.BuildFault = true;
var buildPrimary = new ArgumentException(Fixture.Marker);
var buildCompositor = new Compositor { Primary = buildPrimary };
Exception? buildFailure = null;
try { SheetSourceTopologyProbe.CreateFactory(buildCompositor, graph, 12); }
catch (Exception error) { buildFailure = error; }
finally { Fixture.BuildFault = false; }
var buildRows = SheetSourceTopology.Read(buildFailure)
    ?? throw new InvalidOperationException("Build failure потерял диагностику.");
Check(ReferenceEquals(buildFailure, buildPrimary) && buildCompositor.Calls == 1 && buildRows.Length == 15,
    "Build failure заменил primary либо дошёл до диагностической factory.");
Check(buildRows.All(row => (string?)row["stage"] == "build" && (int)row["hresult"]! == -2147024809),
    "Build HRESULT выдан за известный отказ factory.");
Check(Fixture.Created == Fixture.Disposed, "Build failure потерял освобождение ресурсов.");

foreach (var stage in new object?[] { "build", "factory", null, Fixture.Marker, 42 })
{
    var stageError = new ArgumentException(Fixture.Marker);
    stageError.Data[SheetSourceTopology.DataKey] = new[]
    {
        new Dictionary<string, object?> { ["stage"] = stage, ["hresult"] = -2147024809 },
    };
    var stageRows = SheetSourceTopology.Read(stageError)
        ?? throw new InvalidOperationException("Проектор потерял stage diagnostic.");
    Check(stageRows[0].ContainsKey("stage") && Equals(stageRows[0]["stage"],
        stage is "build" or "factory" ? stage : null), "Stage не ограничена закрытым набором.");
    Check(!JsonSerializer.Serialize(stageRows).Contains(Fixture.Marker, StringComparison.Ordinal),
        "Stage опубликовала произвольный текст.");
}
var legacyError = new ArgumentException(Fixture.Marker);
legacyError.Data[SheetSourceTopology.DataKey] = new[]
{
    new Dictionary<string, object?> { ["hresult"] = -2147024809 },
};
var legacyRows = SheetSourceTopology.Read(legacyError)
    ?? throw new InvalidOperationException("Legacy diagnostic без stage отвергнута.");
Check(!legacyRows[0].ContainsKey("stage") && (int)legacyRows[0]["hresult"]! == -2147024809,
    "Legacy row получила придуманную стадию либо потеряла HRESULT.");

var foreign = new ArgumentException(Fixture.Marker);
foreign.Data[SheetSourceTopology.DataKey] = new[]
{
    new Dictionary<string, object?>
    {
        ["index"] = 20, ["inputs"] = 100, ["combine"] = Fixture.Marker,
        ["source"] = Fixture.Marker, ["named"] = Fixture.Marker,
        ["blur"] = false, ["mask"] = true, ["hresult"] = "-1",
        ["cleanupHresult"] = null, ["message"] = Fixture.Marker,
    },
};
var projected = SheetSourceTopology.Read(foreign);
Check(projected?.Length == 1 && projected[0]["index"] is null && projected[0]["named"] is null &&
    projected[0]["combine"] is null && projected[0]["hresult"] is null &&
    !JsonSerializer.Serialize(projected).Contains(Fixture.Marker, StringComparison.Ordinal),
    "Неизвестные поля прошли wire-проектор.");
foreign.Data[SheetSourceTopology.DataKey] = new Dictionary<string, object?>[16];
Check(SheetSourceTopology.Read(foreign) is null, "Oversized diagnostic скрыт усечением.");
Check(SheetSourceTopology.Read(null) is null && SheetSourceTopology.Read(new Exception()) is null,
    "Диагностика появилась без данных.");

var unavailable = new UnavailableDataException();
var blocked = new Compositor { Primary = unavailable };
Exception? retained = null;
try { SheetSourceTopologyProbe.CreateFactory(blocked, graph, 12); }
catch (Exception error) { retained = error; }
Check(ReferenceEquals(retained, unavailable) && SheetSourceTopology.Read(retained) is null,
    "Отказ доступа к Data заменил исходную ошибку.");
Console.WriteLine("Sheet topology: actual probe/codec, primary preservation, finite cases and independent cleanup PASS; inert types only.");

readonly record struct ExpectedGraph(int Inputs, string Combine, string Source,
    bool Named = false, bool Blur = true, bool Mask = true);

static class Fixture
{
    internal const string Marker = "PRIVATE_TEXT_NOT_FOR_JOB_LOG";
    internal static int Created;
    internal static int Disposed;
    internal static bool CleanupFault;
    internal static bool BuildFault;
}
sealed class UnavailableDataException : Exception
{
    public override IDictionary Data => throw new InvalidOperationException(Fixture.Marker);
}
namespace Windows.Graphics.Effects
{
    public interface IGraphicsEffectSource { }
    public interface IGraphicsEffect : IGraphicsEffectSource { string Name { get; set; } }
}
namespace Microsoft.Graphics.Canvas
{
    public enum CanvasComposite { SourceOver, Add }
}
namespace Microsoft.Graphics.Canvas.Effects
{
    using Windows.Graphics.Effects;
    using Microsoft.Graphics.Canvas;
    public enum EffectBorderMode { Soft, Hard }
    public abstract class Effect : IGraphicsEffect, IDisposable
    {
        protected Effect() => Fixture.Created++;
        public string Name { get; set; } = "";
        public void Dispose()
        {
            Fixture.Disposed++;
            if (Fixture.CleanupFault) throw new InvalidOperationException(Fixture.Marker);
        }
    }
    public sealed class CompositeEffect : Effect
    {
        public CanvasComposite Mode { get; set; } = CanvasComposite.SourceOver;
        public List<IGraphicsEffectSource> Sources { get; } = [];
    }
    public sealed class GaussianBlurEffect : Effect
    {
        public IGraphicsEffectSource? Source { get; set; }
        public float BlurAmount { get; set; } = 3;
        public EffectBorderMode BorderMode { get; set; } = EffectBorderMode.Soft;
    }
    public sealed class AlphaMaskEffect : Effect
    {
        public IGraphicsEffectSource? Source { get; set; }
        public IGraphicsEffectSource? AlphaMask { get; set; }
    }
    public sealed class ArithmeticCompositeEffect : Effect
    {
        public IGraphicsEffectSource? Source1 { get; set; }
        public IGraphicsEffectSource? Source2 { get; set; }
        public float MultiplyAmount { get; set; } = 1;
        public float Source1Amount { get; set; }
        public float Source2Amount { get; set; }
        public float Offset { get; set; }
        public bool ClampOutput { get; set; }
    }
}
namespace Microsoft.UI.Composition
{
    using Windows.Graphics.Effects;
    public sealed class CompositionEffectSourceParameter : IGraphicsEffectSource
    {
        public CompositionEffectSourceParameter(string name)
        {
            if (Fixture.BuildFault) throw new ArgumentException(Fixture.Marker);
            Name = name;
        }
        public string Name { get; }
    }
    public sealed class CompositionEffectFactory : IDisposable
    {
        public bool Disposed { get; private set; }
        public void Dispose()
        {
            Disposed = true;
            if (Fixture.CleanupFault) throw new InvalidOperationException(Fixture.Marker);
        }
    }
    public sealed class Compositor
    {
        internal Exception? Primary;
        public int Calls { get; private set; }
        public List<CompositionEffectFactory> Factories { get; } = [];
        public List<IGraphicsEffect> Graphs { get; } = [];
        public CompositionEffectFactory CreateEffectFactory(IGraphicsEffect graph)
        {
            Graphs.Add(graph);
            Calls++;
            if (Calls == 1 && Primary is not null) throw Primary;
            if (Primary is not null && Calls % 3 == 0) throw new ArgumentException(Fixture.Marker);
            var factory = new CompositionEffectFactory();
            Factories.Add(factory);
            return factory;
        }
    }
}
