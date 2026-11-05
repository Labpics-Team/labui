using System.Numerics;

namespace LabUI.WinUI.Rendering;

// Координаты внутренних raster-слоёв одного Sheet; граф читает одну поверхность.
internal sealed class SheetAtlasLayout
{
    internal const int PaddingPixels = 2;
    internal int PixelWidth { get; }
    internal int PixelHeight { get; }
    internal int CellCount { get; }
    internal int Width { get; }
    internal int Height { get; }
    internal Vector2 BrushScale { get; }
    private readonly int columns;
    private readonly int strideWidth;
    private readonly int strideHeight;
    private readonly double rasterScale;

    private SheetAtlasLayout(int pixelWidth, int pixelHeight, Vector2 brushScale,
        double rasterScale, int count, int columns, int width, int height)
    {
        PixelWidth = pixelWidth;
        PixelHeight = pixelHeight;
        BrushScale = brushScale;
        this.rasterScale = rasterScale;
        CellCount = count;
        this.columns = columns;
        strideWidth = checked(pixelWidth + PaddingPixels * 2);
        strideHeight = checked(pixelHeight + PaddingPixels * 2);
        Width = width;
        Height = height;
    }

    internal static SheetAtlasLayout Create(int pixelWidth, int pixelHeight, Vector2 visualSize,
        double rasterScale, int cellCount, int maximumBitmapSize)
    {
        if (pixelWidth <= 0) throw new ArgumentOutOfRangeException(nameof(pixelWidth));
        if (pixelHeight <= 0) throw new ArgumentOutOfRangeException(nameof(pixelHeight));
        if (!float.IsFinite(visualSize.X) || visualSize.X <= 0 || !float.IsFinite(visualSize.Y) || visualSize.Y <= 0)
            throw new ArgumentOutOfRangeException(nameof(visualSize));
        var dpi = (float)(96 * rasterScale);
        if (!double.IsFinite(rasterScale) || rasterScale <= 0 || !float.IsFinite(dpi) || dpi <= 0)
            throw new ArgumentOutOfRangeException(nameof(rasterScale));
        if (cellCount <= 0) throw new ArgumentOutOfRangeException(nameof(cellCount));
        if (maximumBitmapSize <= 0) throw new ArgumentOutOfRangeException(nameof(maximumBitmapSize));

        var strideWidth = checked(pixelWidth + PaddingPixels * 2);
        var strideHeight = checked(pixelHeight + PaddingPixels * 2);
        var maximumColumns = maximumBitmapSize / strideWidth;
        var maximumRows = maximumBitmapSize / strideHeight;
        if ((long)maximumColumns * maximumRows < cellCount)
            throw new ArgumentOutOfRangeException(nameof(maximumBitmapSize), "Sheet atlas не помещается в предел CanvasDevice.");

        var selectedColumns = 0;
        var selectedWidth = 0;
        var selectedHeight = 0;
        var selectedExtent = int.MaxValue;
        var selectedArea = long.MaxValue;
        for (var columns = 1; columns <= Math.Min(cellCount, maximumColumns); columns++)
        {
            var rows = 1 + (cellCount - 1) / columns;
            if (rows > maximumRows) continue;
            var width = checked(columns * strideWidth);
            var height = checked(rows * strideHeight);
            var extent = Math.Max(width, height);
            var area = (long)width * height;
            if (extent > selectedExtent || (extent == selectedExtent && area >= selectedArea)) continue;
            selectedColumns = columns;
            selectedWidth = width;
            selectedHeight = height;
            selectedExtent = extent;
            selectedArea = area;
        }

        // Прежняя full-frame SurfaceBrush растягивала ceil(pixel size) на visual size.
        // Тот же коэффициент сохраняет проекцию при дробном RasterizationScale.
        var brushScale = new Vector2(visualSize.X / pixelWidth, visualSize.Y / pixelHeight);
        if (brushScale.X <= 0 || brushScale.Y <= 0)
            throw new ArgumentOutOfRangeException(nameof(visualSize));
        if (!float.IsFinite((float)(selectedWidth / rasterScale)) || !float.IsFinite((float)(selectedHeight / rasterScale)))
            throw new ArgumentOutOfRangeException(nameof(rasterScale));
        return new(pixelWidth, pixelHeight, brushScale, rasterScale, cellCount,
            selectedColumns, selectedWidth, selectedHeight);
    }

    internal (int PixelX, int PixelY, Vector2 DrawingOffset, Matrix3x2 EffectTransform) Cell(int index)
    {
        if (index < 0 || index >= CellCount) throw new ArgumentOutOfRangeException(nameof(index));
        var x = checked((index % columns) * strideWidth + PaddingPixels);
        var y = checked((index / columns) * strideHeight + PaddingPixels);
        return (x, y, new((float)(x / rasterScale), (float)(y / rasterScale)),
            Matrix3x2.CreateTranslation(-x * BrushScale.X, -y * BrushScale.Y));
    }
}
