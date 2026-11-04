namespace LabUI.WinUI.Rendering;

// Гипотеза аппроксимации линейного 0→1 профиля. У каждого пикселя сумма весов равна 1.
internal static class SheetBlurProfile
{
    private static readonly float[] levels = [0, 1f / 64, 1f / 32, 1f / 16, 1f / 8, 1f / 4, 1f / 2, 1];
    internal static ReadOnlySpan<float> Levels => levels;

    internal static (float Position, float Weight)[] Stops(int index)
    {
        if (index < 0 || index >= levels.Length) throw new ArgumentOutOfRangeException(nameof(index));
        List<(float, float)> stops = [];
        if (index > 1) stops.Add((0, 0));
        if (index > 0) stops.Add((levels[index - 1], 0));
        stops.Add((levels[index], 1));
        if (index + 1 < levels.Length) stops.Add((levels[index + 1], 0));
        if (index + 2 < levels.Length) stops.Add((1, 0));
        return stops.ToArray();
    }
}
