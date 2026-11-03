import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Исполняются неизменённые тела границы; WinUI, графика и реальная потеря GPU
// здесь не моделируются. Их проверяет отдельный native запуск.
const source = await readFile(new URL('../Rendering/ButtonLayers.cs', import.meta.url), 'utf8');
function block(text, start) {
  const open = text.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (depth && end < text.length) {
    if (text[end] === '{') depth++;
    if (text[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return { open, end, body: text.slice(open + 1, end - 1) };
}
function method(signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing method: ${signature}`);
  return source.slice(start, block(source, start).end);
}
let render = method('private void Render(bool recreate = false)');
if (process.argv.includes('--without-catch')) {
  // Mutation возвращает исходный дефект: lost exception покидает границу.
  render = `private void Render(bool recreate = false) {${block(render, render.indexOf('try')).body}}`;
}
const methods = [render, method('private void DeviceLost('), method('private void QueueRedraw()'), method('private void ReleaseGraphics()')].join('\n');
const program = `
using System.Runtime.InteropServices;

static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
static Exception Lost() => new COMException("injected device loss", unchecked((int)0x887A0005));
static void SameError(Action action, Exception expected) {
    try { action(); throw new Exception("Expected original exception"); }
    catch (Exception actual) when (ReferenceEquals(actual, expected)) { }
}

var first = new Probe();
first.Draw = () => { if (first.Draws is 1 or 3) throw Lost(); };
first.Start();
Check(first.Reports == 1 && first.Creates == 1, "Initial draw must report and defer recovery");
first.DispatcherQueue.Drain();
Check(first.Creates == 2 && first.Draws == 2, "First recovery must redraw");
first.Invalidate();
first.DispatcherQueue.Drain();
Check(first.Creates == 3 && first.Draws == 4 && first.Reports == 2, "A later independent loss must recover");

var creation = new Probe();
creation.Create = () => { if (creation.Creates == 1) throw Lost(); };
creation.Start();
creation.DispatcherQueue.Drain();
Check(creation.Creates == 2 && creation.Draws == 1 && creation.Reports == 1, "Initial resource creation must recover");

var disposal = new Probe();
disposal.Draw = () => { if (disposal.Draws == 1) { using var scope = new ThrowsOnDispose(Lost()); } };
disposal.Start();
disposal.DispatcherQueue.Drain();
Check(disposal.Creates == 2 && disposal.Reports == 1, "Drawing-session Dispose must remain inside boundary");

var unrelated = new Probe();
var otherError = new InvalidOperationException("unrelated");
unrelated.Draw = () => throw otherError;
SameError(unrelated.Start, otherError);
Check(unrelated.Reports == 0 && unrelated.Creates == 1, "Unrelated failure must not trigger recovery");

var persistent = new Probe();
var repeatedError = Lost();
persistent.Draw = () => throw repeatedError;
persistent.Start();
persistent.Invalidate();
SameError(persistent.DispatcherQueue.Drain, repeatedError);
persistent.NotifyLoss();
persistent.Invalidate();
persistent.DispatcherQueue.Drain();
Check(persistent.Creates == 2 && persistent.Draws == 2, "Failed recovery must not keep recreating or drawing");
Check(persistent.Resources == 0 && persistent.Subscriptions == 0,
    $"Failed replacement retained resources={persistent.Resources}, subscriptions={persistent.Subscriptions}");

var partial = new Probe();
var creationError = new InvalidOperationException("replacement creation");
partial.Draw = () => { if (partial.Draws == 1) throw Lost(); };
partial.Create = () => { if (partial.Creates == 2) throw creationError; };
partial.Start();
SameError(partial.DispatcherQueue.Drain, creationError);
Check(partial.Resources == 0 && partial.Subscriptions == 0, "Partial creation must be released before Detach");

var cleanup = new Probe();
var cleanupError = new InvalidOperationException("injected Dispose failure");
cleanup.Draw = () => { if (cleanup.Draws == 1) throw Lost(); };
cleanup.Create = () => { if (cleanup.Creates == 2) {
    cleanup.FailDispose(cleanupError); throw creationError;
} };
cleanup.Start();
try { cleanup.DispatcherQueue.Drain(); throw new Exception("Expected both errors"); }
catch (AggregateException errors) {
    var causes = errors.Flatten().InnerExceptions;
    Check(causes.Contains(creationError) && causes.Contains(cleanupError), "Original and cleanup failures must remain observable");
}
Check(cleanup.AllDisposalsAttempted && cleanup.Subscriptions == 0,
    "A failed Dispose must not skip later resources or unsubscribe");

var duplicate = new Probe();
duplicate.Start();
duplicate.NotifyLoss();
duplicate.NotifyLoss();
duplicate.DispatcherQueue.Drain();
Check(duplicate.Creates == 2, "Old-device duplicate must not recreate replacement");

var stale = new Probe();
stale.Start();
stale.NotifyLoss();
stale.Invalidate();
stale.ReplaceLifetime();
stale.DispatcherQueue.Drain();
Check(stale.Creates == 2 && stale.Draws == 2, "Prior lifetime callbacks must be inert");
Console.WriteLine("PASS: 9 fault-injection scenarios; actual Render/DeviceLost/QueueRedraw/ReleaseGraphics bodies; no UI/GPU execution.");

sealed class Probe {
    private FakeDevice? device;
    private FakeResource? container, graphics;
    private readonly List<FakeResource> visuals = [], brushes = [], surfaces = [];
    private readonly List<FakeResource> acquired = [];
    private readonly List<FakeDevice> devices = [];
    private event EventHandler? VisualsChanging;
    private bool active = true, queued, recovering, recoveryFailed;
    private long generation = 1;
    public FakeDispatcher DispatcherQueue = new();
    public int Creates, Draws, Reports;
    public Action? Create, Draw;
    public int Resources => acquired.Count(value => !value.Closed);
    public int Subscriptions => devices.Sum(value => value.Subscriptions);
    public bool AllDisposalsAttempted => acquired.All(value => value.Attempted);
    private FakeResource Acquire() { var value = new FakeResource(); acquired.Add(value); return value; }
    public void FailDispose(Exception error) => acquired[^1].Failure = error;
    private void CreateGraphics() {
        device = new FakeDevice(() => Reports++); devices.Add(device); device.DeviceLost += DeviceLost;
        graphics = Acquire(); container = Acquire(); surfaces.Add(Acquire());
        Creates++; Create?.Invoke(); brushes.Add(Acquire()); visuals.Add(Acquire());
    }
    private void Redraw() { Draws++; Draw?.Invoke(); }
    public void Start() => Render();
    public void Invalidate() => QueueRedraw();
    public void NotifyLoss() => DeviceLost(device!, new object());
    public void ReplaceLifetime() { generation++; queued = false; recoveryFailed = false; ReleaseGraphics(); Render(); }
    ${methods.replaceAll('CanvasDevice', 'FakeDevice')}
}
sealed class FakeDevice(Action report) {
    public event Action<FakeDevice, object>? DeviceLost;
    public int Subscriptions => DeviceLost?.GetInvocationList().Length ?? 0;
    public bool IsDeviceLost(int result) => result == unchecked((int)0x887A0005);
    public void RaiseDeviceLost() { report(); DeviceLost?.Invoke(this, new object()); }
}
sealed class FakeResource : IDisposable {
    public bool Closed, Attempted;
    public Exception? Failure;
    public void Dispose() { Attempted = true; if (Failure is { } error) throw error; Closed = true; }
}
static class ElementCompositionPreview { public static void SetElementChildVisual(object owner, object? visual) { } }
sealed class FakeDispatcher {
    private readonly Queue<Action> pending = new();
    public bool TryEnqueue(Action action) { pending.Enqueue(action); return true; }
    public void Drain() { var count = 0; while (pending.TryDequeue(out var action)) {
        if (++count > 20) throw new Exception("Unbounded recovery queue"); action();
    } }
}
sealed class ThrowsOnDispose(Exception error) : IDisposable { public void Dispose() => throw error; }
`;
const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'labui-device-loss-'));
try {
  await writeFile(path.join(directory, 'Boundary.csproj'), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>');
  await writeFile(path.join(directory, 'Program.cs'), program);
  const result = spawnSync(process.env.DOTNET_HOST_PATH || 'dotnet', ['run', '--project', path.join(directory, 'Boundary.csproj'), '--verbosity', 'quiet'], { encoding: 'utf8', windowsHide: true });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  const resolved = await realpath(directory);
  const relative = path.relative(temporaryRoot, resolved);
  assert.ok(relative && !path.isAbsolute(relative) && relative !== '..'
    && !relative.startsWith(`..${path.sep}`) && !relative.includes(path.sep)
    && path.basename(resolved).startsWith('labui-device-loss-'), `Unsafe cleanup target: ${resolved}`);
  await rm(resolved, { recursive: true, force: true });
}
