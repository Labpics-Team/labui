using Microsoft.UI.Composition;
using Windows.Graphics.Effects;

namespace LabUI.WinUI.Rendering;

// Временный опыт после отказа factory: компилирует уже построенные подграфы,
// не создаёт кисти или визуалы и не заменяет исходный отказ.
internal static class SheetEffectProbe
{
    internal const string DataKey = "LabUI.SheetEffectProbe";
    internal const int Limit = 64;
    private static readonly HashSet<string> Types =
    ["ColorSourceEffect", "OpacityEffect", "CompositeEffect", "AlphaMaskEffect",
     "GaussianBlurEffect", "ArithmeticCompositeEffect", "BlendEffect"];

    internal static CompositionEffectFactory CreateFactory(Compositor compositor, IGraphicsEffect graph,
        IReadOnlyList<IGraphicsEffect> candidates)
    {
        try { return compositor.CreateEffectFactory(graph); }
        catch (Exception primary)
        {
            try
            {
                List<Dictionary<string, object?>> samples = [];
                for (var index = 0; index < Math.Min(candidates.Count, Limit); index++)
                {
                    var effect = candidates[index];
                    var type = effect.GetType().Name;
                    var sample = new Dictionary<string, object?>
                    {
                        ["index"] = index,
                        ["type"] = Types.Contains(type) ? type : null,
                        ["hresult"] = 0,
                        ["cleanupHresult"] = null,
                    };
                    CompositionEffectFactory? factory = null;
                    try { factory = compositor.CreateEffectFactory(effect); }
                    catch (Exception error) { sample["hresult"] = error.HResult; }
                    finally
                    {
                        try { factory?.Dispose(); }
                        catch (Exception cleanup) { sample["cleanupHresult"] = cleanup.HResult; }
                    }
                    samples.Add(sample);
                }
                primary.Data[DataKey] = samples.ToArray();
            }
            catch
            {
                // Отказ диагностики не меняет identity, stack или исход основного отказа.
            }
            throw;
        }
    }
}
