using System.Numerics;

namespace LabUI.WinUI.Rendering;

// Координаты raster-слоёв одного Sheet в разреженной виртуальной поверхности.
internal sealed class SheetAtlasLayout
{
    internal const int PaddingPixels = 2;
    private const int MaximumVirtualSurfaceAxis = 1 << 24;
    internal int PixelWidth { get; }
    internal int PixelHeight { get; }
    internal int CellCount { get; }
    internal int Width { get; }
    internal int Height { get; }
    internal Vector2 BrushScale { get; }
    internal Vector2 BrushOffset { get; }
    private readonly bool stackAlongX;
    private readonly int stride;

    private SheetAtlasLayout(int pixelWidth, int pixelHeight, Vector2 brushScale, Vector2 brushOffset,
        int count, bool stackAlongX, int stride, int width, int height)
    {
        PixelWidth = pixelWidth;
        PixelHeight = pixelHeight;
        BrushScale = brushScale;
        BrushOffset = brushOffset;
        CellCount = count;
        this.stackAlongX = stackAlongX;
        this.stride = stride;
        Width = width;
        Height = height;
    }

    internal static SheetAtlasLayout Create(int pixelWidth, int pixelHeight, Vector2 visualSize,
        double rasterScale, int cellCount)
    {
        if (pixelWidth <= 0 || pixelWidth > MaximumVirtualSurfaceAxis)
            throw new ArgumentOutOfRangeException(nameof(pixelWidth));
        if (pixelHeight <= 0 || pixelHeight > MaximumVirtualSurfaceAxis)
            throw new ArgumentOutOfRangeException(nameof(pixelHeight));
        if (!float.IsFinite(visualSize.X) || visualSize.X <= 0 || !float.IsFinite(visualSize.Y) || visualSize.Y <= 0)
            throw new ArgumentOutOfRangeException(nameof(visualSize));
        var dpi = (float)(96 * rasterScale);
        if (!double.IsFinite(rasterScale) || rasterScale <= 0 || !float.IsFinite(dpi) || dpi <= 0)
            throw new ArgumentOutOfRangeException(nameof(rasterScale));
        if (cellCount <= 0) throw new ArgumentOutOfRangeException(nameof(cellCount));

        // Это прежний checked-domain массива DrawNoise, без выделения памяти.
        _ = checked(pixelWidth * pixelHeight * 4);

        // Прежняя SurfaceBrush использовала Uniform и центрирование 0.5.
        var uniformScale = Math.Min((double)visualSize.X / pixelWidth, (double)visualSize.Y / pixelHeight);
        var brushScale = new Vector2((float)uniformScale);
        var brushOffset = new Vector2((float)((visualSize.X - pixelWidth * uniformScale) / 2),
            (float)((visualSize.Y - pixelHeight * uniformScale) / 2));
        if (brushScale.X <= 0 || !float.IsFinite(brushScale.X))
            throw new ArgumentOutOfRangeException(nameof(visualSize));
        if (!float.IsFinite((float)(pixelWidth / rasterScale)) || !float.IsFinite((float)(pixelHeight / rasterScale)))
            throw new ArgumentOutOfRangeException(nameof(rasterScale));

        // Полоса вдоль короткой оси сохраняет исходный предел длинной оси.
        // Для 1x1 обе оси короткие: fit axis исключает соседнюю ячейку из letterbox.
        var stackAlongX = pixelWidth < pixelHeight
            || (pixelWidth == 1 && pixelHeight == 1 && visualSize.X <= visualSize.Y);
        var stride = checked((stackAlongX ? pixelWidth : pixelHeight) + PaddingPixels * 2);
        var stripSize = checked(stride * cellCount);
        if (stripSize > MaximumVirtualSurfaceAxis) throw new ArgumentOutOfRangeException(nameof(cellCount));
        var lastOrigin = checked((cellCount - 1) * stride + PaddingPixels);
        if (!float.IsFinite(lastOrigin * brushScale.X)) throw new ArgumentOutOfRangeException(nameof(visualSize));
        var width = stackAlongX ? stripSize : pixelWidth;
        var height = stackAlongX ? pixelHeight : stripSize;
        return new(pixelWidth, pixelHeight, brushScale, brushOffset, cellCount,
            stackAlongX, stride, width, height);
    }

    internal (int PixelX, int PixelY, Matrix3x2 EffectTransform) Cell(int index)
    {
        if (index < 0 || index >= CellCount) throw new ArgumentOutOfRangeException(nameof(index));
        var origin = checked(index * stride + PaddingPixels);
        var x = stackAlongX ? origin : 0;
        var y = stackAlongX ? 0 : origin;
        return (x, y, Matrix3x2.CreateTranslation(-x * BrushScale.X, -y * BrushScale.Y));
    }
}
