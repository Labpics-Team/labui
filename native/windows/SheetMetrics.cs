namespace LabUI.WinUI;

internal readonly record struct SheetShadow(double BlurRadius, double OffsetY, double Opacity);

/// <summary>Half делит высоту с Ghost поровну с учётом перекрытия.</summary>
internal readonly record struct SheetMetrics(double Width, double Height, double BodyTop,
    double BodyHeight, double GhostHeight)
{
    internal double ContentTop => BodyTop + Geometry.SheetDragArea + Geometry.SheetGap;
    internal double ContentHeight => Math.Max(0, BodyHeight - Geometry.SheetDragArea
        - Geometry.SheetGap - Geometry.SheetInset);

    internal static SheetMetrics Half(double width, double height)
    {
        if (!double.IsFinite(width) || width <= 0) throw new ArgumentOutOfRangeException(nameof(width));
        if (!double.IsFinite(height) || height <= 0) throw new ArgumentOutOfRangeException(nameof(height));
        var top = Math.Max(0, (height - Geometry.SheetOverlap) / 2);
        return new(width, height, top, height - top, Math.Min(height, top + Geometry.SheetOverlap));
    }
}
