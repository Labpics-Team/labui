namespace LabUI.WinUI;

public enum LabButtonSize { Small, Medium, Large }

internal readonly record struct ButtonMetrics(
    double MinHeight, double Radius,
    double InsetX, double InsetY,
    double ContentSize, double FontSize,
    double LineHeight, double Tracking,
    double DescriptionFontSize, double DescriptionLineHeight,
    double DescriptionTracking, ushort DescriptionWeight,
    double GlowShift);
