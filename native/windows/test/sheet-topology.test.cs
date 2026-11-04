using System.Collections;
using System.Text.Json;
using LabUI.Buttons;
using LabUI.WinUI.Rendering;
using Microsoft.Graphics.Canvas.Effects;
using Microsoft.UI.Composition;

void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

var graph = new AlphaMaskEffect
{
    Source = new CompositionEffectSourceParameter("backdrop"),
    AlphaMask = new CompositionEffectSourceParameter("mask"),
};
var healthy = new Compositor();
var result = SheetSourceTopologyProbe.CreateFactory(healthy, graph, 12);
Check(healthy.Calls == 1 && healthy.Factories.Count == 1 && !result.Disposed,
    "Успешный путь обязан вернуть исходную factory без диагностики.");
result.Dispose();

foreach (var cleanupFault in new[] { false, true })
{
    Fixture.Created = Fixture.Disposed = 0;
    Fixture.CleanupFault = cleanupFault;
    var primary = new ArgumentException(Fixture.Marker);
    primary.Data["unrelated"] = Fixture.Marker;
    var compositor = new Compositor { Primary = primary };
    Exception? failure = null;
    try { SheetSourceTopologyProbe.CreateFactory(compositor, graph, 12); }
    catch (Exception error) { failure = error; }
    Check(ReferenceEquals(primary, failure) && primary.Message == Fixture.Marker &&
        primary.HResult == -2147024809 && (string?)primary.Data["unrelated"] == Fixture.Marker,
        "Probe изменил исходный exception либо посторонние Data.");
    var rows = SheetSourceTopology.Read(failure) ?? throw new InvalidOperationException("Probe не передал матрицу.");
    Check(rows.Length == 15 && compositor.Calls == 16, "Probe не выполнил конечную матрицу.");
    Check(Fixture.Created == Fixture.Disposed && compositor.Factories.All(factory => factory.Disposed),
        "Один cleanup отказ прервал освобождение остальных ресурсов.");
    Check(rows!.Select(row => (int)row["index"]!).SequenceEqual(Enumerable.Range(0, 15)), "Порядок матрицы потерян.");
    Check(rows.All(row => (bool)row["blur"]! || (bool)row["mask"]!), "Случай потерял исследуемую ветвь.");
    Check(rows.Any(row => (int)row["hresult"]! != 0) && rows.Any(row => (int)row["hresult"]! == 0),
        "Диагностика не различает собственный успех и отказ.");
    Check(rows.Any(row => row["cleanupHresult"] is int) == cleanupFault, "Cleanup HRESULT потерян либо придуман.");
    Check(!JsonSerializer.Serialize(rows).Contains(Fixture.Marker, StringComparison.Ordinal),
        "Проектор опубликовал текст исключения.");
    Check(SheetSourceTopology.Read(new AggregateException(primary))?.Length == 15,
        "Cleanup wrapper скрыл диагностику исходного отказа.");
}

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

static class Fixture
{
    internal const string Marker = "PRIVATE_TEXT_NOT_FOR_JOB_LOG";
    internal static int Created;
    internal static int Disposed;
    internal static bool CleanupFault;
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
    public enum CanvasComposite { Add }
}
namespace Microsoft.Graphics.Canvas.Effects
{
    using Windows.Graphics.Effects;
    using Microsoft.Graphics.Canvas;
    public enum EffectBorderMode { Hard }
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
        public CanvasComposite Mode { get; set; }
        public List<IGraphicsEffectSource> Sources { get; } = [];
    }
    public sealed class GaussianBlurEffect : Effect
    {
        public IGraphicsEffectSource? Source { get; set; }
        public float BlurAmount { get; set; }
        public EffectBorderMode BorderMode { get; set; }
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
        public float MultiplyAmount { get; set; }
        public float Source1Amount { get; set; }
        public float Source2Amount { get; set; }
        public float Offset { get; set; }
        public bool ClampOutput { get; set; }
    }
}
namespace Microsoft.UI.Composition
{
    using Windows.Graphics.Effects;
    public sealed class CompositionEffectSourceParameter(string name) : IGraphicsEffectSource
    {
        public string Name { get; } = name;
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
        public CompositionEffectFactory CreateEffectFactory(IGraphicsEffect graph)
        {
            Calls++;
            if (Calls == 1 && Primary is not null) throw Primary;
            if (Primary is not null && Calls % 3 == 0) throw new InvalidOperationException(Fixture.Marker);
            var factory = new CompositionEffectFactory();
            Factories.Add(factory);
            return factory;
        }
    }
}
