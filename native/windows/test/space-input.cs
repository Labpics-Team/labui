using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Threading;

// Только harness. Времена удержания создают историю ввода, а не политику кнопки.
public static class SpaceInput
{
    public sealed class InputEvent
    {
        public bool keyDown { get; set; }
        public string startedTicks { get; set; }
        public string completedTicks { get; set; }
        public uint accepted { get; set; }
    }

    public sealed class Receipt
    {
        public int pid { get; set; }
        public long window { get; set; }
        public long clockFrequency { get; set; }
        public string startedTicks { get; set; }
        public string completedTicks { get; set; }
        public InputEvent[] events { get; set; }
    }

    internal interface Platform
    {
        long Timestamp { get; }
        long Frequency { get; }
        long Foreground { get; }
        long Root(long window);
        int Process(long window);
        bool IsDown(int key);
        uint Send(bool down);
        int LastError { get; }
        void Delay(int milliseconds);
    }

    private const int Space = 0x20;
    private static readonly int[] Modifiers = { 0x10, 0x11, 0x12, 0x5b, 0x5c };

    public static Receipt Run(int processId, long window)
    {
        if (Environment.GetEnvironmentVariable("GITHUB_ACTIONS") != "true" ||
            Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT") != "github-hosted")
            throw new InvalidOperationException("Space input разрешён только на одноразовом GitHub hosted runner.");
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) || IntPtr.Size != 8)
            throw new PlatformNotSupportedException("Space input требует Windows x64.");
        return Run(new NativePlatform(), processId, window);
    }

    internal static Receipt Run(Platform platform, int processId, long window)
    {
        if (processId <= 0 || window <= 0 || platform.Frequency <= 0)
            throw new ArgumentOutOfRangeException("Недопустимая identity ввода.");
        long started = platform.Timestamp;
        var receipt = new Receipt { pid = processId, window = window,
            clockFrequency = platform.Frequency, startedTicks = Ticks(started) };
        var events = new List<InputEvent>(5);
        bool ownedHold = false;
        Exception failure = null;
        try
        {
            CheckWindow(platform, processId, window);
            if (platform.IsDown(Space)) throw new InvalidOperationException("Space уже удерживается до проверки.");
            var delays = new[] { 80, 50, 80, 0 };
            for (int index = 0; index < delays.Length; index++)
            {
                CheckWindow(platform, processId, window);
                foreach (var key in Modifiers)
                    if (platform.IsDown(key)) throw new InvalidOperationException("Модификатор клавиатуры удерживается во время Space.");
                if ((platform.Timestamp - started) / (double)platform.Frequency > 5)
                    throw new TimeoutException("Space sequence превысила бюджет 5 секунд.");
                bool down = index % 2 == 0;
                if (down && platform.IsDown(Space))
                    throw new InvalidOperationException("Space удерживается перед новым down.");
                var input = Send(platform, down, ref ownedHold);
                events.Add(input);
                if (input.accepted != 1)
                    throw new InvalidOperationException("SendInput принял " + input.accepted + " вместо одного события; Win32=" + platform.LastError + ".");
                if (delays[index] != 0) platform.Delay(delays[index]);
            }
            CheckWindow(platform, processId, window);
        }
        catch (Exception error) { failure = error; }
        finally
        {
            // Даже после потери focus отпускаем только собственное принятое нажатие.
            // Повторного down нет; cleanup содержит не более одного up.
            if (ownedHold)
            {
                try
                {
                    var release = Send(platform, false, ref ownedHold);
                    events.Add(release);
                    if (release.accepted != 1)
                        throw new InvalidOperationException("Cleanup Space up не принят; Win32=" + platform.LastError + ".");
                }
                catch (Exception cleanup)
                {
                    if (failure == null) failure = cleanup;
                    else failure.Data["spaceInputCleanupError"] = cleanup.ToString();
                }
            }
            receipt.completedTicks = Ticks(platform.Timestamp);
            receipt.events = events.ToArray();
        }
        if (failure != null)
        {
            failure.Data["spaceInputReceipt"] = receipt;
            failure.Data["spaceInputStillHeld"] = ownedHold;
            ExceptionDispatchInfo.Capture(failure).Throw();
        }
        return receipt;
    }

    private static InputEvent Send(Platform platform, bool down, ref bool ownedHold)
    {
        var result = new InputEvent { keyDown = down, startedTicks = Ticks(platform.Timestamp) };
        result.accepted = platform.Send(down);
        if (result.accepted == 1) ownedHold = down;
        result.completedTicks = Ticks(platform.Timestamp);
        return result;
    }

    private static string Ticks(long value) { return value.ToString(CultureInfo.InvariantCulture); }

    private static void CheckWindow(Platform platform, int processId, long window)
    {
        var foreground = platform.Foreground;
        if (foreground == 0 || platform.Root(window) != window ||
            platform.Root(foreground) != window || platform.Process(window) != processId ||
            platform.Process(foreground) != processId)
            throw new InvalidOperationException("Foreground не принадлежит исходному окну и процессу.");
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct KeyboardInput
    {
        public ushort virtualKey, scan;
        public uint flags, time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct MouseInput
    {
        public int x, y;
        public uint data, flags, time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    internal struct InputUnion
    {
        [FieldOffset(0)] public KeyboardInput keyboard;
        [FieldOffset(0)] public MouseInput mouse;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct NativeInput
    {
        public uint type;
        public InputUnion data;
    }

    internal static NativeInput Packet(bool down)
    {
        return new NativeInput { type = 1, data = new InputUnion {
            keyboard = new KeyboardInput { virtualKey = Space, flags = down ? 0u : 2u }
        } };
    }

    private sealed class NativePlatform : Platform
    {
        public long Timestamp { get { return Stopwatch.GetTimestamp(); } }
        public long Frequency { get { return Stopwatch.Frequency; } }
        public long Foreground { get { return GetForegroundWindow().ToInt64(); } }
        public long Root(long window) { return GetAncestor(new IntPtr(window), 2).ToInt64(); }
        public int Process(long window)
        {
            uint pid;
            return GetWindowThreadProcessId(new IntPtr(window), out pid) == 0 ? 0 : checked((int)pid);
        }
        public bool IsDown(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
        public int LastError { get; private set; }
        public uint Send(bool down)
        {
            int size = Marshal.SizeOf(typeof(NativeInput));
            if (size != 40) throw new InvalidOperationException("INPUT не соответствует Windows x64 ABI.");
            uint accepted = SendInput(1, new[] { Packet(down) }, size);
            LastError = Marshal.GetLastWin32Error();
            return accepted;
        }
        public void Delay(int milliseconds) { Thread.Sleep(milliseconds); }
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, [In] NativeInput[] inputs, int size);
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int key);
}
