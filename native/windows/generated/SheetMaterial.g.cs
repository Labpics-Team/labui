// СГЕНЕРИРОВАНО. Materials source 1e96ce59e457776099c1ae2fc996459f9fb7c396f5694c777d7b583033fc6ee7. Не править вручную.
namespace LabUI.WinUI.Rendering;

internal enum SheetBodyStage { Tint, Blend, Blur }

internal static class SheetMaterialProfile
{
    internal const double RadiusToSigma = 0.5;
    private static readonly SheetBodyStage[] stages =
    [SheetBodyStage.Tint, SheetBodyStage.Blend, SheetBodyStage.Blur];
    internal static System.ReadOnlySpan<SheetBodyStage> Stages => stages;
    internal static Microsoft.Graphics.Canvas.Effects.BlendEffectMode BlendMode(bool dark) => dark
        ? Microsoft.Graphics.Canvas.Effects.BlendEffectMode.Overlay
        : Microsoft.Graphics.Canvas.Effects.BlendEffectMode.ColorDodge;
}
