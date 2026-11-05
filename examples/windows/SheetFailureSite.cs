using System.Diagnostics;
using System.Reflection;

namespace LabUI.Buttons;

// Только конечные метки. Текст исключения, пути и stack trace не покидают процесс.
internal static class SheetFailureSite
{
    private static readonly Dictionary<string, string[]> Members = new(StringComparer.Ordinal)
    {
        ["Compositor"] = ["CreateEffectFactory", "CreateBackdropBrush", "CreateSurfaceBrush", "CreateSpriteVisual"],
        ["CompositionEffectFactory"] = ["CreateBrush"],
        ["CompositionEffectBrush"] = ["SetSourceParameter"],
        ["CompositionGraphicsDevice"] = ["CreateDrawingSurface"],
        ["CanvasComposition"] = ["CreateCompositionGraphicsDevice", "CreateDrawingSession"],
        ["CanvasDevice"] = ["GetSharedDevice"],
        ["CanvasBitmap"] = ["CreateFromBytes"],
        ["CanvasDrawingSession"] = ["CreateLayer", "DrawImage", "DrawGeometry", "FillGeometry", "FillRectangle", "Dispose"],
        ["CanvasGeometry"] = ["CreatePath", "CreateRectangle", "CombineWith"],
        ["CanvasPathBuilder"] = ["AddArc"],
        ["CanvasLinearGradientBrush"] = [".ctor"],
        ["GaussianBlurEffect"] = ["set_BlurAmount", "set_Source", "set_BorderMode"],
        ["OpacityEffect"] = ["set_Opacity", "set_Source"],
        ["BlendEffect"] = ["set_Mode", "set_Background", "set_Foreground"],
        ["CompositeEffect"] = ["set_Mode"],
        ["ArithmeticCompositeEffect"] = ["set_Source1", "set_Source2", "set_MultiplyAmount", "set_Source1Amount", "set_Source2Amount", "set_Offset"],
        ["AlphaMaskEffect"] = ["set_Source", "set_AlphaMask"],
    };

    internal static string? Read(Exception? error)
    {
        if (error is null) return null;
        var frames = new StackTrace(error, false).GetFrames();
        for (var index = 0; index < Math.Min(frames.Length, 64); index++)
            if (frames[index].GetMethod() is { } method && Known(method) is { } site) return site;
        return null;
    }

    private static string? Known(MethodBase method)
    {
        if (method.DeclaringType is not { } declaring) return null;
        if (declaring.Namespace is "Microsoft.UI.Composition" or "ABI.Microsoft.UI.Composition"
            or "Microsoft.Graphics.Canvas" or "ABI.Microsoft.Graphics.Canvas"
            or "Microsoft.Graphics.Canvas.Effects" or "ABI.Microsoft.Graphics.Canvas.Effects"
            or "Microsoft.Graphics.Canvas.Brushes" or "ABI.Microsoft.Graphics.Canvas.Brushes"
            or "Microsoft.Graphics.Canvas.Geometry" or "ABI.Microsoft.Graphics.Canvas.Geometry"
            or "Microsoft.Graphics.Canvas.UI.Composition" or "ABI.Microsoft.Graphics.Canvas.UI.Composition")
        {
            // CsWinRT переносит вызовы в I<Type>[StaticsN]Methods. Публикуется только известная пара.
            var owner = declaring.Name;
            if (owner.EndsWith("Methods", StringComparison.Ordinal)) owner = owner[..^7];
            if (owner.Length > 1 && owner[0] == 'I' && char.IsUpper(owner[1])) owner = owner[1..];
            owner = owner.TrimEnd('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
            if (owner.EndsWith("Statics", StringComparison.Ordinal)) owner = owner[..^7];
            if (Members.TryGetValue(owner, out var names) && names.Contains(method.Name, StringComparer.Ordinal))
                return owner + "." + (method.Name == ".ctor" ? "ctor"
                    : method.Name.StartsWith("set_", StringComparison.Ordinal) ? method.Name[4..] : method.Name);
        }
        if (declaring.FullName == "LabUI.WinUI.Rendering.SheetLayers"
            || declaring.FullName?.StartsWith("LabUI.WinUI.Rendering.SheetLayers+", StringComparison.Ordinal) == true)
        {
            if (method.Name.StartsWith("<BuildFrame>g__Surface|", StringComparison.Ordinal)) return "SheetLayers.Surface";
            if (method.Name is "BuildFrame" or "BodyShape" or "DrawShadows" or "DrawNoise" or "Render")
                return "SheetLayers." + method.Name;
        }
        return null;
    }
}
