import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Как device-loss.test: исполняются исходные методы, внешняя графика заменена
// ресурсами с управляемыми отказами. Проба не подтверждает GPU/WinUI lifecycle.
const source = await readFile(new URL('../Rendering/SheetLayers.cs', import.meta.url), 'utf8');
function method(signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing method: ${signature}`);
  const open = source.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}
const capabilities = source.match(
  /internal readonly record struct SheetMaterialCapabilities\([\s\S]*?\);/,
)?.[0];
assert.ok(capabilities, 'Missing immutable material capability facts');
const properties = ['EffectiveMaterial', 'MaterialReason', 'MaterialCapabilities']
  .map((name) => {
    const property = source.match(new RegExp(`internal [^\\n]+\\? ${name} => [^;]+;`))?.[0];
    assert.ok(property, `Missing readback: ${name}`);
    // Mutation моделирует старое сохранённое успешное значение после Release.
    return process.argv.includes('--stale-readback')
      ? property.replace(
          /=> [^;]+;/,
          `=> ${
            {
              EffectiveMaterial: 'LabSheetMaterial.Blur',
              MaterialReason: 'LabSheetMaterialReason.Requested',
              MaterialCapabilities: 'new SheetMaterialCapabilities(true, true, true)',
            }[name]
          };`,
        )
      : property;
  })
  .join('\n');
const methods = [
  method(
    'private static (LabSheetMaterial Material, LabSheetMaterialReason Reason) ResolveMaterial(',
  ),
  method('private void Render(bool recreate = false)'),
  method('private void DeviceLost('),
  method('private void QueueRedraw()'),
  method('private void ReleaseGraphics()'),
  method('private sealed class Frame : IDisposable'),
].join('\n');
const sampler = method(
  'private (LabSheetMaterial Material, LabSheetMaterialReason Reason, SheetMaterialCapabilities Capabilities) ResolveMaterial()',
);
assert.match(
  sampler,
  /new SheetMaterialCapabilities\(settings\?\.AdvancedEffectsEnabled,\s*capabilities\?\.AreEffectsSupported\(\), capabilities\?\.AreEffectsFast\(\)\)/,
);
for (const api of ['AdvancedEffectsEnabled', 'AreEffectsSupported', 'AreEffectsFast'])
  assert.equal(sampler.split(api).length - 1, 1, `Capability API must be sampled once: ${api}`);

const program = `
using System.Runtime.InteropServices;
using CanvasDevice = FakeDevice;

static void Check(bool value, string message) { if (!value) throw new Exception(message); }
static void SameError(Action action, Exception expected) {
    try { action(); throw new Exception("Expected original error"); }
    catch (Exception actual) when (ReferenceEquals(actual, expected)) { }
}
static void Causes(Action action, params Exception[] expected) {
    try { action(); throw new Exception("Expected aggregate error"); }
    catch (AggregateException actual) {
        var causes = actual.Flatten().InnerExceptions;
        Check(expected.All(causes.Contains), "Primary or cleanup error was lost");
    }
}

foreach (bool? advanced in new bool?[] { true, false, null })
foreach (bool? supported in new bool?[] { true, false, null })
foreach (bool? fast in new bool?[] { true, false, null }) {
    var facts = new SheetMaterialCapabilities(advanced, supported, fast);
    Check(Probe.Policy(LabSheetMaterial.Solid, facts) == (LabSheetMaterial.Solid, LabSheetMaterialReason.Requested),
        "Requested Solid was overridden by capability facts");
    var expected = advanced == false
        ? (LabSheetMaterial.Solid, LabSheetMaterialReason.TransparencyDisabled)
        : supported != true
            ? (LabSheetMaterial.Solid, LabSheetMaterialReason.EffectsUnsupported)
            : (LabSheetMaterial.Blur, LabSheetMaterialReason.Requested);
    Check(Probe.Policy(LabSheetMaterial.Blur, facts) == expected,
        $"Material policy lost support/transparency distinction: {facts}");
}
Console.WriteLine("Sheet plain capability policy: supported slow Blur and opaque fallbacks PASS");

var latched = new Probe();
latched.Start();
Check(latched.Facts == new SheetMaterialCapabilities(true, true, false), "Boolean false was not latched");
latched.InputCapabilities = new(false, true, true);
Check(latched.Facts == new SheetMaterialCapabilities(true, true, false), "Readback queried changed input instead of the selected frame");
latched.Start();
Check(latched.Facts == latched.InputCapabilities && latched.Effective == LabSheetMaterial.Solid
    && latched.Reason == LabSheetMaterialReason.TransparencyDisabled, "Replacement frame did not latch its own decision facts");
latched.Stop();
Check(latched.Facts is null, "Detached frame retained capability evidence");
Console.WriteLine("Sheet immutable frame capability readback PASS");

var healthy = new Probe();
healthy.Start();
Check(healthy.Ready && healthy.CurrentVisual is not null, "Healthy frame missing");
healthy.Queue(); healthy.Queue(); healthy.DispatcherQueue.Drain();
Check(healthy.Draws == 2, "Invalidations did not coalesce");
healthy.Queue(); healthy.ReplaceGeneration(); healthy.DispatcherQueue.Drain();
Check(healthy.Draws == 3 && healthy.Ready, "Stale callback replaced the new generation");

var failure = new Probe();
failure.Start();
var drawError = new InvalidOperationException("draw after ready");
failure.Draw = () => throw drawError;
SameError(failure.Start, drawError);
Check(!failure.Ready && failure.Reason is null && failure.Facts is null && failure.FrameAbsent && failure.GraphicsAbsent
    && failure.CurrentVisual is null, "Readback remained ready after graphics were released");
Check(failure.Notifications.SequenceEqual(new[] { true, false }), "Consumer missed readiness loss");
Console.WriteLine("Sheet terminal failure: readiness and notification PASS");

var cleanup = new Probe();
cleanup.Start();
var graphics = cleanup.OwnedGraphics;
var device = cleanup.OwnedDevice;
var disposeError = new InvalidOperationException("frame disposal");
var notificationError = new InvalidOperationException("readiness handler");
cleanup.Tracked[^1].Failure = disposeError;
cleanup.WhenChanged(() => { if (!cleanup.Ready) throw notificationError; });
cleanup.Draw = () => throw drawError;
Causes(cleanup.Start, drawError, disposeError, notificationError);
Check(!cleanup.Ready && cleanup.Reason is null && cleanup.Facts is null && cleanup.Tracked.All(resource => resource.Attempted)
    && graphics!.Attempted && device!.Subscriptions == 0, "Failed cleanup skipped a resource or retained readiness");

var attach = new Probe();
attach.Start();
var attachError = new InvalidOperationException("publish visual");
attach.AttachFailure = attachError;
attach.CandidateDisposeFailure = disposeError;
Causes(attach.Start, attachError, disposeError);
Check(!attach.Ready && attach.Tracked.All(resource => resource.Attempted), "Failed publication retained the candidate");
Console.WriteLine("Sheet cleanup: all attempts and primary errors PASS");

var loss = new Probe();
loss.Start();
loss.Draw = () => { if (loss.Draws == 2) throw new COMException("device lost", unchecked((int)0x887A0005)); };
loss.Start(); loss.DispatcherQueue.Drain();
Check(loss.Ready && loss.CurrentVisual is not null && loss.Draws == 3, "Draw-time device loss did not recover");
Check(loss.Notifications.SequenceEqual(new[] { true, false, true }), "Rebuild readiness was not observed");

var unloaded = new Probe();
unloaded.Start();
unloaded.WhenChanged(() => { if (!unloaded.Ready) unloaded.Stop(); });
unloaded.Rebuild();
Check(!unloaded.Ready && unloaded.CurrentVisual is null && unloaded.Draws == 1,
    "Rebuild resurrected graphics after notification unloaded the consumer");

var reattached = new Probe();
reattached.Start();
reattached.WhenChanged(() => { if (!reattached.Ready) reattached.ReplaceGeneration(); });
reattached.Rebuild();
Check(reattached.Ready && reattached.Draws == 2,
    "Old rebuild replaced a generation created from its readiness notification");
Console.WriteLine("Sheet healthy replacement, generation and recovery PASS");

foreach (var callbackError in new Exception[] {
    new InvalidOperationException("reattach then throw"),
    new COMException("old callback with device-loss HRESULT", unchecked((int)0x887A0005))
}) {
    var successor = new Probe();
    successor.Start();
    var oldResources = successor.Tracked.ToArray();
    var oldGraphics = successor.OwnedGraphics;
    var oldDevice = successor.OwnedDevice;
    SpriteVisual? successorVisual = null;
    CompositionGraphicsDevice? successorGraphics = null;
    var replaced = false;
    successor.WhenChanged(() => {
        if (successor.Ready || replaced) return;
        replaced = true;
        successor.ReplaceGeneration();
        successorVisual = successor.CurrentVisual;
        successorGraphics = successor.OwnedGraphics;
        throw callbackError;
    });
    SameError(successor.Rebuild, callbackError);
    Check(successor.Ready && !successor.FrameAbsent && !successor.GraphicsAbsent
        && ReferenceEquals(successor.CurrentVisual, successorVisual)
        && ReferenceEquals(successor.OwnedGraphics, successorGraphics),
        "Old failing rebuild destroyed a successfully reattached generation");
    Check(oldResources.All(resource => resource.Attempted) && oldGraphics!.Attempted
        && oldDevice!.Subscriptions == 0, "Old resources were not cleaned before reattachment");
    successor.Queue(); successor.DispatcherQueue.Drain();
    Check(successor.Ready && successor.Draws == 3,
        "Old failure disabled rendering or reported device loss to the successor");
}
Console.WriteLine("Sheet reattach-plus-throw preserves successor ownership PASS");

sealed class Probe {
    private CanvasDevice? device;
    private CompositionGraphicsDevice? graphics;
    private Frame? frame;
    private SheetMetrics? geometry = SheetMetrics.Half(375,812);
    // Существующая resource-проба получает готовый вход; live scene проверяется hosted capture.
    private SceneInput? scene = new();
    private bool active = true, queued, recovering, recoveryFailed;
    private long generation = 1;
    public double ActualWidth => 375; public double ActualHeight => 812;
    private FakePaint? Tint = new(), Blend = new(), Ghost = new(), Border = new(), Noise = new(), ShadowInk = new(), Solid = new();
    ${properties}
    private event EventHandler? EffectiveMaterialChanged;
    public readonly Dispatcher DispatcherQueue = new();
    public readonly List<Resource> Tracked = new();
    public readonly List<bool> Notifications = new();
    public SpriteVisual? CurrentVisual;
    public Action? Draw;
    public Exception? AttachFailure, CandidateDisposeFailure;
    public int Draws;
    public bool Ready => EffectiveMaterial is not null;
    public LabSheetMaterial? Effective => EffectiveMaterial;
    public LabSheetMaterialReason? Reason => MaterialReason;
    public SheetMaterialCapabilities? Facts => MaterialCapabilities;
    public SheetMaterialCapabilities InputCapabilities = new(true, true, false);
    public static (LabSheetMaterial Material, LabSheetMaterialReason Reason) Policy(LabSheetMaterial requested, SheetMaterialCapabilities facts)
        => ResolveMaterial(requested, facts);
    public bool FrameAbsent => frame is null;
    public bool GraphicsAbsent => graphics is null;
    public CompositionGraphicsDevice? OwnedGraphics => graphics;
    public FakeDevice? OwnedDevice => device;
    public Probe() => EffectiveMaterialChanged += (_, _) => Notifications.Add(Ready);
    public void WhenChanged(Action action) => EffectiveMaterialChanged += (_, _) => action();
    public void Start() => Render();
    public void Rebuild() => Render(recreate: true);
    public void Queue() => QueueRedraw();
    public void Stop() { active=false; generation++; queued=false; ReleaseGraphics(); }
    public void ReplaceGeneration() { generation++; queued=false; recoveryFailed=false; ReleaseGraphics(); Render(); }
    private (LabSheetMaterial Material, LabSheetMaterialReason Reason, SheetMaterialCapabilities Capabilities) ResolveMaterial() {
        var resolved = ResolveMaterial(LabSheetMaterial.Blur, InputCapabilities);
        return (resolved.Material, resolved.Reason, InputCapabilities);
    }
    private Frame BuildFrame(Compositor compositor, SheetMetrics metrics, LabSheetMaterial material, LabSheetMaterialReason reason, SheetMaterialCapabilities capabilities) {
        Draws++; Draw?.Invoke();
        var result = new Frame(compositor, material, reason, capabilities);
        Tracked.Add(result.Visual);
        Tracked.Add(result.Own(new Resource()));
        Tracked.Add(result.Own(new Resource { Failure=CandidateDisposeFailure }));
        result.Visual.Brush = new object();
        return result;
    }
    ${methods}
}
enum LabSheetMaterial { Blur, Solid }
enum LabSheetMaterialReason { Requested, TransparencyDisabled, EffectsUnsupported }
${capabilities}
record struct SheetMetrics { public static SheetMetrics Half(double width, double height) => new(); }
sealed class SceneInput { public bool IsLoaded = true; public double ActualWidth = 375, ActualHeight = 812; }
sealed class FakePaint { public double Opacity = 1; public FakeColor Color = new(); }
sealed class FakeColor { public byte A = 255; }
class Resource : IDisposable {
    public bool Attempted;
    public Exception? Failure;
    public void Dispose() { Attempted=true; if (Failure is { } error) throw error; }
}
sealed class SpriteVisual : Resource { public object? Brush; public Compositor Compositor => new(); }
sealed class Compositor { public SpriteVisual CreateSpriteVisual() => new(); }
sealed class CompositionGraphicsDevice : Resource { }
static class CanvasComposition {
    public static CompositionGraphicsDevice CreateCompositionGraphicsDevice(Compositor compositor, FakeDevice device) => new();
}
static class ElementCompositionPreview {
    public static SpriteVisual GetElementVisual(Probe owner) => new();
    public static void SetElementChildVisual(Probe owner, SpriteVisual? value) {
        if (value is not null && owner.AttachFailure is { } failure) throw failure;
        owner.CurrentVisual=value;
    }
}
sealed class FakeDevice {
    public event Action<FakeDevice, object>? DeviceLost;
    public int Subscriptions => DeviceLost?.GetInvocationList().Length ?? 0;
    public static FakeDevice GetSharedDevice() => new();
    public bool IsDeviceLost(int result) => result == unchecked((int)0x887A0005);
    public void RaiseDeviceLost() => DeviceLost?.Invoke(this,new object());
}
sealed class Dispatcher {
    private readonly Queue<Action> pending = new();
    public bool TryEnqueue(Action action) { pending.Enqueue(action); return true; }
    public void Drain() {
        var count=0;
        while(pending.TryDequeue(out var action)) {
            if(++count>20) throw new Exception("Unbounded queue"); action();
        }
    }
}
`;
const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'labui-sheet-lifecycle-'));
try {
  await writeFile(
    path.join(directory, 'Boundary.csproj'),
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>',
  );
  await writeFile(path.join(directory, 'Program.cs'), program);
  const result = spawnSync(
    process.env.DOTNET_HOST_PATH || 'dotnet',
    ['run', '--project', path.join(directory, 'Boundary.csproj'), '--verbosity', 'quiet'],
    { encoding: 'utf8', windowsHide: true },
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  const resolved = await realpath(directory);
  const relative = path.relative(temporaryRoot, resolved);
  assert.ok(
    relative &&
      !path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !relative.includes(path.sep) &&
      path.basename(resolved).startsWith('labui-sheet-lifecycle-'),
    `Unsafe cleanup target: ${resolved}`,
  );
  await rm(resolved, { recursive: true, force: true });
}
