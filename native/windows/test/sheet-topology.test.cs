using System.Collections;
using System.Text.Json;
using LabUI.Buttons;
using LabUI.WinUI.Rendering;

const string Marker = "PRIVATE_TEXT_NOT_FOR_JOB_LOG";
const int BuildFailure = -2147024809;
const int FactoryFailure = -2147467259;
const int CleanupFailure = -2147024891;

void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}
Exception? FailureFrom(Action operation)
{
    try { operation(); return null; }
    catch (Exception error) { return error; }
}
void PrivateTextAbsent(object? value)
    => Check(!JsonSerializer.Serialize(value).Contains(Marker, StringComparison.Ordinal),
        "Проектор опубликовал произвольный текст.");

var healthy = new object();
var diagnosisCalls = 0;
var returned = SheetFactorySampling.PreservePrimary(() => healthy, _ => diagnosisCalls++);
Check(ReferenceEquals(returned, healthy) && diagnosisCalls == 0,
    "Успешная операция потеряла результат либо запустила диагностику.");

foreach (var diagnosisFails in new[] { false, true })
{
    var primary = new TestFailure(BuildFailure, Marker);
    var unrelated = new object();
    primary.Data["unrelated"] = unrelated;
    diagnosisCalls = 0;
    Exception? diagnosed = null;
    var retained = FailureFrom(() => SheetFactorySampling.PreservePrimary<object>(
        () => throw primary, error =>
        {
            diagnosisCalls++;
            diagnosed = error;
            if (diagnosisFails) throw new TestFailure(FactoryFailure, Marker);
            error.Data["diagnostic"] = 42;
        }));
    Check(ReferenceEquals(retained, primary) && ReferenceEquals(diagnosed, primary) && primary.HResult == BuildFailure
        && ReferenceEquals(primary.Data["unrelated"], unrelated) && diagnosisCalls == 1,
        "Диагностика заменила исходную ошибку, HRESULT либо чужие Data.");
}
var unavailable = new UnavailableDataException(BuildFailure);
var unavailableRetained = FailureFrom(() => SheetFactorySampling.PreservePrimary<object>(
    () => throw unavailable, error => error.Data["diagnostic"] = 42));
Check(ReferenceEquals(unavailableRetained, unavailable) && unavailableRetained?.HResult == BuildFailure
    && SheetSourceTopology.Read(unavailableRetained) is null,
    "Недоступные Data заменили исходный отказ.");

// Непрозрачные значения и обычные IDisposable callbacks: Native API здесь нет.
List<string> released = [];
var borrowed = new CallbackResource(() => released.Add("borrowed"));
var factoryCalls = 0;
var outcome = SheetFactorySampling.Capture(register =>
{
    Check(register(new CallbackResource(() => released.Add("first"))) == 1, "Первая регистрация потеряна.");
    Check(register(new CallbackResource(() => released.Add("second"))) == 2, "Порядок регистрации потерян.");
    Check(register(new CallbackResource(() => released.Add("third"))) == 3, "Ordinal не принадлежит owned list.");
    return borrowed;
}, input =>
{
    factoryCalls++;
    Check(ReferenceEquals(input, borrowed), "Factory получила другой вход.");
    return new CallbackResource(() => released.Add("factory"));
});
Check(outcome.Stage == SheetFactoryStage.Factory && outcome.HResult == 0 && outcome.CleanupHResult is null
    && factoryCalls == 1 && released.SequenceEqual(new[] { "factory", "third", "second", "first" }),
    "Успех потерял factory-first/reverse cleanup либо освободил borrowed вход.");

foreach (var cleanupFails in new[] { false, true })
{
    released.Clear();
    factoryCalls = 0;
    var partial = SheetFactorySampling.Capture<object>(register =>
    {
        register(new CallbackResource(() => released.Add("first")));
        register(new CallbackResource(() =>
        {
            released.Add("second");
            if (cleanupFails) throw new TestFailure(CleanupFailure, Marker);
        }));
        throw new TestFailure(BuildFailure, Marker);
    }, _ =>
    {
        factoryCalls++;
        return new CallbackResource(() => released.Add("factory"));
    });
    Check(partial.Stage == SheetFactoryStage.Build && partial.HResult == BuildFailure && factoryCalls == 0
        && partial.CleanupHResult == (cleanupFails ? CleanupFailure : null)
        && released.SequenceEqual(new[] { "second", "first" }),
        "Частичный build дошёл до factory либо потерял исходный HRESULT/cleanup.");
}

released.Clear();
var factoryFailure = SheetFactorySampling.Capture(register =>
{
    register(new CallbackResource(() => released.Add("first")));
    register(new CallbackResource(() =>
    {
        released.Add("second");
        throw new TestFailure(CleanupFailure, Marker);
    }));
    return healthy;
}, _ => throw new TestFailure(FactoryFailure, Marker));
Check(factoryFailure.Stage == SheetFactoryStage.Factory && factoryFailure.HResult == FactoryFailure
    && factoryFailure.CleanupHResult == CleanupFailure && released.SequenceEqual(new[] { "second", "first" }),
    "Отказ factory выдан за build либо cleanup заменил исходный HRESULT.");

released.Clear();
var cleanupFailure = SheetFactorySampling.Capture(register =>
{
    register(new CallbackResource(() =>
    {
        released.Add("first");
        throw new TestFailure(BuildFailure, Marker);
    }));
    register(new CallbackResource(() =>
    {
        released.Add("second");
        throw new TestFailure(FactoryFailure, Marker);
    }));
    return healthy;
}, _ => new CallbackResource(() =>
{
    released.Add("factory");
    throw new TestFailure(CleanupFailure, Marker);
}));
Check(cleanupFailure.Stage == SheetFactoryStage.Factory && cleanupFailure.HResult == 0
    && cleanupFailure.CleanupHResult == CleanupFailure
    && released.SequenceEqual(new[] { "factory", "second", "first" }),
    "Первый cleanup HRESULT потерян либо отказ прервал остальные освобождения.");

var nullFactory = SheetFactorySampling.Capture(_ => healthy, _ => null!);
Check(nullFactory.Stage == SheetFactoryStage.Factory
    && nullFactory.HResult == new InvalidOperationException().HResult,
    "Null factory выдана за успешный ресурс.");
factoryCalls = 0;
var nullRegistration = SheetFactorySampling.Capture<object>(register =>
{
    register(null!);
    return healthy;
}, _ =>
{
    factoryCalls++;
    return borrowed;
});
Check(nullRegistration.Stage == SheetFactoryStage.Build && nullRegistration.HResult != 0 && factoryCalls == 0,
    "Null owned ресурс допущен до factory.");

float[] expectedLevels = [0, 1f / 64, 1f / 32, 1f / 16, 1f / 8, 1f / 4, 1f / 2, 1];
Check(SheetBlurProfile.Levels.SequenceEqual(expectedLevels), "Восемь sigma уровней потеряли линейный диапазон.");
float Weight((float Position, float Weight)[] stops, float position)
{
    for (var index = 1; index < stops.Length; index++)
    {
        if (position > stops[index].Position) continue;
        var left = stops[index - 1];
        var right = stops[index];
        var fraction = (position - left.Position) / (right.Position - left.Position);
        return left.Weight + (right.Weight - left.Weight) * fraction;
    }
    return stops[^1].Weight;
}
for (var sample = 0; sample <= 128; sample++)
{
    var position = sample / 128f;
    var totalWeight = 0f;
    var totalSigma = 0f;
    for (var level = 0; level < expectedLevels.Length; level++)
    {
        var stops = SheetBlurProfile.Stops(level);
        Check(stops[0].Position == 0 && stops[^1].Position == 1
            && stops.Zip(stops.Skip(1)).All(pair => pair.First.Position < pair.Second.Position),
            "Профиль маски потерял упорядоченные границы.");
        var weight = Weight(stops, position);
        Check(weight >= 0 && weight <= 1, "Вес маски вышел за допустимый диапазон.");
        totalWeight += weight;
        totalSigma += weight * expectedLevels[level];
    }
    Check(MathF.Abs(totalWeight - 1) < 0.000001f && MathF.Abs(totalSigma - position) < 0.000001f,
        "Веса масок не сохраняют единицу или линейный sigma профиль.");
}
Check(FailureFrom(() => SheetBlurProfile.Stops(-1)) is ArgumentOutOfRangeException
    && FailureFrom(() => SheetBlurProfile.Stops(8)) is ArgumentOutOfRangeException,
    "Недопустимый уровень маски принят.");

Dictionary<string, object?> Row(int index) => new()
{
    ["index"] = index, ["inputs"] = 2, ["combine"] = "Add", ["source"] = "repeat",
    ["named"] = false, ["blur"] = true, ["mask"] = true,
    ["hresult"] = BuildFailure, ["cleanupHresult"] = null,
};
Exception WithData(string key, object? value)
{
    var error = new TestFailure(BuildFailure, Marker);
    error.Data[key] = value;
    return error;
}
var twenty = Enumerable.Range(0, 20).Select(Row).ToArray();
var wireRows = SheetSourceTopology.Read(new AggregateException(WithData(SheetSourceTopology.DataKey, twenty)));
Check(wireRows is { Length: 20 } && wireRows.Select(row => row["index"]).SequenceEqual(Enumerable.Range(0, 20).Cast<object>()),
    "Настоящий проектор потерял порядок двадцати строк.");
PrivateTextAbsent(wireRows);
Check(SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, twenty.Append(Row(20)).ToArray())) is null
    && SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new object?[] { Row(0), null })) is null,
    "Oversized/malformed topology скрыта усечением.");

foreach (var raw in new object?[] { int.MinValue, 0, int.MaxValue, null, (long)int.MaxValue + 1, -2147024809L, -1d, "-1", Marker })
{
    var row = Row(0);
    row["hresult"] = row["cleanupHresult"] = raw;
    var rows = SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { row }))!;
    Check(Equals(rows[0]["hresult"], raw is int ? raw : null)
        && Equals(rows[0]["cleanupHresult"], raw is int ? raw : null), "HRESULT не ограничен signed-int32/null.");
    PrivateTextAbsent(rows);
}
foreach (var stage in new object?[] { "build", "factory", null, "Factory", Marker, 42 })
{
    var row = Row(0);
    row["stage"] = stage;
    var rows = SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { row }))!;
    Check(rows[0].ContainsKey("stage") && Equals(rows[0]["stage"], stage is "build" or "factory" ? stage : null),
        "Stage вышла за закрытый набор.");
    PrivateTextAbsent(rows);
}
var legacy = SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { Row(0) }))!;
Check(!legacy[0].ContainsKey("stage") && !legacy[0].ContainsKey("sigmas") && !legacy[0].ContainsKey("levelStart"),
    "Legacy row получила придуманную стадию/sigma.");
var foreignRow = Row(20);
foreignRow["inputs"] = 9;
foreignRow["combine"] = foreignRow["source"] = foreignRow["named"] = foreignRow["message"] = Marker;
var foreignRows = SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { foreignRow }))!;
Check(foreignRows[0]["index"] is null && foreignRows[0]["inputs"] is null && foreignRows[0]["combine"] is null
    && foreignRows[0]["source"] is null && foreignRows[0]["named"] is null && !foreignRows[0].ContainsKey("message"),
    "Неизвестные поля и текст прошли настоящий проектор.");
PrivateTextAbsent(foreignRows);

foreach (var raw in new object?[] { null, Array.Empty<float>(), new float[] { 1, 2, 3 }, new float[] { -1 },
    new float[] { float.NaN }, new float[] { float.PositiveInfinity }, new double[] { 12 }, Marker })
{
    var row = Row(16);
    row["sigmas"] = raw;
    row["levelStart"] = 8;
    var rows = SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { row }))!;
    Check(rows[0]["sigmas"] is null && rows[0]["levelStart"] is null && rows[0]["hresult"] is BuildFailure,
        "Неизвестные sigma/уровень прошли либо потерян HRESULT.");
    PrivateTextAbsent(rows);
}
var rawSigmas = new float[] { 6, 12 };
var sigmaRow = Row(18);
sigmaRow["sigmas"] = rawSigmas;
sigmaRow["levelStart"] = 6;
var copiedSigma = SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { sigmaRow }))!;
rawSigmas[0] = 99;
Check(copiedSigma[0]["sigmas"] is float[] copied && copied.SequenceEqual(new float[] { 6, 12 })
    && copiedSigma[0]["levelStart"] is 6, "Проектор сохранил изменяемый sigma alias.");
sigmaRow["sigmas"] = new float[] { 0, float.MaxValue };
Check(SheetSourceTopology.Read(WithData(SheetSourceTopology.DataKey, new[] { sigmaRow }))![0]["sigmas"] is float[],
    "Finite float32 границы ошибочно отвергнуты.");

foreach (var key in new[] { SheetSourceTopology.BranchesDataKey, SheetSourceTopology.SigmaDataKey })
{
    Dictionary<string, object?> PairRow(object? hresult, object? cleanup) => new()
        { ["hresult"] = hresult, ["cleanupHresult"] = cleanup };
    Dictionary<string, object?>[]? ReadPair(object? data)
    {
        var error = new AggregateException(WithData(key, data));
        return key == SheetSourceTopology.BranchesDataKey ? SheetSourceTopology.ReadBranches(error) : SheetSourceTopology.ReadSigma(error);
    }
    var pair = new[] { PairRow(int.MinValue, null), PairRow(0, int.MaxValue) };
    var pairCopy = ReadPair(pair);
    pair[0]["hresult"] = 99;
    Check(pairCopy is { Length: 2 } && pairCopy[0]["hresult"] is int.MinValue && pairCopy[1]["cleanupHresult"] is int.MaxValue,
        "Matched pair потеряла signed-int32/null либо сохранила row alias.");
    foreach (var invalid in new object?[] { null, new[] { PairRow(0, null) },
        new[] { PairRow(0, null), PairRow(0, null), PairRow(0, null) },
        new[] { PairRow(0L, null), PairRow(0, null) },
        new[] { PairRow(0, Marker), PairRow(0, null) },
        new[] { new Dictionary<string, object?> { ["hresult"] = 0, ["cleanupHresult"] = null, ["message"] = Marker }, PairRow(0, null) } })
        Check(ReadPair(invalid) is null, "Pair projector принял чужую форму либо произвольный текст.");
    PrivateTextAbsent(pairCopy);
}
Check(SheetSourceTopology.Read(null) is null && SheetSourceTopology.Read(new Exception()) is null
    && SheetSourceTopology.ReadBranches(unavailable) is null && SheetSourceTopology.ReadSigma(unavailable) is null,
    "Диагностика появилась без доступных данных.");
Console.WriteLine("Sheet topology: System-only production callbacks, blur profile and actual DTO projectors PASS.");

sealed class CallbackResource(Action release) : IDisposable
{
    public void Dispose() => release();
}
sealed class TestFailure : Exception
{
    internal TestFailure(int hresult, string message) : base(message) => HResult = hresult;
}
sealed class UnavailableDataException : Exception
{
    internal UnavailableDataException(int hresult) => HResult = hresult;
    public override IDictionary Data => throw new InvalidOperationException("Data unavailable.");
}
