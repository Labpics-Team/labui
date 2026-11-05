using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.Effects;
using Microsoft.UI.Composition;
using Windows.Graphics.Effects;

namespace LabUI.WinUI.Rendering;

// Временный различитель после отказа factory. Свежие графы отделяют имена и
// повторное использование источника от числа ветвей; кисти и визуалы не создаются.
internal static class SheetSourceTopologyProbe
{
    internal const string DataKey = "LabUI.SheetSourceTopologyProbe";
    internal const int Limit = 15;
    private readonly record struct Case(int Inputs, bool Add, string Source,
        bool Named = false, bool Blur = true, bool Mask = true);
    private static readonly Case[] cases =
    [
        new(2, false, "shared"), new(3, false, "shared"),
        new(3, false, "repeat"), new(3, false, "distinct"),
        new(3, false, "shared", true), new(3, false, "distinct", true),
        new(2, true, "shared"), new(3, true, "shared"),
        new(8, true, "shared"), new(8, true, "distinct"),
        new(3, true, "shared", true), new(8, true, "repeat"),
        new(8, true, "distinct", true),
        new(8, true, "shared", true, false),
        new(8, true, "shared", true, true, false),
    ];

    internal static CompositionEffectFactory CreateFactory(Compositor compositor,
        IGraphicsEffect graph, double ghostSigma)
    {
        try { return compositor.CreateEffectFactory(graph); }
        catch (Exception primary)
        {
            try
            {
                primary.Data[DataKey] = cases.Select((spec, index) =>
                    Sample(compositor, spec, index, ghostSigma)).ToArray();
            }
            catch
            {
                // Диагностика не отзывает исходный exception или место его throw.
            }
            throw;
        }
    }

    private static Dictionary<string, object?> Sample(Compositor compositor,
        Case spec, int index, double ghostSigma)
    {
        List<IDisposable> owned = [];
        CompositionEffectFactory? factory = null;
        var sample = new Dictionary<string, object?>
        {
            ["index"] = index, ["inputs"] = spec.Inputs,
            ["combine"] = spec.Add ? "Add" : "Arithmetic",
            ["source"] = spec.Source, ["named"] = spec.Named,
            ["blur"] = spec.Blur, ["mask"] = spec.Mask,
            ["stage"] = "build",
            ["hresult"] = 0, ["cleanupHresult"] = null,
        };
        try
        {
            T Own<T>(T effect) where T : IGraphicsEffect, IDisposable
            {
                owned.Add(effect);
                if (spec.Named) effect.Name = $"probe{owned.Count}";
                return effect;
            }
            var shared = new CompositionEffectSourceParameter("backdrop");
            IGraphicsEffectSource? sum = null;
            var add = spec.Add ? Own(new CompositeEffect { Mode = CanvasComposite.Add }) : null;
            for (var input = 0; input < spec.Inputs; input++)
            {
                IGraphicsEffectSource branch = spec.Source switch
                {
                    "shared" => shared,
                    "repeat" => new CompositionEffectSourceParameter("backdrop"),
                    _ => new CompositionEffectSourceParameter($"backdrop{input}"),
                };
                if (spec.Blur && input > 0) branch = Own(new GaussianBlurEffect
                {
                    Source = branch, BlurAmount = (float)(SheetBlurProfile.Levels[input] * ghostSigma),
                    BorderMode = EffectBorderMode.Hard,
                });
                if (spec.Mask) branch = Own(new AlphaMaskEffect
                {
                    Source = branch,
                    AlphaMask = new CompositionEffectSourceParameter($"mask{input}"),
                });
                if (add is not null) add.Sources.Add(branch);
                else sum = sum is null ? branch : Own(new ArithmeticCompositeEffect
                {
                    Source1 = sum, Source2 = branch, MultiplyAmount = 0,
                    Source1Amount = 1, Source2Amount = 1, Offset = 0, ClampOutput = false,
                });
            }
            var graph = (IGraphicsEffect)(add ?? sum!);
            sample["stage"] = "factory";
            factory = compositor.CreateEffectFactory(graph);
        }
        catch (Exception error) { sample["hresult"] = error.HResult; }
        finally
        {
            void Dispose(IDisposable value)
            {
                try { value.Dispose(); }
                catch (Exception error) { sample["cleanupHresult"] ??= error.HResult; }
            }
            if (factory is not null) Dispose(factory);
            for (var resource = owned.Count - 1; resource >= 0; resource--) Dispose(owned[resource]);
        }
        return sample;
    }
}
