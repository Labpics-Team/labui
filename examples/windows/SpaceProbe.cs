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
        bool IsPressed, bool Focused, int Count, bool CurrentChannel, float Position,
        int ObservationCount, long? Operation, int? NativeRequestId);
    private sealed record Sample(double ElapsedMs, int ThreadId, MotionObservation Motion);
    private readonly LabButton button;
    private readonly UIElement parent;
    private readonly Func<int> count;
    private readonly FieldInfo pressedField = typeof(LabButton).GetField("pressedMotion", BindingFlags.Instance | BindingFlags.NonPublic)
        ?? throw new InvalidOperationException("Закреплённая сборка не содержит pressedMotion.");
    private readonly long origin = Stopwatch.GetTimestamp();
    private readonly long processStartedAtUnixMs = new DateTimeOffset(Process.GetCurrentProcess().StartTime.ToUniversalTime()).ToUnixTimeMilliseconds();
    private readonly List<Event> events = [];
    private readonly List<Sample> samples = [];
    private readonly KeyEventHandler down;
    private readonly KeyEventHandler up;
    private readonly KeyEventHandler previewDown;
    private readonly KeyEventHandler previewUp;
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
    private Sample? firstDiscarded;
    private SpaceRawTrace.Snapshot? rawTrace;

    internal SpaceProbe(UIElement parent, LabButton button, Func<int> count)
    {
        this.parent = parent;
        this.button = button;
        this.count = count;
        down = (_, args) => Key("keyDown", args);
        up = (_, args) => Key("keyUp", args);
        previewDown = (_, args) => Key("previewKeyDown", args);
        previewUp = (_, args) => Key("previewKeyUp", args);
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
                else completion.SetResult(command switch {
                    "complete" => Complete(), "ready 1" => Ready(1), "ready 2" => Ready(2), _ => Arm(command[4..])
                });
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
        SpaceRawTrace.Begin(channel);
        rawTrace = null;
        theme = requestedTheme;
        animationsEnabled = new UISettings().AnimationsEnabled;
        countBefore = count();
        events.Clear();
        lock (samples) { samples.Clear(); requested = null; latest = null; firstDiscarded = null; }
        failure = null;
        overflow = 0;
        generation++;
        observing = true;
        channel.Observed += Motion;
        pressedToken = button.RegisterPropertyChangedCallback(LabButton.IsPressedProperty, Pressed);
        parent.AddHandler(UIElement.PreviewKeyDownEvent, previewDown, true);
        parent.AddHandler(UIElement.PreviewKeyUpEvent, previewUp, true);
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
        lock (samples)
        {
            var started = Elapsed;
            var isPressed = button.IsPressed;
            var currentChannel = ReferenceEquals(channel, Current());
            var position = channel!.Position;
            // Префикс observations сохраняет порядок с preview и при равных timestamps.
            events.Add(new(Elapsed, started, kind, key, repeat, isPressed, Focused, count(),
                currentChannel, position, samples.Count, latest?.Operation, latest?.NativeRequestId));
        }
    }

    private void Motion(MotionObservation value)
    {
        lock (samples)
        {
            if (!observing) return;
            if (samples.Count == 128)
            {
                firstDiscarded ??= new(Elapsed, Environment.CurrentManagedThreadId, value);
                Interlocked.Exchange(ref overflow, 1);
                return;
            }
            samples.Add(new(Elapsed, Environment.CurrentManagedThreadId, value));
            if (value.Phase == "requested") requested = value;
            latest = value;
        }
    }

    // Запрос лишь наблюдает уже обработанный edge. Позднее состояние ввода всё равно проверяет полный trace.
    private object Ready(int step)
    {
        if (!observing || disposed) throw new InvalidOperationException("Space не подготовлен.");
        if (step is not (1 or 2)) throw new ArgumentOutOfRangeException(nameof(step));
        lock (samples)
        {
            var keys = events.Where(item => item.Kind is "keyDown" or "keyUp").ToArray();
            var intents = samples.Where(item => item.Motion.Phase == "requested").ToArray();
            var intent = requested;
            var position = channel!.Position;
            string? reason = failure;
            if (overflow != 0) reason ??= "Space переполнил наблюдение.";
            if (!button.IsLoaded || !button.IsEnabled || !Focused || !ReferenceEquals(channel, Current()) ||
                button.ActualTheme.ToString() != theme)
                reason ??= "Space потерял исходную кнопку или канал.";
            if (keys.Length > step || intents.Length > step || keys.Where((item, index) =>
                item.Kind != (index == 0 ? "keyDown" : "keyUp") || item.Key != "Space" ||
                item.Kind == "keyDown" && item.Repeat || !item.CurrentChannel || !item.Focused).Any())
                reason ??= "Space получил другой порядок клавиш или запросов.";
            var ready = false;
            if (reason is null && keys.Length == step && intents.Length == step && intent is { } current)
            {
                var key = keys[^1];
                var currentSamples = samples.Skip(samples.IndexOf(intents[^1]) + 1)
                    .Where(item => SameRequest(item.Motion, current)).ToArray();
                if (key.Operation != current.Operation || key.NativeRequestId != current.NativeRequestId ||
                    button.IsPressed != (step == 1))
                    reason = "Space не подтвердил запрос обработанной клавиши.";
                else if (animationsEnabled)
                {
                    if (current.Origin != MotionOrigin.Animation || currentSamples.Any(item => item.Motion.Phase == "idle"))
                        reason = "Space уже завершил движение до прерывания.";
                    else ready = currentSamples.Any(item => item.Motion.Phase is "value" or "inertia") &&
                        float.IsFinite(position) && position > .001f && position < .999f;
                }
                else
                {
                    var target = step == 1 ? 1f : 0f;
                    ready = current.Origin == MotionOrigin.Snap && current.Operation == 0 &&
                        latest is { Phase: "value" or "idle" } snap && SameRequest(snap, current) &&
                        Math.Abs(snap.Position - target) <= .001f && Math.Abs(snap.ReadbackPosition - target) <= .001f &&
                        Math.Abs(position - target) <= .001f;
                }
            }
            return new { schemaVersion = 1, status = reason is not null ? "failed" : ready ? "ready" : "waiting",
                pid = Environment.ProcessId, processStartedAtUnixMs, theme, channel = generation, step,
                automationId = AutomationProperties.GetAutomationId(button), animationsEnabled,
                clockOriginTicks = origin.ToString(CultureInfo.InvariantCulture), clockFrequency = Stopwatch.Frequency,
                elapsedMs = Elapsed, operation = intent?.Operation, nativeRequestId = intent?.NativeRequestId,
                origin = intent?.Origin.ToString(), position, observationCount = samples.Count, reason,
                rawTrace = reason is null ? ReadRawTrace() : null,
                diagnostic = reason is null ? null : Snapshot("failed") };
        }
    }

    private static bool SameRequest(MotionObservation left, MotionObservation right) =>
        left.Operation == right.Operation && left.NativeRequestId == right.NativeRequestId && left.Origin == right.Origin;

    private object Complete()
    {
        if (!observing) throw new InvalidOperationException("Space не подготовлен.");
        if (failure is not null || overflow != 0)
        {
            Detach();
            return Snapshot("failed");
        }
        MotionObservation? final;
        MotionObservation? intent;
        Sample? lastIdle;
        int observationCount;
        lock (samples)
        {
            final = latest; intent = requested; observationCount = samples.Count;
            lastIdle = intent is { } observedRequest ? samples.LastOrDefault(item => item.Motion.Phase == "idle" &&
                item.Motion.Operation == observedRequest.Operation && item.Motion.NativeRequestId == observedRequest.NativeRequestId) : null;
        }
        var keyUpCount = events.Count(item => item.Kind == "keyUp");
        var isPressed = button.IsPressed;
        var position = channel!.Position;
        // Snap из idle меняет координату без нового перехода состояния; value подтверждает запрос.
        var terminalObserved = animationsEnabled ? final is { Phase: "idle" } :
            final is { Origin: MotionOrigin.Snap, Operation: 0, Phase: "value" or "idle" } snap &&
            intent is { Origin: MotionOrigin.Snap, Operation: 0 } &&
            Math.Abs(snap.Position) <= .001f && Math.Abs(snap.ReadbackPosition) <= .001f && Math.Abs(position) <= .001f;
        if (keyUpCount < 2 || isPressed || !terminalObserved || final is not { } settled ||
            intent is not { } current || settled.NativeRequestId != current.NativeRequestId || settled.Operation != current.Operation ||
            Math.Abs(settled.ReadbackPosition) > .001f || Math.Abs(position) > .001f)
            return new { status = "waiting", pid = Environment.ProcessId, processStartedAtUnixMs,
                theme, channel = generation, elapsedMs = Elapsed, rawTrace = ReadRawTrace(),
                state = new { eventCount = events.Count, observationCount, keyUpCount, isPressed, position,
                    requested = intent, latest = final, lastIdle } };
        Record("complete");
        Detach();
        return Snapshot(overflow == 0 ? "complete" : "failed");
    }

    // Ошибка сохраняет тот же ограниченный trace; status=failed не допускается валидатором.
    private object Snapshot(string status)
    {
        Sample[] observations;
        Sample? discarded;
        lock (samples) { observations = samples.ToArray(); discarded = firstDiscarded; }
        return new { schemaVersion = 1, status, pid = Environment.ProcessId, processStartedAtUnixMs,
            automationId = AutomationProperties.GetAutomationId(button), theme, channel = generation,
            animationsEnabled, countBefore, countAfter = count(), overflow, failure,
            clock = "app-stopwatch-ms", clockOriginTicks = origin.ToString(CultureInfo.InvariantCulture),
            clockFrequency = Stopwatch.Frequency, elapsedMs = Elapsed, positionKind = "asynchronous-readback", events = events.ToArray(), observations,
            firstDiscarded = discarded, rawTrace = ReadRawTrace() };
    }

    private SpaceRawTrace.Snapshot ReadRawTrace() => rawTrace ?? SpaceRawTrace.Capture(channel!);

    private void Detach()
    {
        if (!observing) return;
        observing = false;
        channel!.Observed -= Motion;
        button.UnregisterPropertyChangedCallback(LabButton.IsPressedProperty, pressedToken);
        parent.RemoveHandler(UIElement.PreviewKeyDownEvent, previewDown);
        parent.RemoveHandler(UIElement.PreviewKeyUpEvent, previewUp);
        button.RemoveHandler(UIElement.KeyDownEvent, down);
        button.RemoveHandler(UIElement.KeyUpEvent, up);
        button.GotFocus -= Focus;
        button.LostFocus -= Focus;
        button.Click -= Click;
        button.MotionFailed -= Failed;
        rawTrace = SpaceRawTrace.Capture(channel!, stop: true);
    }

    public void Dispose() { Detach(); disposed = true; }
}
