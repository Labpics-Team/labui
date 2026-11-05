using System.Collections;

namespace LabUI.Buttons;

// Временный wire-проектор диагностических случаев. Произвольные Data/Message
// не сериализуются; ошибки диагностики не меняют исходный отказ приложения.
internal static class SheetSourceTopology
{
    internal const string DataKey = "LabUI.SheetSourceTopologyProbe";
    internal const int Limit = 15;

    internal static Dictionary<string, object?>[]? Read(Exception? error)
    {
        try
        {
            for (var depth = 0; error is not null && depth < 8; depth++, error = error.InnerException)
            {
                if (error.Data[DataKey] is not Array values) continue;
                if (values.Length > Limit) return null;
                var rows = new List<Dictionary<string, object?>>();
                foreach (var value in values)
                {
                    if (value is not IDictionary row) return null;
                    var projected = new Dictionary<string, object?>
                    {
                        ["index"] = Integer(row["index"], 0, Limit - 1),
                        ["inputs"] = Integer(row["inputs"], 2, 8),
                        ["combine"] = Known(row["combine"], "Add", "Arithmetic"),
                        ["source"] = Known(row["source"], "shared", "repeat", "distinct"),
                        ["named"] = Boolean(row["named"]),
                        ["blur"] = Boolean(row["blur"]),
                        ["mask"] = Boolean(row["mask"]),
                        ["hresult"] = Integer(row["hresult"], int.MinValue, int.MaxValue),
                        ["cleanupHresult"] = Integer(row["cleanupHresult"], int.MinValue, int.MaxValue),
                    };
                    if (row.Contains("stage")) projected["stage"] = Known(row["stage"], "build", "factory");
                    rows.Add(projected);
                }
                return rows.ToArray();
            }
        }
        catch { }
        return null;
    }

    private static int? Integer(object? value, int minimum, int maximum)
        => value is int number && number >= minimum && number <= maximum ? number : null;
    private static bool? Boolean(object? value) => value is bool flag ? flag : null;
    private static string? Known(object? value, params string[] allowed)
        => value is string text && allowed.Contains(text, StringComparer.Ordinal) ? text : null;
}
