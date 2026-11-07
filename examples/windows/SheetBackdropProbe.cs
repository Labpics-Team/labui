using LabUI.WinUI.Rendering;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Windows.Foundation;

namespace LabUI.Buttons;

// Локальный fixture capture; меняет только Source до первого image load.
internal sealed class SheetBackdropProbe
{
    private sealed record Asset(string file, string sha256);
    private sealed record PixelSize(int width, int height);
    private sealed record PixelRect(int x, int y, int width, int height);
    private sealed record Fixture(string schema, Dictionary<string, Asset> assets,
        PixelSize sourcePixels, PixelRect changedSourceRect, int[] replacementRgba, int resamplingMargin);

    private readonly Fixture fixture;
    private readonly string variant;
    private readonly string fixtureSha256;
    private readonly string assetSha256;
    internal BitmapImage Source { get; }

    internal static SheetBackdropProbe? Create(string[] arguments, bool observing)
    {
        const string prefix = "--sheet-backdrop-witness=";
        var argument = arguments.FirstOrDefault(value => value.StartsWith(prefix, StringComparison.Ordinal));
        if (argument is null) return null;
        if (!observing) throw new InvalidOperationException("Backdrop witness требует capture observation.");
        var variant = argument[prefix.Length..];
        if (variant is not ("A" or "B")) throw new ArgumentException("Неизвестный backdrop witness.");
        return new(variant);
    }

    private SheetBackdropProbe(string variant)
    {
        this.variant = variant;
        var directory = Path.Combine(AppContext.BaseDirectory, "Assets");
        var descriptor = File.ReadAllBytes(Path.Combine(directory, "SheetBackdropWitness.json"));
        fixtureSha256 = Convert.ToHexStringLower(SHA256.HashData(descriptor));
        fixture = JsonSerializer.Deserialize<Fixture>(descriptor, new JsonSerializerOptions
        { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow })
            ?? throw new InvalidOperationException("Backdrop fixture отсутствует.");
        var asset = fixture.assets[variant];
        var bytes = File.ReadAllBytes(Path.Combine(directory, asset.file));
        assetSha256 = Convert.ToHexStringLower(SHA256.HashData(bytes));
        if (assetSha256 != asset.sha256 || bytes.Length < 29
            || BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16, 4)) != fixture.sourcePixels.width
            || BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20, 4)) != fixture.sourcePixels.height)
            throw new InvalidOperationException("Backdrop asset identity не совпала.");
        Source = new BitmapImage(new Uri($"ms-appx:///Assets/{asset.file}"));
    }

    private static object Paint(SolidColorBrush? brush)
    {
        if (brush is null) throw new InvalidOperationException("Backdrop witness требует готовые paints.");
        var color = brush.Color;
        return new { rgba = new[] { (int)color.R, color.G, color.B, color.A }, opacity = brush.Opacity };
    }

    internal object Read(Page page, Image image, SheetLayers? layers)
    {
        if (layers is null || image.Source is not BitmapImage bitmap)
            throw new InvalidOperationException("Backdrop witness требует готовый frame и bitmap.");
        var bounds = image.TransformToVisual(page).TransformBounds(new Rect(0, 0, image.ActualWidth, image.ActualHeight));
        return new
        {
            schema = fixture.schema,
            variant,
            fixtureSha256,
            assetSha256,
            sourcePixels = fixture.sourcePixels,
            image = new
            {
                source = bitmap.UriSource.AbsoluteUri,
                bitmapPixels = new { width = bitmap.PixelWidth, height = bitmap.PixelHeight },
                bounds = new { x = bounds.X, y = bounds.Y, width = bounds.Width, height = bounds.Height },
                stretch = image.Stretch.ToString(),
                horizontalAlignment = image.HorizontalAlignment.ToString(),
                verticalAlignment = image.VerticalAlignment.ToString()
            },
            fit = new
            {
                scale = Math.Max(image.ActualWidth / fixture.sourcePixels.width,
                    image.ActualHeight / fixture.sourcePixels.height),
                offsetX = bounds.X,
                offsetY = bounds.Y
            },
            paints = new
            {
                tint = Paint(layers.Tint), blend = Paint(layers.Blend), ghost = Paint(layers.Ghost),
                border = Paint(layers.Border), noise = Paint(layers.Noise),
                shadowInk = Paint(layers.ShadowInk), solid = Paint(layers.Solid)
            }
        };
    }
}
