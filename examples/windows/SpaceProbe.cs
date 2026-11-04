using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using LabMotion.WinUI;
using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Input;
using Windows.System;
using Windows.UI.ViewManagement;

namespace LabUI.Buttons;

// Пассивная проверка закреплённого consumer: публичный API LabButton не расширяется.
internal sealed class SpaceProbe : IDisposable
{
    private sealed record Event(double ElapsedMs, double ReadStartedMs, string Kind, string? Key, bool Repeat,
        bool IsPressed, bool Focused, int Count, bool CurrentChannel, float Position);
    private sealed record Sample(double ElapsedMs, int ThreadId, MotionObservation Motion);
    private readonly LabButton button;
    private readonly Func<int> count;
    private readonly FieldInfo pressedField = typeof(LabButton).GetField("pressedMotion", BindingFlags.Instance | BindingFlags.NonPublic)
        ?? throw new InvalidOperationException("Закреплённая сборка не содержит pressedMotion.");
    private readonly long origin = Stopwatch.GetTimestamp();
    private readonly long processStartedAtUnixMs = new DateTimeOffset(Process.GetCurrentProcess().StartTime.ToUniversalTime()).ToUnixTimeMilliseconds();
    private readonly List<Event> events = [];
    private readonly List<Sample> samples = [];
    private readonly KeyEventHandler down;
    private readonly KeyEventHandler up;
    private ScalarMotion? channel;
    private long pressedToken;
    private volatile bool observing;
    private volatile bool disposed;
    private int overflow;
    private int generation;
    private int countBefore;
    private string theme = "";
    private string? failure;
    private bool animationsEnabled;
    private MotionObservation? requested;
    private MotionObservation? latest;

    internal SpaceProbe(LabButton button, Func<int> count)
    {
        this.button = button;
        this.count = count;
        down = (_, args) => Key("keyDown", args);
        up = (_, args) => Key("keyUp", args);
        // Console.In.ReadLineAsync может читать синхронно: reader никогда не занимает UI dispatcher.
        _ = Task.Run(async () =>
        {
            try { await SpaceProtocol.RunAsync(Console.OpenStandardInput(), Console.OpenStandardOutput(), Dispatch); }
            catch (Exception error) { failure = error.GetType().Name + ": " + error.Message; }
            finally
            {
                try { await Dispatch("dispose"); } catch { /* Window уже мог завершить dispatcher. */ }
            }
        });
    }

    private double Elapsed => (Stopwatch.GetTimestamp() - origin) * 1000d / Stopwatch.Frequency;
    private Task<object> Dispatch(string command)
    {
        var completion = new TaskCompletionSource<object>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!button.DispatcherQueue.TryEnqueue(() =>
        {
            try
            {
                if (command == "dispose") { Dispose(); completion.SetResult(new { status = "closed" }); }
                else if (disposed) throw new ObjectDisposedException(nameof(SpaceProbe));
                else completion.SetResult(command == "complete" ? Complete() : Arm(command[4..]));
            }
            catch (Exception error) { completion.SetException(error); }
        })) completion.SetException(new InvalidOperationException("Space потерял UI dispatcher."));
        return completion.Task;
    }

    private ScalarMotion Current() => pressedField.GetValue(button) as ScalarMotion
        ?? throw new InvalidOperationException("Нет pressed-канала кнопки.");
    private bool Focused => ReferenceEquals(FocusManager.GetFocusedElement(button.XamlRoot), button);

    private object Arm(string requestedTheme)
    {
        if (observing || !button.IsLoaded || button.IsPressed || !Focused || !button.IsEnabled || generation >= 2)
            throw new InvalidOperationException("Кнопка не готова к Space-наблюдению.");
        if (button.ActualTheme.ToString() != requestedTheme || (generation == 0 ? "Light" : "Dark") != requestedTheme)
            throw new InvalidOperationException("Неверный порядок тем Space.");
        channel = Current();
        theme = requestedTheme;
        animationsEnabled = new UISettings().AnimationsEnabled;
        countBefore = count();
        events.Clear();
        lock (samples) { samples.Clear(); requested = null; latest = null; }
        failure = null;
        overflow = 0;
        generation++;
        observing = true;
        channel.Observed += Motion;
        pressedToken = button.RegisterPropertyChangedCallback(LabButton.IsPressedProperty, Pressed);
        button.AddHandler(UIElement.KeyDownEvent, down, true);
        button.AddHandler(UIElement.KeyUpEvent, up, true);
        button.GotFocus += Focus;
        button.LostFocus += Focus;
        button.Click += Click;
        button.MotionFailed += Failed;
        Record("armed");
        return new { status = "armed", pid = Environment.ProcessId, theme, channel = generation,
            automationId = AutomationProperties.GetAutomationId(button), focused = Focused, countBefore,
            clockOriginTicks = origin.ToString(CultureInfo.InvariantCulture), clockFrequency = Stopwatch.Frequency, elapsedMs = Elapsed };
    }

    private void Key(string kind, KeyRoutedEventArgs args)
    {
        if (args.Key != VirtualKey.Space) { failure = "Посторонняя клавиша во время Space."; return; }
        Record(kind, args.Key.ToString(), args.KeyStatus.WasKeyDown);
    }
    private void Pressed(DependencyObject sender, DependencyProperty property) => Record("pressed");
    private void Focus(object sender, RoutedEventArgs args) => Record("focus");
    private void Click(object sender, RoutedEventArgs args) => Record("click");
    private void Failed(object? sender, Exception error) => failure = error.GetType().Name + ": " + error.Message;

    private void Record(string kind, string? key = null, bool repeat = false)
    {
        if (!observing) return;
        if (events.Count == 24) { overflow = 1; return; }
        var started = Elapsed;
        var position = channel!.Position;
        events.Add(new(Elapsed, started, kind, key, repeat, button.IsPressed, Focused, count(),
            ReferenceEquals(channel, Current()), position));
    }

    private void Motion(MotionObservation value)
    {
        lock (samples)
        {
            if (!observing) return;
            if (samples.Count == 128) { Interlocked.Exchange(ref overflow, 1); return; }
            samples.Add(new(Elapsed, Environment.CurrentManagedThreadId, value));
            if (value.Phase == "requested") requested = value;
            latest = value;
        }
    }

    private object Complete()
    {
        if (!observing) throw new InvalidOperationException("Space не подготовлен.");
        if (failure is not null || overflow != 0) throw new InvalidOperationException(failure ?? "Space потерял observations.");
        MotionObservation? final;
        MotionObservation? intent;
        lock (samples) { final = latest; intent = requested; }
        if (events.Count(item => item.Kind == "keyUp") < 2 || button.IsPressed || final is not { Phase: "idle" } settled ||
            intent is not { } current || settled.NativeRequestId != current.NativeRequestId || settled.Operation != current.Operation ||
            Math.Abs(settled.ReadbackPosition) > .001f || Math.Abs(channel!.Position) > .001f)
            return new { status = "waiting", pid = Environment.ProcessId, elapsedMs = Elapsed };
        Record("complete");
        Detach();
        Sample[] observations;
        lock (samples) observations = samples.ToArray();
        return new { schemaVersion = 1, status = "complete", pid = Environment.ProcessId, processStartedAtUnixMs,
            automationId = AutomationProperties.GetAutomationId(button), theme, channel = generation,
            animationsEnabled, countBefore, countAfter = count(), overflow, failure,
            clock = "app-stopwatch-ms", clockOriginTicks = origin.ToString(CultureInfo.InvariantCulture),
            clockFrequency = Stopwatch.Frequency, elapsedMs = Elapsed, positionKind = "asynchronous-readback", events, observations };
    }

    private void Detach()
    {
        if (!observing) return;
        observing = false;
        channel!.Observed -= Motion;
        button.UnregisterPropertyChangedCallback(LabButton.IsPressedProperty, pressedToken);
        button.RemoveHandler(UIElement.KeyDownEvent, down);
        button.RemoveHandler(UIElement.KeyUpEvent, up);
        button.GotFocus -= Focus;
        button.LostFocus -= Focus;
        button.Click -= Click;
        button.MotionFailed -= Failed;
    }

    public void Dispose() { Detach(); disposed = true; }
}
