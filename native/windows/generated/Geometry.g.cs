// СГЕНЕРИРОВАНО. Не править вручную. owners 2b26f1e3331eb6ca3afc1ee60d6ffdf4d2bd8c263d6fe1c68d58672771a05de1
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
    internal const double SheetRadius = 32;
    internal const double SheetInset = 16;
    internal const double SheetGap = 24;
    internal const double SheetOverlap = 32;
    internal const double SheetDragArea = 24;
    internal const double SheetIndicatorWidth = 36;
    internal const double SheetIndicatorHeight = 4;
    internal const double SheetIndicatorOffset = 14;
    internal const double SheetIndicatorShift = 0.5;
    internal const double SheetBorderWidth = 1;
    internal const double SheetBodyBlurRadius = 128;
    internal const double SheetGhostBlurRadius = 24;
    internal const double SheetBodyNoiseOpacity = 0.04;
    internal const double SheetGhostNoiseOpacity = 0.06;
    internal const ushort FontWeightMedium = 500;
    private static readonly SheetShadow[] sheetShadows =
    [
        new(36, 16, 0.12),
        new(48, 24, 0.04),
        new(64, 36, 0.02),
        new(96, 48, 0.01),
    ];
    internal static System.ReadOnlySpan<SheetShadow> SheetShadows => sheetShadows;
}
