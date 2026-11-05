using System.Collections;

namespace LabUI.Buttons;

// Временный wire-проектор диагностических случаев. Произвольные Data/Message
// не сериализуются; ошибки диагностики не меняют исходный отказ приложения.
internal static class SheetSourceTopology
{
    internal const string DataKey = "LabUI.SheetSourceTopologyProbe";
    internal const string FactoryDataKey = "LabUI.SheetFactoryFailure";
    internal const string TransformsDataKey = "LabUI.SheetFactoryTransforms";
    internal const int Limit = 20;

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
                        ["inputs"] = Integer(row["inputs"], 1, 8),
                        ["combine"] = Known(row["combine"], "Add", "Arithmetic", "BalancedAdd", "Gaussian"),
                        ["source"] = Known(row["source"], "shared", "repeat", "distinct"),
                        ["named"] = Boolean(row["named"]),
                        ["blur"] = Boolean(row["blur"]),
                        ["mask"] = Boolean(row["mask"]),
                        ["hresult"] = Integer(row["hresult"], int.MinValue, int.MaxValue),
                        ["cleanupHresult"] = Integer(row["cleanupHresult"], int.MinValue, int.MaxValue),
                    };
                    if (row.Contains("stage")) projected["stage"] = Known(row["stage"], "build", "factory");
                    if (row.Contains("levelStart")) projected["levelStart"] = Integer(row["levelStart"], 0, 7);
                    if (row.Contains("sigmas")) projected["sigmas"] = Sigmas(row["sigmas"]);
                    rows.Add(projected);
                }
                return rows.ToArray();
            }
        }
        catch { }
        return null;
    }

    // Удаляется вместе с factory producer после RCA и проверенного owner fix.
    internal static Dictionary<string, object?>? ReadFactory(Exception? error)
    {
        try
        {
            for (var depth = 0; error is not null && depth < 8; depth++, error = error.InnerException)
            {
                if (!error.Data.Contains(FactoryDataKey)) continue;
                if (error.Data[FactoryDataKey] is not Dictionary<string, object?> value
                    || value.Count != 2 || !value.TryGetValue("name", out var rawName)
                    || !value.TryGetValue("operation", out var rawOperation)) return null;
                var name = Known(rawName, "ghostPair0", "ghostPair1", "ghostPair2", "ghostPair3",
                    "progressive", "ghost", "body", "final");
                var operation = Known(rawOperation, "factory", "brush", "binding");
                return name is not null && operation is not null
                    ? new() { ["name"] = name, ["operation"] = operation } : null;
            }
        }
        catch { }
        return null;
    }

    // Вместе с borrowed Transform2D sampler удаляется после RCA/owner fix.
    internal static Dictionary<string, object?>[]? ReadTransforms(Exception? error)
    {
        try
        {
            for (var depth = 0; error is not null && depth < 8; depth++, error = error.InnerException)
            {
                if (!error.Data.Contains(TransformsDataKey)) continue;
                if (error.Data[TransformsDataKey] is not Dictionary<string, object?>[] { Length: 2 } rows)
                    return null;
                var projected = new Dictionary<string, object?>[2];
                for (var index = 0; index < 2; index++)
                {
                    var row = rows[index];
                    if (row is null || row.Count != 2 || !row.TryGetValue("hresult", out var hresult)
                        || !row.TryGetValue("cleanupHresult", out var cleanupHresult)
                        || hresult is not (null or int) || cleanupHresult is not (null or int)) return null;
                    projected[index] = new() { ["hresult"] = hresult, ["cleanupHresult"] = cleanupHresult };
                }
                return projected;
            }
        }
        catch { }
        return null;
    }

    private static int? Integer(object? value, int minimum, int maximum)
        => value is int number && number >= minimum && number <= maximum ? number : null;
    private static bool? Boolean(object? value) => value is bool flag ? flag : null;
    private static float[]? Sigmas(object? value)
        => value is float[] { Length: > 0 and <= 2 } numbers
            && numbers.All(number => float.IsFinite(number) && number >= 0) ? (float[])numbers.Clone() : null;
    private static string? Known(object? value, params string[] allowed)
        => value is string text && allowed.Contains(text, StringComparer.Ordinal) ? text : null;
}
