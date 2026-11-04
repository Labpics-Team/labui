using System.Reflection;
using LabMotion.WinUI;

namespace LabUI.Buttons;

// Одноразовый readback закреплённого Motion. Удалить вместе с diagnostic pin после hosted-опыта.
internal static class SpaceRawTrace
{
    internal enum Kind { Values, Inertia, Idle, Interacting, Custom, Ignored }
    internal enum Disposition { Pending, Disposed, Input, Request, Mismatch, Unconditional }
    internal enum Phase { Idle, Inertia, Interacting, Custom, Unknown }
    internal sealed record State(int? RequestId, MotionOrigin? RequestOrigin, long? RequestOperation,
        int? ActiveRequest, long? ActiveOperation, bool Disposed, bool Interacting, Phase Phase);
    internal sealed record Vector(float? X, float? Y, float? Z);
    internal sealed record Record(long Sequence, long Timestamp, int ThreadId, Kind Kind, State Before,
        int? IncomingRequestId, Vector? Position, Vector? Velocity, Disposition Disposition);
    internal sealed record Counter(Kind Kind, Disposition Disposition, long Count);
    internal sealed record Terminal(Kind Kind, Disposition Disposition, Record First, Record Last);
    internal sealed record Snapshot(int SchemaVersion, int ProcessId, long StartedTicks, long EndedTicks,
        long Frequency, int OwnerThreadId, bool Stopped, long CallbackCount, long CompletedCount,
        long OtherThreadCount, bool CountersComplete, bool RecordsTruncated, long DroppedRecords,
        State Initial, Record[] Records, Counter[] Counts, Terminal[] Terminals);

    private static readonly MethodInfo begin = Method("BeginRawTrace", Type.EmptyTypes);
    private static readonly MethodInfo capture = Method("CaptureRawTrace", [typeof(bool)]);

    internal static void Begin(ScalarMotion channel) => begin.Invoke(channel, null);

    internal static Snapshot Capture(ScalarMotion channel, bool stop = false)
    {
        var value = capture.Invoke(channel, [stop]) ?? throw Incompatible();
        if (Read<int>(value, "SchemaVersion") != 1) throw Incompatible();
        return new(1, Read<int>(value, "ProcessId"), Read<long>(value, "StartedTicks"), Read<long>(value, "EndedTicks"),
            Read<long>(value, "Frequency"), Read<int>(value, "OwnerThreadId"), Read<bool>(value, "Stopped"),
            Read<long>(value, "CallbackCount"), Read<long>(value, "CompletedCount"), Read<long>(value, "OtherThreadCount"),
            Read<bool>(value, "CountersComplete"), Read<bool>(value, "RecordsTruncated"), Read<long>(value, "DroppedRecords"),
            ReadState(Property(value, "Initial") ?? throw Incompatible()),
            ReadArray(value, "Records", 24, ReadRecord), ReadArray(value, "Counts", 36, item =>
                new Counter(ReadEnum<Kind>(item, "Kind"), ReadEnum<Disposition>(item, "Disposition"), Read<long>(item, "Count"))),
            ReadArray(value, "Terminals", 12, item => new Terminal(ReadEnum<Kind>(item, "Kind"),
                ReadEnum<Disposition>(item, "Disposition"), ReadRecord(Property(item, "First") ?? throw Incompatible()),
                ReadRecord(Property(item, "Last") ?? throw Incompatible()))));
    }

    private static MethodInfo Method(string name, Type[] parameters) => typeof(ScalarMotion).GetMethod(
        name, BindingFlags.Instance | BindingFlags.NonPublic, parameters) ?? throw Incompatible();
    private static InvalidOperationException Incompatible() => new("Несовместимая диагностическая сборка Motion.");
    private static object? Property(object value, string name) =>
        (value.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public) ?? throw Incompatible()).GetValue(value);

    // Копируются только названные примитивы: чужое поле, путь или исключение не попадает в JSON.
    private static T Read<T>(object value, string name)
    {
        var property = Property(value, name);
        if (property is T typed)
        {
            if (property is float number && !float.IsFinite(number)) throw Incompatible();
            return typed;
        }
        if (property is null && default(T) is null) return default!;
        throw Incompatible();
    }

    private static T ReadEnum<T>(object value, string name) where T : struct, Enum
    {
        var property = Property(value, name) ?? throw Incompatible();
        if (!property.GetType().IsEnum) throw Incompatible();
        var result = (T)Enum.ToObject(typeof(T), Convert.ToInt32(property));
        return Enum.IsDefined(result) ? result : throw Incompatible();
    }

    private static T[] ReadArray<T>(object value, string name, int limit, Func<object, T> read)
    {
        var items = Property(value, name) as Array ?? throw Incompatible();
        if (items.Rank != 1 || items.Length > limit) throw Incompatible();
        var result = new T[items.Length];
        for (var index = 0; index < items.Length; index++) result[index] = read(items.GetValue(index) ?? throw Incompatible());
        return result;
    }

    private static State ReadState(object value)
    {
        var origin = Read<MotionOrigin?>(value, "RequestOrigin");
        if (origin is { } present && !Enum.IsDefined(present)) throw Incompatible();
        return new(Read<int?>(value, "RequestId"), origin, Read<long?>(value, "RequestOperation"),
            Read<int?>(value, "ActiveRequest"), Read<long?>(value, "ActiveOperation"), Read<bool>(value, "Disposed"),
            Read<bool>(value, "Interacting"), ReadEnum<Phase>(value, "Phase"));
    }
    private static Vector? ReadVector(object? value) => value is null ? null :
        new(Read<float?>(value, "X"), Read<float?>(value, "Y"), Read<float?>(value, "Z"));
    private static Record ReadRecord(object value) => new(Read<long>(value, "Sequence"), Read<long>(value, "Timestamp"),
        Read<int>(value, "ThreadId"), ReadEnum<Kind>(value, "Kind"), ReadState(Property(value, "Before") ?? throw Incompatible()),
        Read<int?>(value, "IncomingRequestId"), ReadVector(Property(value, "Position")), ReadVector(Property(value, "Velocity")),
        ReadEnum<Disposition>(value, "Disposition"));
}
