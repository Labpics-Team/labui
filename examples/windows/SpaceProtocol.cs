#nullable enable
using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace LabUI.Buttons;

// Канал существует только у opt-in дочернего процесса harness, без отдельного listener.
public static class SpaceProtocol
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase, IncludeFields = true,
        Converters = { new JsonStringEnumConverter() }
    };

    // Reader продолжает drain независимо от ожидания процесса; лимит действует до построения строки.
    public static async Task<string?> ReadLineAsync(TextReader reader, int limit, CancellationToken cancellationToken = default)
    {
        var character = new char[1];
        var line = new StringBuilder();
        while (await reader.ReadAsync(character.AsMemory(), cancellationToken) != 0)
        {
            if (character[0] == '\n') return line.Length > 0 && line[^1] == '\r' ? line.ToString(0, line.Length - 1) : line.ToString();
            if (line.Length == limit) throw new InvalidDataException("Строка Space превышает лимит.");
            line.Append(character[0]);
        }
        if (line.Length != 0) throw new InvalidDataException("Space завершил поток внутри строки.");
        return null;
    }

    public static async Task<string> ReadErrorAsync(TextReader reader, CancellationToken cancellationToken = default)
    {
        var buffer = new char[1024];
        var text = new StringBuilder();
        int count;
        while ((count = await reader.ReadAsync(buffer.AsMemory(), cancellationToken)) != 0)
        {
            if (text.Length + count > 32 * 1024) throw new InvalidDataException("stderr Space превышает лимит.");
            text.Append(buffer, 0, count);
        }
        return text.ToString();
    }

    internal static async Task RunAsync(Stream input, Stream output, Func<string, Task<object>> dispatch, bool allowDynamic = false)
    {
        using var reader = new StreamReader(input, new UTF8Encoding(false, true), false, 1024, leaveOpen: true);
        using var writer = new StreamWriter(output, new UTF8Encoding(false), 1024, leaveOpen: true) { AutoFlush = true, NewLine = "\n" };
        for (var id = 1; id <= 256; id++)
        {
            var command = await ReadLineAsync(reader, 32);
            if (command is null) return;
            string json;
            try
            {
                if (command is not ("arm Light" or "arm Dark" or "ready 1" or "ready 2" or "complete") &&
                    !(allowDynamic && command is ("dynamic arm" or "dynamic prepare" or "dynamic disable" or
                        "dynamic ready 1" or "dynamic ready 2" or "dynamic complete")))
                    throw new InvalidDataException("Неизвестная команда Space.");
                json = JsonSerializer.Serialize(new { id, ok = true, value = await dispatch(command) }, Json);
                if (Encoding.UTF8.GetByteCount(json) > 128 * 1024)
                    throw new InvalidDataException("Ответ Space превышает лимит.");
            }
            catch (Exception error)
            {
                var description = error.GetType().Name + ": " + error.Message;
                json = JsonSerializer.Serialize(new { id, ok = false, error = description[..Math.Min(description.Length, 512)] });
                await writer.WriteLineAsync(json);
                return;
            }
            await writer.WriteLineAsync(json);
        }
        throw new InvalidDataException("Превышено число команд Space.");
    }
}
