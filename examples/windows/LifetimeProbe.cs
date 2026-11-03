using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using LabMotion.WinUI;
using LabUI.WinUI;
using Microsoft.UI.Composition;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Hosting;
using Microsoft.UI.Xaml.Media;

namespace LabUI.Buttons;

// Проверка закреплённой сборки примера. Reflection не входит в API LabUI:
// отсутствие ожидаемого поля прерывает probe, а не подменяет наблюдение.
internal sealed class LifetimeProbe : IDisposable
{
    // Допуск CreateProgress из квалификации закреплённого LabMotion, не новая калибровка UI.
    private const float ProgressTolerance = .001f;
    private enum Phase { Ready, Armed, Removing, Removed, Restoring, Restored, Completing, Passed, Failed }
    private sealed record Sample(double ElapsedMs, int ThreadId, string Generation, string Channel, MotionObservation Motion);
    private sealed record Event(double ElapsedMs, long UnixMs, string Kind, object Data);
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        IncludeFields = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly string path;
    private readonly LabButton button;
    private readonly Panel parent;
    private readonly TextBlock status;
    private readonly Func<int> activationCount;
    private readonly DispatcherQueue dispatcher;
    private readonly FieldInfo hoverField;
    private readonly FieldInfo pressedField;
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly DispatcherTimer deadline = new() { Interval = TimeSpan.FromMilliseconds(200) };
    private readonly List<Sample> samples = [];
    private readonly List<Event> events = [];
    private volatile Phase phase;
    private volatile bool detached;
    private bool cleaned;
    private double expiresAtMs;
    private int removeQueued;
    private int lateObservations;
    private int overflow;
    private int originalIndex;
    private int countBefore;
    private int restoredClicks;
    private double? detachedAtMs;
    private string? failure;
    private ScalarMotion? oldHover;
    private ScalarMotion? oldPressed;
    private ScalarMotion? newHover;
    private ScalarMotion? newPressed;
    private FrameworkElement? layers;
    private Visual? oldContainer;

    internal LifetimeProbe(string path, LabButton button, Panel parent, TextBlock status, Func<int> activationCount)
    {
        if (string.IsNullOrWhiteSpace(path) || File.Exists(path))
            throw new InvalidOperationException("Lifetime probe требует новый путь наблюдения.");
        this.path = path;
        this.button = button;
        this.parent = parent;
        this.status = status;
        this.activationCount = activationCount;
        dispatcher = button.DispatcherQueue;
        hoverField = Field("hoverMotion");
        pressedField = Field("pressedMotion");
        button.Loaded += Loaded;
        button.Unloaded += Unloaded;
        button.MotionFailed += MotionFailed;
        deadline.Tick += Deadline;
        Publish();
    }

    private static FieldInfo Field(string name) => typeof(LabButton).GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)
        ?? throw new InvalidOperationException($"Закреплённая сборка не содержит {name}.");

    internal void Arm() => Run(() =>
    {
        Require(phase == Phase.Ready && button.IsLoaded && !button.IsPressed, "Кнопка не готова к одному lifetime сценарию.");
        originalIndex = parent.Children.IndexOf(button);
        Require(originalIndex >= 0, "Кнопка не принадлежит ожидаемому Panel.");
        oldHover = Channel(hoverField);
        oldPressed = Channel(pressedField);
        layers = FindLayers(button) ?? throw new InvalidOperationException("PART_Layers не найден.");
        oldContainer = ElementCompositionPreview.GetElementChildVisual(layers);
        Require(oldContainer is not null && !ReferenceEquals(oldHover, oldPressed), "Нет двух каналов и hand-in visual.");
        countBefore = activationCount();
        oldHover.Observed += OldHover;
        oldPressed.Observed += OldPressed;
        Add("armed", new { countBefore, index = originalIndex, hover = oldHover.Position, pressed = oldPressed.Position });
        Transition(Phase.Armed);
    });

    private ScalarMotion Channel(FieldInfo field) => field.GetValue(button) as ScalarMotion
        ?? throw new InvalidOperationException($"Отсутствует канал {field.Name}.");

    private void OldHover(MotionObservation value) => Observe("old", "hover", value);
    private void OldPressed(MotionObservation value) => Observe("old", "pressed", value);
    private void NewHover(MotionObservation value) => Observe("new", "hover", value);
    private void NewPressed(MotionObservation value) => Observe("new", "pressed", value);

    private void Observe(string generation, string channel, MotionObservation value)
    {
        lock (samples)
        {
            // Final snapshot закрывает только этот наблюдённый интервал.
            if (phase is Phase.Passed or Phase.Failed) return;
            if (generation == "old" && detached) lateObservations++;
            if (samples.Count < 512)
                samples.Add(new(clock.Elapsed.TotalMilliseconds, Environment.CurrentManagedThreadId, generation, channel, value));
            else if (Interlocked.Exchange(ref overflow, 1) == 0)
                Queue(() => throw new InvalidOperationException("Превышен полный бюджет lifetime observations."));
        }
        if (phase == Phase.Armed && generation == "old" && channel == "pressed"
            && value.Origin == MotionOrigin.Animation && value.Phase == "value"
            && value.ReadbackPosition > 0 && value.ReadbackPosition < 1
            && Interlocked.CompareExchange(ref removeQueued, 1, 0) == 0)
            Queue(RemoveDuringPress);
    }

    private void RemoveDuringPress()
    {
        var wasLoaded = button.IsLoaded;
        var wasPressed = button.IsPressed;
        Require(phase == Phase.Armed && wasLoaded && wasPressed, "Удаление не застало активное нажатие.");
        Require(ReferenceEquals(Channel(hoverField), oldHover) && ReferenceEquals(Channel(pressedField), oldPressed),
            "Каналы сменились до удаления.");
        var count = activationCount();
        Require(count == countBefore, "До удаления появилась активация.");
        phase = Phase.Removing;
        var position = oldPressed!.Position;
        var positionReadAtMs = clock.Elapsed.TotalMilliseconds;
        Require(position > 0 && position < 1, "К моменту удаления переход уже не находится внутри диапазона.");
        var removeStartedMs = clock.Elapsed.TotalMilliseconds;
        var removed = parent.Children.Remove(button);
        var removeCompletedMs = clock.Elapsed.TotalMilliseconds;
        Require(removed, "Panel не удалил проверяемый экземпляр.");
        // Публикация не стоит между последним readback и удалением.
        // Эти границы не превращают асинхронный Composition readback в атомарный.
        Add("removing", new { isLoaded = wasLoaded, isPressed = wasPressed, pressed = position, count,
            positionReadAtMs, removeStartedMs, removeCompletedMs });
        // CheckDetached публикует весь этап после фактического Unloaded.
    }

    private void Unloaded(object sender, RoutedEventArgs args)
    {
        if (phase != Phase.Removing) return;
        var eventAtMs = clock.Elapsed.TotalMilliseconds;
        var eventAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (samples)
        {
            detachedAtMs = eventAtMs;
            detached = true;
        }
        Queue(() =>
        {
            Add("unloaded", new { eventAtMs, eventAtUnixMs });
            CheckDetached();
        });
    }

    private void CheckDetached()
    {
        Require(phase == Phase.Removing && !button.IsLoaded && !parent.Children.Contains(button), "Unloaded не подтвердил отключение.");
        Require(hoverField.GetValue(button) is null && pressedField.GetValue(button) is null, "Старые каналы остались у кнопки.");
        var containerAbsent = ElementCompositionPreview.GetElementChildVisual(layers!) is null;
        var hoverRejected = RejectsPosition(oldHover!);
        var pressedRejected = RejectsPosition(oldPressed!);
        Require(containerAbsent && hoverRejected && pressedRejected, "Удаление не освободило visual или motion.");
        Require(activationCount() == countBefore, "Удаление вызвало активацию.");
        Add("detached", new { isLoaded = button.IsLoaded, containerAbsent, hoverRejected, pressedRejected, count = activationCount() });
        Transition(Phase.Removed);
    }

    private static bool RejectsPosition(ScalarMotion motion)
    {
        try { _ = motion.Position; return false; }
        catch (ObjectDisposedException) { return true; }
    }

    internal void Restore() => Run(() =>
    {
        Require(phase == Phase.Removed && !button.IsLoaded, "Возврат допустим только после подтверждённого удаления.");
        Require(activationCount() == countBefore, "До возврата появилась активация.");
        Add("restoring", new { count = activationCount() });
        Transition(Phase.Restoring);
        parent.Children.Insert(originalIndex, button);
    });

    private void Loaded(object sender, RoutedEventArgs args)
    {
        if (phase != Phase.Restoring) return;
        var eventAtMs = clock.Elapsed.TotalMilliseconds;
        var eventAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        Queue(() =>
        {
            Add("loaded", new { eventAtMs, eventAtUnixMs });
            CheckRestored();
        });
    }

    private void CheckRestored()
    {
        Require(phase == Phase.Restoring && button.IsLoaded && parent.Children.IndexOf(button) == originalIndex,
            "Loaded не подтвердил возврат того же экземпляра.");
        newHover = Channel(hoverField);
        newPressed = Channel(pressedField);
        var currentLayers = FindLayers(button) ?? throw new InvalidOperationException("После возврата нет PART_Layers.");
        var container = ElementCompositionPreview.GetElementChildVisual(currentLayers);
        var freshHover = !ReferenceEquals(newHover, oldHover) && !ReferenceEquals(newHover, oldPressed);
        var freshPressed = !ReferenceEquals(newPressed, oldHover) && !ReferenceEquals(newPressed, oldPressed);
        var containerPresent = container is not null;
        var freshContainerReference = containerPresent && !ReferenceEquals(container, oldContainer);
        Require(freshHover && freshPressed && !ReferenceEquals(newHover, newPressed) && freshContainerReference,
            "Повторное подключение переиспользовало освобождённые ресурсы.");
        newHover.Observed += NewHover;
        newPressed.Observed += NewPressed;
        Add("restored", new { isLoaded = button.IsLoaded, freshHover, freshPressed, containerPresent,
            freshContainerReference, containerIdentityScope = "managed-reference", count = activationCount() });
        Transition(Phase.Restored);
    }

    internal void Activated(object sender)
    {
        if (!ReferenceEquals(sender, button) || phase is Phase.Ready or Phase.Passed or Phase.Failed) return;
        Run(() =>
        {
            Require(phase == Phase.Restored, "Активация появилась до проверенного возврата.");
            restoredClicks++;
            Add("activated", new { restoredClicks, count = activationCount() });
            Require(restoredClicks == 1 && activationCount() == countBefore + 1, "После возврата число активаций неверно.");
            Publish();
        });
    }

    internal async void Complete()
    {
        if (phase == Phase.Failed) return;
        try
        {
            Require(phase == Phase.Restored && restoredClicks == 1, "Нет ровно одной реальной активации после возврата.");
            Transition(Phase.Completing);
            while (!NewPressSettled())
            {
                Require(phase == Phase.Completing, "Проверка была прервана до завершения.");
                await Task.Delay(20);
            }
            var quietFromMs = clock.Elapsed.TotalMilliseconds;
            do { await Task.Delay(20); } while (clock.Elapsed.TotalMilliseconds - quietFromMs < 120);
            Require(dispatcher.HasThreadAccess && phase == Phase.Completing, "Проверка потеряла UI owner или завершилась отказом.");
            Require(!button.IsPressed && restoredClicks == 1 && activationCount() == countBefore + 1,
                "Конечное состояние или число активаций изменилось.");
            Require(NewPressSettled(), "Pressed-канал не сохранил отпускание к концу окна наблюдения.");
            var releasedPosition = newPressed!.Position;
            Require(Math.Abs(releasedPosition) <= ProgressTolerance, "Конечный readback нового pressed-канала не вернулся к нулю.");
            Require(RejectsPosition(oldHover!) && RejectsPosition(oldPressed!), "Старый канал снова доступен.");
            lock (samples)
            {
                Require(lateObservations == 0 && Volatile.Read(ref overflow) == 0,
                    "Старый канал продолжил наблюдения либо trace потерял данные.");
                var completedAtMs = clock.Elapsed.TotalMilliseconds;
                Add("completed", new { countBefore, countAfter = activationCount(), lateObservations,
                    oldObservationWindowStartMs = detachedAtMs, oldObservationWindowEndMs = completedAtMs,
                    quietFromMs, quietUntilMs = completedAtMs, releasedPosition, releaseTolerance = ProgressTolerance });
                Transition(Phase.Passed);
                Cleanup();
            }
        }
        catch (Exception error) { Fail(error); }
    }

    private bool NewPressSettled()
    {
        Require(dispatcher.HasThreadAccess, "Проверка должна выполняться на UI dispatcher.");
        Require(ReferenceEquals(Channel(hoverField), newHover) && ReferenceEquals(Channel(pressedField), newPressed),
            "Повторно подключённые каналы неожиданно сменились.");
        lock (samples)
        {
            var pressed = samples.Where(x => x.Generation == "new" && x.Channel == "pressed").ToArray();
            var last = pressed.LastOrDefault();
            return pressed.Any(x => x.Motion.Origin == MotionOrigin.Animation && x.Motion.Phase == "value"
                && x.Motion.ReadbackPosition > 0 && x.Motion.ReadbackPosition < 1)
                && last is not null && last.Motion.Origin == MotionOrigin.Animation && last.Motion.Phase == "idle"
                && Math.Abs(last.Motion.ReadbackPosition) <= ProgressTolerance
                && Math.Abs(newPressed!.Position) <= ProgressTolerance && !button.IsPressed;
        }
    }

    private static FrameworkElement? FindLayers(DependencyObject parent)
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is FrameworkElement { Name: "PART_Layers" } found) return found;
            if (FindLayers(child) is { } nested) return nested;
        }
        return null;
    }

    private void MotionFailed(object? sender, Exception error) => Fail(error);
    private void Queue(Action action)
    {
        if (!dispatcher.TryEnqueue(() => Run(action)))
            throw new InvalidOperationException("Lifetime probe не смог поставить действие на UI dispatcher.");
    }

    private void Run(Action action)
    {
        if (phase == Phase.Failed) return;
        try { Require(dispatcher.HasThreadAccess, "Проверка потеряла UI owner."); action(); }
        catch (Exception error) { Fail(error); }
    }

    private void Transition(Phase next)
    {
        phase = next;
        expiresAtMs = clock.Elapsed.TotalMilliseconds + 15000;
        if (next is Phase.Passed or Phase.Failed) deadline.Stop();
        else deadline.Start();
        Publish();
    }

    private void Deadline(object? sender, object args)
    {
        if (clock.Elapsed.TotalMilliseconds >= expiresAtMs)
            Fail(new TimeoutException($"Lifetime probe не завершил {phase} за 15 секунд."));
    }

    private void Add(string kind, object data)
    {
        Require(events.Count < 64, "Превышен полный бюджет lifecycle events.");
        events.Add(new(clock.Elapsed.TotalMilliseconds, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), kind, data));
    }

    private void Publish()
    {
        Sample[] observations;
        lock (samples) observations = samples.ToArray();
        var value = new { schemaVersion = 1, pid = Environment.ProcessId,
            observedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), elapsedMs = clock.Elapsed.TotalMilliseconds,
            status = phase.ToString().ToLowerInvariant(), failure, countBefore, countNow = activationCount(),
            restoredClicks, lateObservations, events, observations };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        Require(bytes.Length <= 256 * 1024, "Lifetime observation превышает лимит evidence JSON.");
        using (var stream = new FileStream(path + ".tmp", FileMode.CreateNew, FileAccess.Write)) stream.Write(bytes);
        File.Move(path + ".tmp", path, true);
        status.Text = value.status;
    }

    private void Fail(Exception error)
    {
        if (phase is Phase.Failed or Phase.Passed) return;
        failure = error.ToString();
        phase = Phase.Failed;
        Cleanup();
        Publish();
    }

    private void Cleanup()
    {
        if (cleaned) return;
        cleaned = true;
        deadline.Stop();
        deadline.Tick -= Deadline;
        button.Loaded -= Loaded;
        button.Unloaded -= Unloaded;
        button.MotionFailed -= MotionFailed;
        if (oldHover is not null) oldHover.Observed -= OldHover;
        if (oldPressed is not null) oldPressed.Observed -= OldPressed;
        if (newHover is not null) newHover.Observed -= NewHover;
        if (newPressed is not null) newPressed.Observed -= NewPressed;
    }

    public void Dispose()
    {
        if (phase is not (Phase.Passed or Phase.Failed)) Fail(new InvalidOperationException("Пример выгружен до завершения lifetime probe."));
        Cleanup();
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
