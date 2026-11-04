using LabMotion.WinUI;
using Microsoft.UI.Xaml.Automation;
using Windows.UI.ViewManagement;

namespace LabUI.Buttons;

internal sealed partial class SpaceProbe
{
    private const string DynamicScenario = "dynamic-reduced-motion";
    private sealed record Setting(string Kind, double ReadStartedMs, double ElapsedMs,
        bool AnimationsEnabled, int ObservationCount);
    private sealed record SettingMutation(double StartedMs, double CompletedMs, bool Readback,
        int UiThreadId, int ThreadId);
    private readonly bool allowDynamic = Environment.GetEnvironmentVariable("LABUI_DYNAMIC_MOTION_OBSERVATION") == "1";
    private readonly List<Setting> settings = [];
    private UISettings? settingObserver;
    private SettingMutation? settingMutation;
    private bool dynamicMotion;
    private bool disableAttempted;
    private int mutationUiThread;

    private object DynamicCommand(string command)
    {
        if (!allowDynamic) throw new InvalidOperationException("Динамическая проба не включена.");
        if (command == "dynamic arm")
        {
            if (generation != 2 || observing || dynamicMotion || !new UISettings().AnimationsEnabled)
                throw new InvalidOperationException("Динамическая проба требует завершённых двух static-проб и включённой анимации.");
            dynamicMotion = true;
            var armed = Arm("Dark");
            settingObserver = new UISettings();
            settingObserver.AnimationsEnabledChanged += SettingsChanged;
            RecordSetting("armed");
            return new { schemaVersion = 1, scenario = DynamicScenario, pid = Environment.ProcessId, armed };
        }
        if (!dynamicMotion || !observing) throw new InvalidOperationException("Динамическая проба не подготовлена.");
        if (command == "dynamic prepare")
            return new { schemaVersion = 1, scenario = DynamicScenario, pid = Environment.ProcessId, readiness = Ready(1) };
        if (command == "dynamic before")
        {
            lock (samples)
            {
                var intents = samples.Where(item => item.Motion.Phase == "requested").ToArray();
                var keys = events.Where(item => item.Kind is "keyDown" or "keyUp").ToArray();
                var position = channel!.Position;
                if (disableAttempted || failure is not null || overflow != 0 || !button.IsLoaded || !button.IsEnabled ||
                    !Focused || !button.IsPressed || !ReferenceEquals(channel, Current()) || button.ActualTheme.ToString() != theme ||
                    !settingObserver!.AnimationsEnabled || keys.Length != 1 || keys[0].Kind != "keyDown" || keys[0].Repeat ||
                    intents.Length != 1 || requested is not { Origin: MotionOrigin.Animation } intent ||
                    keys[0].Operation != intent.Operation || keys[0].NativeRequestId != intent.NativeRequestId ||
                    !samples.Any(item => SameRequest(item.Motion, intent) && item.Motion.Phase is "value" or "inertia") ||
                    samples.Any(item => SameRequest(item.Motion, intent) && item.Motion.Phase == "idle") ||
                    !float.IsFinite(position) || position <= .001f || position >= .999f)
                    throw new InvalidOperationException("Изменение настройки не застало исходное движение.");
                Record("dynamic-before");
                disableAttempted = true;
                mutationUiThread = Environment.CurrentManagedThreadId;
                return new { status = "prepared" };
            }
        }
        if (command is "dynamic ready 1" or "dynamic ready 2")
            return new { schemaVersion = 1, scenario = DynamicScenario, pid = Environment.ProcessId,
                readiness = DynamicReady(command[^1] - '0') };
        if (command == "dynamic complete")
        {
            var trace = Complete();
            lock (samples)
                return new { schemaVersion = 1, scenario = DynamicScenario, pid = Environment.ProcessId,
                    status = observing ? "waiting" : failure is not null || overflow != 0 ? "failed" : "complete",
                    trace, settings = settings.ToArray(), mutation = settingMutation };
        }
        throw new InvalidOperationException("Неизвестная динамическая команда.");
    }

    // SPI может блокироваться на рассылке. Он выполняется в управляемом child, вне UI и родительского ввода.
    private async Task<object> DisableAnimationAsync()
    {
        if (!allowDynamic || Environment.GetEnvironmentVariable("GITHUB_ACTIONS") != "true" ||
            Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT") != "github-hosted")
            throw new InvalidOperationException("Изменение настройки разрешено только собственной hosted-пробе.");
        await Dispatch("dynamic before").ConfigureAwait(false);
        var thread = Environment.CurrentManagedThreadId;
        if (thread == mutationUiThread) throw new InvalidOperationException("SPI не должен занимать UI dispatcher.");
        var start = Elapsed;
        ClientAreaAnimation.Write(false);
        var actual = ClientAreaAnimation.Read();
        lock (samples) settingMutation = new(start, Elapsed, actual, mutationUiThread, thread);
        if (actual) throw new InvalidOperationException("Настройка анимации не отключилась.");
        return new { schemaVersion = 1, scenario = DynamicScenario, pid = Environment.ProcessId,
            status = "disabled", mutation = settingMutation };
    }

    private object DynamicReady(int step)
    {
        lock (samples)
        {
            var keys = events.Where(item => item.Kind is "keyDown" or "keyUp").ToArray();
            var intents = samples.Where(item => item.Motion.Phase == "requested").ToArray();
            var target = step == 1 ? 1f : 0f;
            var position = channel!.Position;
            string? reason = failure;
            if (overflow != 0 || !button.IsLoaded || !button.IsEnabled || !Focused ||
                !ReferenceEquals(channel, Current()) || button.ActualTheme.ToString() != theme ||
                keys.Length > step || intents.Length > step + 1)
                reason ??= "Динамическая проба потеряла текущую кнопку или порядок ввода.";
            var ready = reason is null && settingMutation is { Readback: false } &&
                settings.Any(item => item.Kind == "changed" && !item.AnimationsEnabled) &&
                !settingObserver!.AnimationsEnabled && keys.Length == step && intents.Length == step + 1 &&
                button.IsPressed == (step == 1) && requested is { Origin: MotionOrigin.Snap, Operation: 0 } current &&
                latest is { Phase: "value" or "idle", Origin: MotionOrigin.Snap } snap && SameRequest(snap, current) &&
                Math.Abs(snap.Position - target) <= .001f && Math.Abs(snap.ReadbackPosition - target) <= .001f &&
                float.IsFinite(position) && Math.Abs(position - target) <= .001f;
            return new { schemaVersion = 1, status = reason is not null ? "failed" : ready ? "ready" : "waiting",
                pid = Environment.ProcessId, processStartedAtUnixMs, theme, channel = generation, step,
                automationId = AutomationProperties.GetAutomationId(button), animationsEnabled = false,
                clockOriginTicks = origin.ToString(System.Globalization.CultureInfo.InvariantCulture),
                clockFrequency = System.Diagnostics.Stopwatch.Frequency, elapsedMs = Elapsed,
                operation = requested?.Operation, nativeRequestId = requested?.NativeRequestId,
                origin = requested?.Origin.ToString(), position, observationCount = samples.Count, reason };
        }
    }

    private void SettingsChanged(UISettings sender, UISettingsAnimationsEnabledChangedEventArgs args)
    {
        if (!button.DispatcherQueue.TryEnqueue(() => { if (observing && !disposed) RecordSetting("changed"); }))
            failure = "Динамическая настройка потеряла UI dispatcher.";
    }

    private void RecordSetting(string kind)
    {
        lock (samples)
        {
            if (settings.Count == 4) { overflow = 1; return; }
            var start = Elapsed;
            var value = settingObserver!.AnimationsEnabled;
            settings.Add(new(kind, start, Elapsed, value, samples.Count));
        }
    }

    private void DetachSettings()
    {
        if (settingObserver is not null) settingObserver.AnimationsEnabledChanged -= SettingsChanged;
    }
}
