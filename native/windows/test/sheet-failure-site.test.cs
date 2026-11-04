using LabUI.Buttons;
using System.Runtime.CompilerServices;

if (SheetFailureSite.Read(null) is not null || SheetFailureSite.Read(new ArgumentException(Fault.Marker)) is not null)
    throw new InvalidOperationException("Невыброшенное исключение не должно иметь site.");

var passed = 0;
void Check(Action witness, string? expected)
{
    Fault.Primary = new ArgumentException(Fault.Marker);
    try { witness(); }
    catch (Exception error)
    {
        var site = SheetFailureSite.Read(error);
        if (!ReferenceEquals(error, Fault.Primary) || error.Data.Count != 0 || error.Message != Fault.Marker)
            throw new InvalidOperationException("Диагностика изменила первичное исключение.");
        if (site != expected) throw new InvalidOperationException("Метаданные допустимого стека классифицированы неверно.");
        passed++;
        return;
    }
    throw new InvalidOperationException("Свидетель не достиг отказа.");
}

Check(Microsoft.UI.Composition.Compositor.CreateEffectFactory, "Compositor.CreateEffectFactory");
Check(ABI.Microsoft.UI.Composition.ICompositorMethods.CreateEffectFactory, "Compositor.CreateEffectFactory");
Check(ABI.Microsoft.Graphics.Canvas.UI.Composition.ICanvasCompositionStatics2Methods.CreateDrawingSession, "CanvasComposition.CreateDrawingSession");
Check(ABI.Microsoft.Graphics.Canvas.Effects.IGaussianBlurEffectMethods.set_BlurAmount, "GaussianBlurEffect.BlurAmount");
Check(LabUI.WinUI.Rendering.SheetLayers.BodyShape, "SheetLayers.BodyShape");
Check(LabUI.WinUI.Rendering.SheetLayersLookalike.Render, null);
Check(Foreign.Compositor.CreateEffectFactory, null);
Console.WriteLine($"Sheet failure site: {passed} controlled stack shapes and primary preservation PASS");

static class Fault
{
    internal const string Marker = "PRIVATE_MESSAGE_NOT_FOR_DIAGNOSTIC_LOG";
    internal static Exception Primary = new ArgumentException(Marker);
}
namespace Microsoft.UI.Composition
{
    static class Compositor { [MethodImpl(MethodImplOptions.NoInlining)] internal static void CreateEffectFactory() => throw Fault.Primary; }
}
namespace ABI.Microsoft.UI.Composition
{
    static class ICompositorMethods { [MethodImpl(MethodImplOptions.NoInlining)] internal static void CreateEffectFactory() => throw Fault.Primary; }
}
namespace ABI.Microsoft.Graphics.Canvas.UI.Composition
{
    static class ICanvasCompositionStatics2Methods { [MethodImpl(MethodImplOptions.NoInlining)] internal static void CreateDrawingSession() => throw Fault.Primary; }
}
namespace ABI.Microsoft.Graphics.Canvas.Effects
{
    static class IGaussianBlurEffectMethods { [MethodImpl(MethodImplOptions.NoInlining)] internal static void set_BlurAmount() => throw Fault.Primary; }
}
namespace LabUI.WinUI.Rendering
{
    static class SheetLayers { [MethodImpl(MethodImplOptions.NoInlining)] internal static void BodyShape() => throw Fault.Primary; }
    static class SheetLayersLookalike { [MethodImpl(MethodImplOptions.NoInlining)] internal static void Render() => throw Fault.Primary; }
}
namespace Foreign
{
    static class Compositor { [MethodImpl(MethodImplOptions.NoInlining)] internal static void CreateEffectFactory() => throw Fault.Primary; }
}
