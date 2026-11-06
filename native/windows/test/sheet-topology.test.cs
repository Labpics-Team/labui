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

void CheckGraph(IGraphicsEffect graph, ExpectedGraph expected, ReadOnlySpan<float> blurWidths, float bodySigma)
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
    int ReadBalanced(IGraphicsEffectSource source)
    {
        if (source is not CompositeEffect add)
        {
            branches.Add(source);
            return 0;
        }
        effects.Add(add);
        Check(add.Mode == Microsoft.Graphics.Canvas.CanvasComposite.Add && add.Sources.Count == 2,
            "BalancedAdd содержит не бинарный Add.");
        var leftDepth = ReadBalanced(add.Sources[0]);
        var rightDepth = ReadBalanced(add.Sources[1]);
        Check(leftDepth == rightDepth, "BalancedAdd потерял одинаковую глубину поддеревьев.");
        return leftDepth + 1;
    }

    if (expected.Combine == "Add")
    {
        Check(graph is CompositeEffect, "Подпись Add не соответствует корневому эффекту.");
        var add = (CompositeEffect)graph;
        Check(add.Mode == Microsoft.Graphics.Canvas.CanvasComposite.Add, "Composite потерял Add.");
        effects.Add(add);
        branches.AddRange(add.Sources);
    }
    else if (expected.Combine == "BalancedAdd")
    {
        Check(graph is CompositeEffect, "Подпись BalancedAdd не соответствует корневому эффекту.");
        Check(ReadBalanced(graph) == 3 && effects.Count == 7,
            "BalancedAdd не содержит семь бинарных узлов в трёх уровнях.");
    }
    else if (expected.Combine == "Gaussian")
    {
        Check(graph is GaussianBlurEffect, "Подпись Gaussian не соответствует одиночному blur.");
        branches.Add(graph);
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
        var level = expected.LevelStart + index;
        var branch = branches[index];
        if (expected.Mask)
        {
            Check(branch is AlphaMaskEffect, "Подпись mask не соответствует ветви.");
            var mask = (AlphaMaskEffect)branch;
            effects.Add(mask);
            Check(mask.AlphaMask is CompositionEffectSourceParameter input && input.Name == $"mask{level}",
                "Маска привязана к чужому имени источника.");
            branch = mask.Source ?? throw new InvalidOperationException("Маска потеряла Source.");
        }
        if (expected.Blur && (index > 0 || expected.Combine == "Gaussian" || expected.LevelStart > 0))
        {
            Check(branch is GaussianBlurEffect, "Подпись blur не соответствует ветви.");
            var blur = (GaussianBlurEffect)branch;
            effects.Add(blur);
            Check(blur.BlurAmount == (expected.Body ? bodySigma : blurWidths[level]) && blur.BorderMode == EffectBorderMode.Hard,
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
    new(3, "Add", "repeat"), new(8, "Add", "repeat"),
    new(8, "Arithmetic", "repeat"),
    new(8, "Add", "shared", true, false),
    new(8, "Add", "shared", true, true, false),
    new(8, "BalancedAdd", "repeat"),
    new(1, "Gaussian", "repeat", Mask: false, LevelStart: 7),
    new(1, "Gaussian", "repeat", Mask: false, Body: true),
    new(2, "Add", "repeat", LevelStart: 6),
    new(8, "Add", "repeat", Blur: false, Mask: false),
];
Check(expectedCases[8] with { Source = "repeat" } == expectedCases[11],
    "Matched Add8 отличается от контроля не только идентичностью источников.");
Check(expectedCases[2] with { Combine = "Add" } == expectedCases[10],
    "Matched repeat3 отличается от контроля не только оператором суммирования.");
Check(expectedCases[11] with { Combine = "Arithmetic" } == expectedCases[12],
    "Matched repeat8 отличается от контроля не только оператором суммирования.");
Check(expectedCases[11] with { Combine = "BalancedAdd" } == expectedCases[15],
    "Matched BalancedAdd8 отличается от контроля не только формой суммирования.");
Check(expectedCases[11] with { Blur = false, Mask = false } == expectedCases[19],
    "Чистый fan-in отличается от восьмивходового Add не только blur и масками.");

// Ожидаемые ширины независимы от построителя и его Levels; второй вход ловит
// подстановку постоянной sigma, в том числе штатного Win2D значения 3.
(double Sigma, double BodySigma, float[] Widths)[] expectedBlurSamples =
[
    (12, 64, [0, 0.1875f, 0.375f, 0.75f, 1.5f, 3, 6, 12]),
    (20, 48, [0, 0.3125f, 0.625f, 1.25f, 2.5f, 5, 10, 20]),
];

var graph = new AlphaMaskEffect
{
    Source = new CompositionEffectSourceParameter("backdrop"),
    AlphaMask = new CompositionEffectSourceParameter("mask"),
};
var healthy = new Compositor();
var result = SheetSourceTopologyProbe.CreateFactory(healthy, graph, 12, 64);
Check(healthy.Calls == 1 && healthy.Factories.Count == 1 && !result.Disposed,
    "Успешный путь обязан вернуть исходную factory без диагностики.");
Check(healthy.Graphs.Count == 1 && ReferenceEquals(healthy.Graphs[0], graph),
    "Успешный путь заменил исходный граф.");
result.Dispose();

foreach (var (sigma, bodySigma, blurWidths) in expectedBlurSamples)
foreach (var cleanupFault in new[] { false, true })
{
    Fixture.Created = Fixture.Disposed = 0;
    Fixture.CleanupFault = cleanupFault;
    var primary = new ArgumentException(Fixture.Marker);
    primary.Data["unrelated"] = Fixture.Marker;
    var compositor = new Compositor { Primary = primary };
    Exception? failure = null;
    try { SheetSourceTopologyProbe.CreateFactory(compositor, graph, sigma, bodySigma); }
    catch (Exception error) { failure = error; }
    Check(ReferenceEquals(primary, failure) && primary.Message == Fixture.Marker &&
        primary.HResult == -2147024809 && (string?)primary.Data["unrelated"] == Fixture.Marker,
        "Probe изменил исходный exception либо посторонние Data.");
    var rows = SheetSourceTopology.Read(failure) ?? throw new InvalidOperationException("Probe не передал матрицу.");
    Check(rows.Length == 20 && compositor.Calls == 21, "Probe не выполнил конечную матрицу.");
    Check(compositor.Graphs.Count == 21 && ReferenceEquals(compositor.Graphs[0], graph),
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
        CheckGraph(compositor.Graphs[index + 1], required, blurWidths, (float)bodySigma);
        if (required.Inputs == 1 || required.LevelStart > 0)
        {
            float[] sigmas = required.Body ? [(float)bodySigma] :
                blurWidths.Skip(required.LevelStart).Take(required.Inputs).ToArray();
            Check(row["sigmas"] is float[] actual && actual.SequenceEqual(sigmas),
                "Записанные sigma не соответствуют фактическим Gaussian-ветвям.");
            Check(required.Body ? !row.ContainsKey("levelStart") : (int)row["levelStart"]! == required.LevelStart,
                "Body получила Ghost level либо потерян выбранный диапазон Ghost.");
        }
        else Check(!row.ContainsKey("sigmas") && !row.ContainsKey("levelStart"),
            "Прежняя форма diagnostic row изменилась.");
    }
    Check(Fixture.Created == Fixture.Disposed && compositor.Factories.All(factory => factory.Disposed),
        "Один cleanup отказ прервал освобождение остальных ресурсов.");
    Check(rows!.Select(row => (int)row["index"]!).SequenceEqual(Enumerable.Range(0, 20)), "Порядок матрицы потерян.");
    Check(rows.Take(19).All(row => (bool)row["blur"]! || (bool)row["mask"]!),
        "Случай до чистого fan-in потерял исследуемую ветвь.");
    Check(rows.Any(row => (int)row["hresult"]! != 0) && rows.Any(row => (int)row["hresult"]! == 0),
        "Диагностика не различает собственный успех и отказ.");
    Check(rows.Any(row => row["stage"] is "factory" && row["hresult"] is -2147024809),
        "Контроль factory не воспроизвёл тот же HRESULT, что и build failure.");
    Check(rows.Any(row => row["cleanupHresult"] is int) == cleanupFault, "Cleanup HRESULT потерян либо придуман.");
    Check(!JsonSerializer.Serialize(rows).Contains(Fixture.Marker, StringComparison.Ordinal),
        "Проектор опубликовал текст исключения.");
    Check(SheetSourceTopology.Read(new AggregateException(primary))?.Length == 20,
        "Cleanup wrapper скрыл диагностику исходного отказа.");
}

Fixture.Created = Fixture.Disposed = 0;
Fixture.CleanupFault = false;
Fixture.BuildFault = true;
var buildPrimary = new ArgumentException(Fixture.Marker);
var buildCompositor = new Compositor { Primary = buildPrimary };
Exception? buildFailure = null;
try { SheetSourceTopologyProbe.CreateFactory(buildCompositor, graph, 12, 64); }
catch (Exception error) { buildFailure = error; }
finally { Fixture.BuildFault = false; }
var buildRows = SheetSourceTopology.Read(buildFailure)
    ?? throw new InvalidOperationException("Build failure потерял диагностику.");
Check(ReferenceEquals(buildFailure, buildPrimary) && buildCompositor.Calls == 1 && buildRows.Length == 20,
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
foreign.Data[SheetSourceTopology.DataKey] = new Dictionary<string, object?>[21];
Check(SheetSourceTopology.Read(foreign) is null, "Oversized diagnostic скрыт усечением.");
Check(SheetSourceTopology.Read(null) is null && SheetSourceTopology.Read(new Exception()) is null,
    "Диагностика появилась без данных.");

foreach (var sigmas in new object?[] { null, new float[0], new float[] { 1, 2, 3 },
    new float[] { -1 }, new float[] { float.NaN }, new float[] { float.PositiveInfinity },
    new double[] { 12 }, Fixture.Marker })
{
    var sigmaError = new ArgumentException(Fixture.Marker);
    sigmaError.Data[SheetSourceTopology.DataKey] = new[]
    {
        new Dictionary<string, object?> { ["sigmas"] = sigmas, ["levelStart"] = 8, ["hresult"] = -2147024809 },
    };
    var sigmaRows = SheetSourceTopology.Read(sigmaError)
        ?? throw new InvalidOperationException("Проектор потерял bounded sigma diagnostic.");
    Check(sigmaRows[0]["sigmas"] is null && sigmaRows[0]["levelStart"] is null
        && sigmaRows[0]["hresult"] is -2147024809, "Неизвестные sigma/level прошли либо потерян HRESULT.");
    Check(!JsonSerializer.Serialize(sigmaRows).Contains(Fixture.Marker, StringComparison.Ordinal),
        "Sigma diagnostic опубликовала произвольный текст.");
}
var rawSigmas = new float[] { 6, 12 };
var sigmaCopyError = new ArgumentException(Fixture.Marker);
sigmaCopyError.Data[SheetSourceTopology.DataKey] = new[]
{
    new Dictionary<string, object?> { ["sigmas"] = rawSigmas, ["levelStart"] = 6 },
};
var sigmaCopy = SheetSourceTopology.Read(sigmaCopyError)
    ?? throw new InvalidOperationException("Проектор отверг допустимые sigma.");
rawSigmas[0] = 99;
Check(sigmaCopy[0]["sigmas"] is float[] copied && copied.SequenceEqual(new float[] { 6, 12 })
    && sigmaCopy[0]["levelStart"] is 6, "Проектор потерял bounded sigma либо сохранил изменяемый alias.");

var unavailable = new UnavailableDataException();
var blocked = new Compositor { Primary = unavailable };
Exception? retained = null;
try { SheetSourceTopologyProbe.CreateFactory(blocked, graph, 12, 64); }
catch (Exception error) { retained = error; }
Check(ReferenceEquals(retained, unavailable) && SheetSourceTopology.Read(retained) is null,
    "Отказ доступа к Data заменил исходную ошибку.");
Console.WriteLine("Sheet topology: actual probe/codec, primary preservation, finite cases and independent cleanup PASS; inert types only.");

readonly record struct ExpectedGraph(int Inputs, string Combine, string Source,
    bool Named = false, bool Blur = true, bool Mask = true, int LevelStart = 0, bool Body = false);

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
