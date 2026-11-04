// СГЕНЕРИРОВАНО. Не править вручную. owners 2aaa56a0874f4b19ef1671f19f98fb5b7d9068fb2029c520276db62e7929bdbd
// Размеры — DIP при масштабе 100%; tracking — em, line height — DIP.
namespace LabUI.WinUI;

internal static class Geometry
{
    internal static ButtonMetrics Button(LabButtonSize size) => size switch
    {
        LabButtonSize.Small => new(36, 9999, 12, 8, 20, 14, 12, 0, 14, 12, 0, 500, -1),
        LabButtonSize.Medium => new(48, 16, 12, 12, 24, 16, 24, 0, 16, 24, -0.015625, 400, 0),
        LabButtonSize.Large => new(56, 16, 16, 16, 24, 16, 24, 0, 16, 24, -0.015625, 400, 3),
        _ => throw new System.ArgumentOutOfRangeException(nameof(size)),
    };

    internal const double LabelInset = 8;
    internal const double LabelGap = 8;
    internal const double GlowSize = 96;
    internal const double GlowBlur = 18;
    internal const double SheenOpacity = 0.2;
    internal const double SheenHoverOpacity = 0.32;
    internal const double ShadeOpacity = 0.12;
    internal const double GlowOpacity = 0.16640000000000002;
    internal const double ShadowOffset = 1;
    internal const double ShadowBlur = 1;
    internal const double DisabledOpacity = 0.45;
    internal const double FocusWidth = 2;
    internal const double FocusOffset = 2;
    internal const double SmoothResponse = 350;
    internal const double SmoothBounce = 0;
    internal const ushort FontWeightMedium = 500;
}
