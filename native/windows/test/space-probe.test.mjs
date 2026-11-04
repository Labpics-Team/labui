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

foreach (var (animate, priorRelease) in new[] { (true, .3f), (true, 0f), (true, .0005f), (false, 0f) }) {
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
        channel.Publish(Motion(animate, edge, animate ? "value" : "idle", replacement));
    }
    channel.DriverPosition(0);
    channel.Publish(Motion(animate, 3, "idle", 0));
    using var input = new MemoryStream(Encoding.UTF8.GetBytes("complete\\n"));
    using var output = new MemoryStream();
    await SpaceProtocol.RunAsync(input, output, _ => Task.FromResult(Call(probe, "Complete")));
    using var json = JsonDocument.Parse(output.ToArray());
    Check(json.RootElement.GetProperty("ok").GetBoolean(), "producer did not complete through real serializer");
    var trace = json.RootElement.GetProperty("value");
    var events = trace.GetProperty("events").EnumerateArray().ToArray();
    var samples = trace.GetProperty("observations").EnumerateArray().ToArray();
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
foreach (var target in new[] { "events", "samples" }) {
    var parent = new UIElement(); var button = new LabButton(); FocusManager.Focused = button;
    using var probe = new SpaceProbe(parent, button, () => 4);
    Call(probe, "Arm", "Light");
    for (var i = 0; i < 160; i++) {
        if (target == "events") parent.Raise(UIElement.PreviewKeyDownEvent, Key(true));
        else button.Channel.Publish(Motion(true, 0, "value", .3f));
    }
    Check(List(probe, target).Count == (target == "events" ? 24 : 128), "producer memory is not bounded");
    try { Call(probe, "Complete"); throw new Exception("overflow accepted"); }
    catch (InvalidOperationException error) { Check(error.Message.Contains("observations"), "wrong overflow rejection"); }
    probe.Dispose();
    Check(parent.HandlerCount == 0 && button.HandlerCount == 0 && button.CallbackCount == 0 && button.Channel.Subscribers == 0,
        "explicit dispose did not detach after overflow");
}
Console.WriteLine("Space producer: PASS (ancestor preview, passive old state, equal-time request prefix, real serializer, bounded memory, detach)");

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

test('actual Space producer preserves old preview state before retarget and serializes its request prefix', async () => {
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
