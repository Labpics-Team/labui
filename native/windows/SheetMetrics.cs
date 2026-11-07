namespace LabUI.WinUI;

internal readonly record struct SheetShadow(double BlurRadius, double OffsetY, double Opacity);

/// <summary>Геометрия Body и Ghost в одном viewport; масштаб не меняет размер окна.</summary>
internal readonly record struct SheetMetrics(double Width, double Height, double BodyTop,
    double BodyHeight, double GhostHeight, LabSheetState State, double Scale, bool HasContent)
{
    internal double Inset => Geometry.SheetInset * Scale;
    internal double DragArea => Geometry.SheetDragArea * Scale;
    internal double ContentGap => State == LabSheetState.Flex && !HasContent ? 0 : Geometry.SheetGap * Scale;
    internal double ContentTop => BodyTop + Math.Min(BodyHeight, DragArea + ContentGap);
    internal double ContentHeight => Math.Max(0, BodyHeight - DragArea - ContentGap - Inset);

    internal static SheetMetrics Half(double width, double height) => Create(width, height, LabSheetState.Half);

    internal static void ValidateScale(double geometryScale)
    {
        if (!double.IsFinite(geometryScale) || geometryScale <= 0
            || !float.IsFinite((float)(Geometry.SheetBodyFull * geometryScale)))
            throw new ArgumentOutOfRangeException(nameof(geometryScale));
    }

    internal static void ValidateState(LabSheetState state)
    {
        if (state is not (LabSheetState.Full or LabSheetState.TwoThirds or LabSheetState.Half
            or LabSheetState.OneThird or LabSheetState.Flex))
            throw new ArgumentOutOfRangeException(nameof(state));
    }

    internal static SheetMetrics Create(double width, double height, LabSheetState state,
        double contentHeight = 0, bool hasContent = false, double geometryScale = 1)
    {
        if (!double.IsFinite(width) || width <= 0) throw new ArgumentOutOfRangeException(nameof(width));
        if (!double.IsFinite(height) || height <= 0) throw new ArgumentOutOfRangeException(nameof(height));
        if (!double.IsFinite(contentHeight) || contentHeight < 0)
            throw new ArgumentOutOfRangeException(nameof(contentHeight));
        ValidateState(state);
        ValidateScale(geometryScale);
        var overlap = Geometry.SheetOverlap * geometryScale;
        var desired = state switch
        {
            LabSheetState.Full => Geometry.SheetBodyFull * geometryScale,
            LabSheetState.TwoThirds => Geometry.SheetBodyTwoThirds * geometryScale,
            LabSheetState.Half => height - Math.Max(0, (height - overlap) / 2),
            LabSheetState.OneThird => Geometry.SheetBodyOneThird * geometryScale,
            LabSheetState.Flex => (Geometry.SheetDragArea + Geometry.SheetInset
                + (hasContent ? Geometry.SheetGap : 0)) * geometryScale + (hasContent ? contentHeight : 0),
            _ => throw new ArgumentOutOfRangeException(nameof(state)),
        };
        var body = Math.Min(height, desired);
        var top = height - body;
        return new(width, height, top, body, Math.Min(height, top + overlap), state, geometryScale, hasContent);
    }
}
