import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { test } from 'node:test';

// Исполняется producer; подменены только WinUI/Motion, часы и запуск stdio-задачи.
// Маршрут preview -> class handler -> bubble задаётся fixture, не доказывается им.
const source = await readFile(
  process.env.SPACE_PROBE_SOURCE ||
    new URL('../../../examples/windows/SpaceProbe.cs', import.meta.url),
  'utf8',
);
const transport = source.indexOf('_ = Task.Run(async () =>');
assert.notEqual(transport, -1, 'Не найдена граница фонового stdio reader.');
let end = source.indexOf('{', transport) + 1;
let depth = 1;
while (depth && end < source.length) {
  if (source[end] === '{') depth++;
  if (source[end] === '}') depth--;
  end++;
}
assert.equal(depth, 0, 'Не найдена граница transport lambda.');
assert.equal(source.slice(end, end + 2), ');', 'Изменена граница transport task.');
end += 2;
const noTransport = source.slice(0, transport) + source.slice(end);
const clock = /private double Elapsed =>[^;]+;/;
assert.match(noTransport, clock);
const producer = noTransport.replace(clock, 'private double Elapsed => FixtureClock.Now;');

const program = `
using System.Collections;
using System.Numerics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using LabMotion.WinUI;
using LabUI.Buttons;
using LabUI.WinUI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Input;
using Windows.System;
using Windows.UI.ViewManagement;

static void Check(bool value, string message) { if (!value) throw new Exception(message); }
static object Call(SpaceProbe probe, string name, params object[] args) {
    try { return typeof(SpaceProbe).GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(probe, args)!; }
    catch (TargetInvocationException error) { throw error.InnerException!; }
}
static IList List(SpaceProbe probe, string name) => (IList)typeof(SpaceProbe).GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(probe)!;
static MotionObservation Motion(bool animate, int edge, string phase, float position) => new(animate ? edge + 1 : 0, phase, FixtureClock.Now / 1000, position, null, position) {
    Origin = animate ? MotionOrigin.Animation : MotionOrigin.Snap, NativeRequestId = 101 + edge,
    NativePosition = new Vector3(position * 1000, 0, 0), NativeReadbackPosition = new Vector3(position * 1000, 0, 0)
};
static KeyRoutedEventArgs Key(bool down) => new() { Key = VirtualKey.Space, KeyStatus = new() { WasKeyDown = !down } };
static async Task<JsonElement> Complete(SpaceProbe probe) {
    using var input = new MemoryStream(Encoding.UTF8.GetBytes("complete\\n"));
    using var output = new MemoryStream();
    await SpaceProtocol.RunAsync(input, output, _ => Task.FromResult(Call(probe, "Complete")));
    Check(output.Length <= 128 * 1024, "diagnostic exceeded protocol response limit");
    using var json = JsonDocument.Parse(output.ToArray());
    Check(json.RootElement.GetProperty("ok").GetBoolean(), "diagnostic lost in protocol error");
    return json.RootElement.GetProperty("value").Clone();
}

foreach (var (animate, priorRelease, terminalPhase) in new[] {
    (true, .3f, "idle"), (true, 0f, "idle"), (true, .0005f, "idle"), (false, 0f, "value"), (false, 0f, "idle") }) {
    UISettings.Enabled = animate;
    var parent = new UIElement();
    var button = new LabButton();
    var channel = button.Channel;
    var count = 4;
    FocusManager.Focused = button;
    using var probe = new SpaceProbe(parent, button, () => count);
    FixtureClock.Now = 12;
    Call(probe, "Arm", "Light");
    Check(parent.Count(UIElement.PreviewKeyDownEvent) == 1 && parent.Count(UIElement.PreviewKeyUpEvent) == 1,
        "ancestor preview subscriptions missing");
    Check(button.Count(UIElement.PreviewKeyDownEvent) == 0 && button.Count(UIElement.PreviewKeyUpEvent) == 0,
        "preview attached to target rather than ancestor");
    Check(button.Count(UIElement.KeyDownEvent) == 1 && button.Count(UIElement.KeyUpEvent) == 1,
        "native bubbling subscriptions missing");
    var expectedPrefix = new List<int>();
    var expectedPosition = new List<float>();
    for (var edge = 0; edge < 4; edge++) {
        var down = edge % 2 == 0;
        var oldPosition = edge switch { 0 => 0f, 1 => animate ? .6f : 1f, 2 => priorRelease, _ => animate ? .7f : 1f };
        channel.DriverPosition(oldPosition);
        expectedPrefix.Add(List(probe, "samples").Count);
        expectedPosition.Add(oldPosition);
        var keyArgs = Key(down);
        var mutations = (button.Writes, channel.Writes, keyArgs.HandledWrites, count, FocusManager.Focused);
        parent.Raise(down ? UIElement.PreviewKeyDownEvent : UIElement.PreviewKeyUpEvent, keyArgs);
        Check((button.Writes, channel.Writes, keyArgs.HandledWrites, count, FocusManager.Focused) == mutations,
            "preview changed button, motion, focus, activation count or Handled");
        Check(button.IsPressed == !down, "preview changed old IsPressed");
        // Class handler меняет запрос только после ancestor-preview.
        var replacement = down ? (animate ? .00002f : 1f) : (animate ? .58f : 0f);
        channel.DriverPosition(replacement);
        channel.Publish(Motion(animate, edge, "requested", oldPosition));
        button.DriverPressed(down);
        if (!down) { count++; button.DriverClick(); }
        button.Raise(down ? UIElement.KeyDownEvent : UIElement.KeyUpEvent, keyArgs);
        channel.Publish(Motion(animate, edge, "value", replacement));
    }
    channel.DriverPosition(0);
    if (animate || terminalPhase == "idle") channel.Publish(Motion(animate, 3, terminalPhase, 0));
    using var input = new MemoryStream(Encoding.UTF8.GetBytes("complete\\n"));
    using var output = new MemoryStream();
    await SpaceProtocol.RunAsync(input, output, _ => Task.FromResult(Call(probe, "Complete")));
    using var json = JsonDocument.Parse(output.ToArray());
    Check(json.RootElement.GetProperty("ok").GetBoolean(), "producer did not complete through real serializer");
    var trace = json.RootElement.GetProperty("value");
    Check(trace.GetProperty("status").GetString() == "complete", "healthy trace no longer completes");
    var events = trace.GetProperty("events").EnumerateArray().ToArray();
    var samples = trace.GetProperty("observations").EnumerateArray().ToArray();
    if (!animate && terminalPhase == "value") Check(samples.All(sample => sample.GetProperty("motion").GetProperty("phase").GetString() != "idle"),
        "reduced value control invented idle");
    var previews = events.Where(e => e.GetProperty("kind").GetString()!.StartsWith("previewKey")).ToArray();
    var bubbles = events.Where(e => e.GetProperty("kind").GetString() is "keyDown" or "keyUp").ToArray();
    Check(previews.Length == 4 && bubbles.Length == 4 && events.Length == 16,
        "producer lost preview/native edge chain");
    for (var edge = 0; edge < 4; edge++) {
        var pre = previews[edge];
        var post = bubbles[edge];
        Check(pre.GetProperty("kind").GetString() == (edge % 2 == 0 ? "previewKeyDown" : "previewKeyUp"), "preview edge order lost");
        Check(pre.GetProperty("isPressed").GetBoolean() == (edge % 2 != 0), "pre-retarget IsPressed lost");
        Check(post.GetProperty("isPressed").GetBoolean() == (edge % 2 == 0), "bubbling state lost");
        Check(pre.GetProperty("position").GetSingle() == expectedPosition[edge], "pre-retarget Position replaced by new movement");
        Check(pre.GetProperty("currentChannel").GetBoolean(), "preview changed channel identity");
        Check(pre.GetProperty("observationCount").GetInt32() == expectedPrefix[edge], "preview prefix includes replacement sample");
        Check(post.GetProperty("observationCount").GetInt32() == expectedPrefix[edge] + 1, "native chain not separated by requested sample");
        Check(pre.GetProperty("readStartedMs").GetDouble() == 12 && pre.GetProperty("elapsedMs").GetDouble() == 12,
            "equal-time boundary not preserved");
        if (edge == 0) {
            Check(pre.GetProperty("operation").ValueKind == JsonValueKind.Null && pre.GetProperty("nativeRequestId").ValueKind == JsonValueKind.Null,
                "initial preview invented a Motion identity");
        } else {
            var old = samples[expectedPrefix[edge] - 1].GetProperty("motion");
            Check(pre.GetProperty("operation").GetInt64() == old.GetProperty("operation").GetInt64() &&
                pre.GetProperty("nativeRequestId").GetInt32() == old.GetProperty("nativeRequestId").GetInt32(),
                "preview did not preserve the last observed request pair");
        }
    }
    Check(bubbles[2].GetProperty("position").GetSingle() != previews[2].GetProperty("position").GetSingle(),
        "fixture did not distinguish prior state from replacement movement");
    Check(trace.GetProperty("countAfter").GetInt32() == 6, "activation count changed");
    Check(samples[0].GetProperty("motion").GetProperty("origin").GetString() == (animate ? "Animation" : "Snap"), "Motion origin serialization changed");
    Check(samples[0].GetProperty("motion").GetProperty("nativePosition").TryGetProperty("x", out _), "native vector fields lost by serializer");
    Check(parent.HandlerCount == 0 && button.HandlerCount == 0 && button.CallbackCount == 0 && channel.Subscribers == 0,
        "completion did not detach parent and target observations");
    parent.Raise(UIElement.PreviewKeyDownEvent, Key(true)); button.Raise(UIElement.KeyDownEvent, Key(true));
    Check(List(probe, "events").Count == 16, "detached probe retained input");
}
foreach (var target in new[] { "events", "samples", "exact-events", "owner-failure" }) {
    UISettings.Enabled = true;
    var parent = new UIElement(); var button = new LabButton(); FocusManager.Focused = button;
    using var probe = new SpaceProbe(parent, button, () => 4);
    Call(probe, "Arm", "Light");
    if (target is "events" or "samples") {
        for (var i = 0; i < 160; i++) {
            if (target == "events") parent.Raise(UIElement.PreviewKeyDownEvent, Key(true));
            else button.Channel.Publish(Motion(true, 0, "value", .3f));
        }
        Check(List(probe, target).Count == (target == "events" ? 24 : 128), "producer memory is not bounded");
    } else if (target == "exact-events") {
        button.Raise(UIElement.KeyUpEvent, Key(false)); button.Raise(UIElement.KeyUpEvent, Key(false));
        for (var i = 0; i < 21; i++) parent.Raise(UIElement.PreviewKeyDownEvent, Key(true));
        button.Channel.Publish(Motion(true, 3, "requested", 0));
        button.Channel.Publish(Motion(true, 3, "idle", 0));
        Check(List(probe, "events").Count == 24, "exact-capacity control is not full");
    } else {
        button.DriverFailure(new InvalidOperationException("fixture-motion-failure"));
    }
    var eventCount = List(probe, "events").Count;
    var sampleCount = List(probe, "samples").Count;
    var trace = await Complete(probe);
    Check(trace.GetProperty("status").GetString() == "failed", "failed diagnostic promoted to complete");
    Check(trace.GetProperty("schemaVersion").GetInt32() == 1, "failure changed trace schema");
    Check(trace.GetProperty("events").GetArrayLength() == eventCount &&
        trace.GetProperty("observations").GetArrayLength() == sampleCount, "failure lost retained bounded records");
    if (target == "owner-failure") {
        Check(trace.GetProperty("overflow").GetInt32() == 0 &&
            trace.GetProperty("failure").GetString()!.Contains("fixture-motion-failure"), "owner failure lost or misclassified as overflow");
    } else {
        Check(trace.GetProperty("overflow").GetInt32() != 0, "overflow diagnostic lost rejection reason");
    }
    Check(parent.HandlerCount == 0 && button.HandlerCount == 0 && button.CallbackCount == 0 && button.Channel.Subscribers == 0,
        "failed completion did not detach observations");
    parent.Raise(UIElement.PreviewKeyDownEvent, Key(true));
    button.Channel.Publish(Motion(true, 3, "idle", 0));
    Check(List(probe, "events").Count == eventCount && List(probe, "samples").Count == sampleCount,
        "failure snapshot continued collecting records");
}
// Контролируемые состояния различают причины waiting; порядок native callbacks здесь не утверждается.
foreach (var pending in new[] { "key-up", "pressed", "phase", "idle-before-value", "request", "operation", "intent", "readback", "position" }) {
    UISettings.Enabled = true;
    var parent = new UIElement(); var button = new LabButton(); FocusManager.Focused = button;
    using var probe = new SpaceProbe(parent, button, () => 4);
    Call(probe, "Arm", "Light");
    button.Raise(UIElement.KeyUpEvent, Key(false));
    if (pending != "key-up") button.Raise(UIElement.KeyUpEvent, Key(false));
    if (pending != "intent") button.Channel.Publish(Motion(true, 3, "requested", 0));
    if (pending == "idle-before-value") button.Channel.Publish(Motion(true, 3, "idle", 0));
    var latest = Motion(true, 3, pending is "phase" or "idle-before-value" ? "value" : "idle", pending == "readback" ? .2f : 0);
    if (pending == "request") latest = latest with { NativeRequestId = 99 };
    if (pending == "operation") latest = latest with { Operation = 99 };
    button.Channel.Publish(latest);
    if (pending == "pressed") button.DriverPressed(true);
    button.Channel.DriverPosition(pending == "position" ? .2f : 0);
    var eventCount = List(probe, "events").Count;
    var trace = await Complete(probe);
    Check(trace.GetProperty("status").GetString() == "waiting", "unmet completion predicate accepted");
    var state = trace.GetProperty("state");
    Check(state.GetProperty("eventCount").GetInt32() == eventCount &&
        state.GetProperty("observationCount").GetInt32() == (pending == "intent" ? 1 : pending == "idle-before-value" ? 3 : 2), "waiting counts lost");
    Check(state.GetProperty("keyUpCount").GetInt32() == (pending == "key-up" ? 1 : 2) &&
        state.GetProperty("isPressed").GetBoolean() == (pending == "pressed"), "waiting key state lost");
    Check(state.GetProperty("position").GetSingle() == (pending == "position" ? .2f : 0), "waiting position lost");
    Check(state.GetProperty("latest").GetProperty("phase").GetString() == latest.Phase &&
        state.GetProperty("latest").GetProperty("nativeRequestId").GetInt32() == latest.NativeRequestId &&
        state.GetProperty("latest").GetProperty("operation").GetInt64() == latest.Operation &&
        state.GetProperty("latest").GetProperty("readbackPosition").GetSingle() == latest.ReadbackPosition, "waiting latest observation lost");
    Check((state.GetProperty("requested").ValueKind == JsonValueKind.Null) == (pending == "intent"), "waiting intent presence lost");
    if (pending != "intent") Check(state.GetProperty("requested").GetProperty("nativeRequestId").GetInt32() == 104,
        "waiting changed requested identity to latest identity");
    var lastIdle = state.GetProperty("lastIdle");
    var hasIdle = pending is "key-up" or "pressed" or "idle-before-value" or "readback" or "position";
    Check((lastIdle.ValueKind != JsonValueKind.Null) == hasIdle, "matching idle presence lost or stale idle accepted");
    if (hasIdle) Check(lastIdle.GetProperty("elapsedMs").GetDouble() == 12 &&
        lastIdle.GetProperty("motion").GetProperty("phase").GetString() == "idle" &&
        lastIdle.GetProperty("motion").GetProperty("nativeRequestId").GetInt32() == 104 &&
        lastIdle.GetProperty("motion").GetProperty("operation").GetInt64() == 4, "last matching idle identity or time lost");
    Check(button.Channel.Subscribers == 1 && List(probe, "events").Count == eventCount,
        "waiting diagnostic changed observation lifecycle or recorded a complete event");
    if (pending == "key-up") button.Raise(UIElement.KeyUpEvent, Key(false));
    if (pending == "pressed") button.DriverPressed(false);
    if (pending == "intent") button.Channel.Publish(Motion(true, 3, "requested", 0));
    button.Channel.DriverPosition(0);
    button.Channel.Publish(Motion(true, 3, "idle", 0));
    Check((await Complete(probe)).GetProperty("status").GetString() == "complete", "waiting diagnostic prevented later valid completion");
}
// Snap завершается наблюдённым endpoint текущего запроса, а не самим requested или чужим callback.
foreach (var pending in new[] { "requested-only", "inertia", "ignored", "stale-request", "stale-operation", "nonzero-operation", "foreign-origin", "foreign-intent", "reported-position", "readback", "position" }) {
    UISettings.Enabled = false;
    var parent = new UIElement(); var button = new LabButton(); FocusManager.Focused = button;
    using var probe = new SpaceProbe(parent, button, () => 4);
    Call(probe, "Arm", "Light");
    button.Raise(UIElement.KeyUpEvent, Key(false)); button.Raise(UIElement.KeyUpEvent, Key(false));
    var requested = Motion(false, 3, "requested", 0);
    var latest = Motion(false, 3, pending is "inertia" or "ignored" ? pending : "value", 0);
    if (pending == "stale-request") latest = latest with { NativeRequestId = 103 };
    if (pending == "stale-operation") latest = latest with { Operation = 1 };
    if (pending == "nonzero-operation") { requested = requested with { Operation = 1 }; latest = latest with { Operation = 1 }; }
    if (pending == "foreign-origin") latest = latest with { Origin = MotionOrigin.Animation };
    if (pending == "foreign-intent") { requested = requested with { Origin = MotionOrigin.Animation }; latest = latest with { Origin = MotionOrigin.Animation }; }
    if (pending == "reported-position") latest = latest with { Position = .002f };
    if (pending == "readback") latest = latest with { ReadbackPosition = .002f };
    button.Channel.Publish(requested);
    if (pending != "requested-only") button.Channel.Publish(latest);
    button.Channel.DriverPosition(pending == "position" ? .002f : 0);
    Check((await Complete(probe)).GetProperty("status").GetString() == "waiting", "invalid Snap completion accepted: " + pending);
    Check(button.Channel.Subscribers == 1, "invalid Snap completion detached before valid endpoint");
}
Console.WriteLine("Space producer: PASS (ancestor preview, passive old state, equal-time request prefix, real serializer, bounded failure, waiting state, detach)");

public static class FixtureClock { public static double Now; }
namespace Microsoft.UI.Xaml {
    public class DependencyObject { }
    public sealed class DependencyProperty { }
    public class RoutedEventArgs : EventArgs { }
    public delegate void RoutedEventHandler(object sender, RoutedEventArgs args);
    public enum ElementTheme { Light, Dark }
    public class UIElement : DependencyObject {
        public static readonly object KeyDownEvent = new(), KeyUpEvent = new(), PreviewKeyDownEvent = new(), PreviewKeyUpEvent = new();
        private readonly Dictionary<object, List<(KeyEventHandler Handler, bool HandledToo)>> handlers = new();
        public object XamlRoot { get; } = new();
        public event RoutedEventHandler? GotFocus;
        public event RoutedEventHandler? LostFocus;
        public int HandlerCount => handlers.Values.Sum(h => h.Count) + (GotFocus?.GetInvocationList().Length ?? 0) + (LostFocus?.GetInvocationList().Length ?? 0);
        public int Count(object key) => handlers.TryGetValue(key, out var value) ? value.Count : 0;
        public void AddHandler(object key, object handler, bool handledEventsToo) {
            if (!handlers.TryGetValue(key, out var list)) handlers[key] = list = new();
            list.Add(((KeyEventHandler)handler, handledEventsToo));
        }
        public void RemoveHandler(object key, object handler) { if (handlers.TryGetValue(key, out var list)) list.RemoveAll(item => item.Handler == (KeyEventHandler)handler); }
        public void Raise(object key, KeyRoutedEventArgs args) {
            if (handlers.TryGetValue(key, out var list)) foreach (var item in list.ToArray()) if (!args.Handled || item.HandledToo) item.Handler(this, args);
        }
    }
}
namespace Microsoft.UI.Xaml.Input {
    public delegate void KeyEventHandler(object sender, KeyRoutedEventArgs args);
    public sealed class KeyRoutedEventArgs : RoutedEventArgs {
        public VirtualKey Key { get; init; }
        public KeyStatus KeyStatus { get; init; }
        private bool handled;
        public int HandledWrites;
        public bool Handled { get => handled; set { handled = value; HandledWrites++; } }
    }
    public struct KeyStatus { public bool WasKeyDown; }
    public static class FocusManager { public static object? Focused; public static object? GetFocusedElement(object root) => Focused; }
}
namespace Microsoft.UI.Xaml.Automation { public static class AutomationProperties { public static string GetAutomationId(object target) => "LabButtonMedium"; } }
namespace Windows.System { public enum VirtualKey { Space } }
namespace Windows.UI.ViewManagement { public sealed class UISettings { public static bool Enabled; public bool AnimationsEnabled => Enabled; } }
namespace LabUI.WinUI {
    public sealed class Dispatcher { public bool TryEnqueue(Action action) { action(); return true; } }
    public sealed class LabButton : UIElement {
        private readonly ScalarMotion pressedMotion = new();
        private Action<DependencyObject, DependencyProperty>? changed;
        public static readonly DependencyProperty IsPressedProperty = new();
        public ScalarMotion Channel => pressedMotion;
        public Dispatcher DispatcherQueue { get; } = new();
        public bool IsLoaded => true;
        public bool IsEnabled => true;
        public ElementTheme ActualTheme => ElementTheme.Light;
        private bool pressed;
        public int Writes;
        public bool IsPressed { get => pressed; set { Writes++; pressed = value; } }
        public event RoutedEventHandler? Click;
        public event EventHandler<Exception>? MotionFailed;
        public int CallbackCount => (changed == null ? 0 : 1) + (Click?.GetInvocationList().Length ?? 0) + (MotionFailed?.GetInvocationList().Length ?? 0);
        public long RegisterPropertyChangedCallback(DependencyProperty property, Action<DependencyObject, DependencyProperty> callback) { changed = callback; return 1; }
        public void UnregisterPropertyChangedCallback(DependencyProperty property, long token) { changed = null; }
        public void DriverPressed(bool value) { pressed = value; changed?.Invoke(this, IsPressedProperty); }
        public void DriverClick() => Click?.Invoke(this, new());
        public void DriverFailure(Exception error) => MotionFailed?.Invoke(this, error);
    }
}
namespace LabMotion.WinUI {
    public enum MotionOrigin { Animation, Snap }
    public readonly record struct MotionObservation(long Operation, string Phase, double Seconds, float Position, float? NativeVelocity, float ReadbackPosition) {
        public MotionOrigin Origin { get; init; }
        public int NativeRequestId { get; init; }
        public Vector3 NativePosition { get; init; }
        public Vector3 NativeReadbackPosition { get; init; }
    }
    public sealed class ScalarMotion {
        public event Action<MotionObservation>? Observed;
        private float position;
        public int Writes;
        public float Position { get => position; set { Writes++; position = value; } }
        public int Subscribers => Observed?.GetInvocationList().Length ?? 0;
        public void DriverPosition(float value) => position = value;
        public void Publish(MotionObservation value) => Observed?.Invoke(value);
    }
}
`;

test('actual Space producer preserves preview order and bounded completion diagnostics', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'labui-space-probe-'));
  try {
    await writeFile(join(directory, 'SpaceProbe.cs'), producer);
    await writeFile(
      join(directory, 'SpaceProtocol.cs'),
      await readFile(new URL('../../../examples/windows/SpaceProtocol.cs', import.meta.url)),
    );
    await writeFile(join(directory, 'Program.cs'), program);
    await writeFile(
      join(directory, 'Probe.csproj'),
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>',
    );
    const run = spawnSync(
      process.env.DOTNET_HOST_PATH || 'dotnet',
      ['run', '--project', join(directory, 'Probe.csproj'), '--verbosity', 'quiet'],
      { encoding: 'utf8', windowsHide: true, timeout: 120_000 },
    );
    assert.equal(run.status, 0, run.error || run.stdout + run.stderr);
    assert.match(run.stdout, /Space producer: PASS/);
    process.stdout.write(run.stdout);
  } finally {
    const target = await realpath(directory);
    const child = relative(temporaryRoot, target);
    assert.ok(
      child &&
        !isAbsolute(child) &&
        child !== '..' &&
        !child.startsWith(`..${sep}`) &&
        !child.includes(sep),
    );
    await rm(target, { recursive: true, force: true });
  }
});
