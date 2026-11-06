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
    internal const string BranchesDataKey = "LabUI.SheetFactoryBranches";
    internal const int Limit = 20;
    private readonly record struct Case(int Inputs, bool Add, string Source,
        bool Named = false, bool Blur = true, bool Mask = true, bool Balanced = false,
        int LevelStart = 0, bool Body = false);
    private static readonly Case[] cases =
    [
        new(2, false, "shared"), new(3, false, "shared"),
        new(3, false, "repeat"), new(3, false, "distinct"),
        new(3, false, "shared", true), new(3, false, "distinct", true),
        new(2, true, "shared"), new(3, true, "shared"),
        new(8, true, "shared"), new(8, true, "distinct"),
        new(3, true, "repeat"), new(8, true, "repeat"),
        new(8, false, "repeat"),
        new(8, true, "shared", true, false),
        new(8, true, "shared", true, true, false),
        new(8, true, "repeat", Balanced: true),
        new(1, false, "repeat", Mask: false, LevelStart: 7),
        new(1, false, "repeat", Mask: false, Body: true),
        new(2, true, "repeat", LevelStart: 6),
        new(8, true, "repeat", Blur: false),
    ];

    internal static CompositionEffectFactory CreateFactory(Compositor compositor,
        IGraphicsEffect graph, double ghostSigma, double bodySigma)
    {
        try { return compositor.CreateEffectFactory(graph); }
        catch (Exception primary)
        {
            try
            {
                primary.Data[DataKey] = cases.Select((spec, index) =>
                    Sample(compositor, spec, index, ghostSigma, bodySigma)).ToArray();
            }
            catch
            {
                // Диагностика не отзывает исходный exception или место его throw.
            }
            throw;
        }
    }

    // Слоты: исходный progressive; тот же progressive с Ghost paint/noise до внешней маски.
    // Графы принадлежат Frame; sampler закрывает только свои factory.
    internal static void RecordBranches(Exception primary, Compositor compositor,
        IGraphicsEffect first, IGraphicsEffect second)
    {
        try
        {
            var firstResult = SampleFactory(compositor, first);
            var secondResult = SampleFactory(compositor, second);
            primary.Data[BranchesDataKey] = new Dictionary<string, object?>[]
            {
                new() { ["hresult"] = firstResult.HResult, ["cleanupHresult"] = firstResult.CleanupHResult },
                new() { ["hresult"] = secondResult.HResult, ["cleanupHresult"] = secondResult.CleanupHResult },
            };
        }
        catch { }
    }

    private static (int? HResult, int? CleanupHResult) SampleFactory(Compositor compositor,
        IGraphicsEffect graph)
    {
        CompositionEffectFactory? factory = null;
        int? hresult = null;
        int? cleanupHresult = null;
        try
        {
            factory = compositor.CreateEffectFactory(graph);
            hresult = 0;
        }
        catch (Exception error) { hresult = error.HResult; }
        finally
        {
            if (factory is not null)
            {
                try { factory.Dispose(); }
                catch (Exception cleanup) { cleanupHresult = cleanup.HResult; }
            }
        }
        return (hresult, cleanupHresult);
    }

    private static Dictionary<string, object?> Sample(Compositor compositor,
        Case spec, int index, double ghostSigma, double bodySigma)
    {
        List<IDisposable> owned = [];
        CompositionEffectFactory? factory = null;
        var sample = new Dictionary<string, object?>
        {
            ["index"] = index, ["inputs"] = spec.Inputs,
            ["combine"] = spec.Inputs == 1 ? "Gaussian" :
                spec.Balanced ? "BalancedAdd" : spec.Add ? "Add" : "Arithmetic",
            ["source"] = spec.Source, ["named"] = spec.Named,
            ["blur"] = spec.Blur, ["mask"] = spec.Mask,
            ["stage"] = "build",
            ["hresult"] = 0, ["cleanupHresult"] = null,
        };
        try
        {
            float[]? sigmas = null;
            if (spec.Inputs == 1 || spec.LevelStart > 0)
            {
                sigmas = spec.Body ? [(float)bodySigma] :
                    Enumerable.Range(spec.LevelStart, spec.Inputs)
                        .Select(level => (float)(SheetBlurProfile.Levels[level] * ghostSigma)).ToArray();
                sample["sigmas"] = sigmas;
                if (!spec.Body) sample["levelStart"] = spec.LevelStart;
            }
            T Own<T>(T effect) where T : IGraphicsEffect, IDisposable
            {
                owned.Add(effect);
                if (spec.Named) effect.Name = $"probe{owned.Count}";
                return effect;
            }
            var shared = new CompositionEffectSourceParameter("backdrop");
            IGraphicsEffectSource? sum = null;
            List<IGraphicsEffectSource>? balanced = spec.Balanced ? [] : null;
            var add = spec.Add && !spec.Balanced ? Own(new CompositeEffect { Mode = CanvasComposite.Add }) : null;
            for (var input = 0; input < spec.Inputs; input++)
            {
                IGraphicsEffectSource branch = spec.Source switch
                {
                    "shared" => shared,
                    "repeat" => new CompositionEffectSourceParameter("backdrop"),
                    _ => new CompositionEffectSourceParameter($"backdrop{input}"),
                };
                if (spec.Blur && (input > 0 || sigmas is not null)) branch = Own(new GaussianBlurEffect
                {
                    Source = branch, BlurAmount = sigmas is null
                        ? (float)(SheetBlurProfile.Levels[input] * ghostSigma) : sigmas[input],
                    BorderMode = EffectBorderMode.Hard,
                });
                if (spec.Mask) branch = Own(new AlphaMaskEffect
                {
                    Source = branch,
                    AlphaMask = new CompositionEffectSourceParameter($"mask{spec.LevelStart + input}"),
                });
                if (balanced is not null) balanced.Add(branch);
                else if (add is not null) add.Sources.Add(branch);
                else sum = sum is null ? branch : Own(new ArithmeticCompositeEffect
                {
                    Source1 = sum, Source2 = branch, MultiplyAmount = 0,
                    Source1Amount = 1, Source2Amount = 1, Offset = 0, ClampOutput = false,
                });
            }
            if (balanced is not null)
            {
                while (balanced.Count > 1)
                {
                    List<IGraphicsEffectSource> next = [];
                    for (var input = 0; input < balanced.Count; input += 2)
                    {
                        var pair = Own(new CompositeEffect { Mode = CanvasComposite.Add });
                        pair.Sources.Add(balanced[input]);
                        pair.Sources.Add(balanced[input + 1]);
                        next.Add(pair);
                    }
                    balanced = next;
                }
                sum = balanced[0];
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
