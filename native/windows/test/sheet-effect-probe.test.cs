using LabUI.WinUI.Rendering;
using Microsoft.UI.Composition;
using System.Text.Json;
using Windows.Graphics.Effects;

void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

var graph = new PrivateEffect();
var healthyFactory = new CompositionEffectFactory();
var healthyCalls = 0;
var healthy = new Compositor(effect =>
{
    healthyCalls++;
    Check(ReferenceEquals(effect, graph), "Изменён основной граф.");
    return healthyFactory;
});
Check(ReferenceEquals(SheetEffectProbe.CreateFactory(healthy, graph, [new ColorSourceEffect()]), healthyFactory),
    "Healthy factory заменён.");
Check(healthyCalls == 1 && !healthyFactory.Disposed, "Healthy путь запустил опыт или освободил factory.");
Console.WriteLine("PASS: healthy factory не изменён");

const string privateMarker = "PRIVATE_PROBE_EXCEPTION_MESSAGE";
var primary = new ArgumentException(privateMarker);
var badEffect = new AlphaMaskEffect();
var cleanupEffect = new OpacityEffect();
var released = new List<CompositionEffectFactory>();
var failing = new Compositor(effect =>
{
    if (ReferenceEquals(effect, graph)) throw primary;
    if (ReferenceEquals(effect, badEffect)) throw new ArgumentException(privateMarker);
    var factory = new CompositionEffectFactory(ReferenceEquals(effect, cleanupEffect)
        ? new IOException(privateMarker) : null);
    released.Add(factory);
    return factory;
});
try
{
    SheetEffectProbe.CreateFactory(failing, graph, [new ColorSourceEffect(), badEffect, cleanupEffect]);
    throw new Exception("Первичный отказ превращён в успех.");
}
catch (ArgumentException error)
{
    Check(ReferenceEquals(error, primary), "Identity первичного исключения потеряна.");
}
var samples = (Dictionary<string, object?>[])primary.Data[SheetEffectProbe.DataKey]!;
Check(samples.Length == 3, "Подграф потерян.");
Check((int)samples[0]["hresult"]! == 0 && (int)samples[1]["hresult"]! == primary.HResult,
    "Успех и отказ компиляции не различены.");
Check((int)samples[2]["hresult"]! == 0 && samples[2]["cleanupHresult"] is int,
    "Cleanup назван отказом компиляции.");
Check(released.All(factory => factory.Disposed), "Factory опыта не освобождён.");
Check(!JsonSerializer.Serialize(samples).Contains(privateMarker), "Текст исключения опубликован.");
Console.WriteLine("PASS: подграфы, cleanup и identity основного отказа различены");

var boundedPrimary = new ArgumentException(privateMarker);
var boundedCalls = 0;
var bounded = new Compositor(effect =>
{
    boundedCalls++;
    if (ReferenceEquals(effect, graph)) throw boundedPrimary;
    return new CompositionEffectFactory();
});
try { SheetEffectProbe.CreateFactory(bounded, graph, Enumerable.Range(0, 100).Select(_ => (IGraphicsEffect)new PrivateEffect()).ToArray()); }
catch (ArgumentException error) { Check(ReferenceEquals(error, boundedPrimary), "Bounded primary заменён."); }
var boundedSamples = (Dictionary<string, object?>[])boundedPrimary.Data[SheetEffectProbe.DataKey]!;
Check(boundedSamples.Length == 64 && boundedCalls == 65, "Опыт вышел за лимит.");
Check(boundedSamples.All(sample => sample["type"] is null), "Неизвестный type попал в диагностику.");
Console.WriteLine("PASS: ограниченный опыт исключает неизвестные type");

var brokenPrimary = new ArgumentException(privateMarker);
try { SheetEffectProbe.CreateFactory(new Compositor(_ => throw brokenPrimary), graph, new BrokenCandidates()); }
catch (ArgumentException error) { Check(ReferenceEquals(error, brokenPrimary), "Сбой диагностики заменил primary."); }
Check(!brokenPrimary.Data.Contains(SheetEffectProbe.DataKey), "Сломанный опыт выдал фиктивные samples.");
Console.WriteLine("PASS: сбой диагностики сохраняет основной отказ");

sealed class PrivateEffect : IGraphicsEffect { }
sealed class ColorSourceEffect : IGraphicsEffect { }
sealed class AlphaMaskEffect : IGraphicsEffect { }
sealed class OpacityEffect : IGraphicsEffect { }
sealed class BrokenCandidates : IReadOnlyList<IGraphicsEffect>
{
    public int Count => throw new InvalidOperationException("PRIVATE_COUNT");
    public IGraphicsEffect this[int index] => throw new InvalidOperationException();
    public IEnumerator<IGraphicsEffect> GetEnumerator() => throw new InvalidOperationException();
    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
}

namespace Windows.Graphics.Effects { public interface IGraphicsEffect { } }
namespace Microsoft.UI.Composition
{
    public sealed class Compositor(Func<IGraphicsEffect, CompositionEffectFactory> create)
    {
        public CompositionEffectFactory CreateEffectFactory(IGraphicsEffect graph) => create(graph);
    }
    public sealed class CompositionEffectFactory(Exception? cleanup = null) : IDisposable
    {
        public bool Disposed { get; private set; }
        public void Dispose()
        {
            Disposed = true;
            if (cleanup is not null) throw cleanup;
        }
    }
}
