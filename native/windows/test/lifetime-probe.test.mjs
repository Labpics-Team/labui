import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Как и device-loss.test: исполняются тела consumer, внешние границы подменены.
// Это проверка силы oracle; настоящий WinUI/input остаётся отдельным запуском.
const source = await readFile(
  new URL('../../../examples/windows/LifetimeProbe.cs', import.meta.url),
  'utf8',
);
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
const methods = [
  method('private void RemoveDuringPress()'),
  method('private void Transition('),
].join('\n');
const releaseMethods = [
  source.match(/private const float ProgressTolerance[^;]*;/)?.[0] || '',
  method('private bool NewPressSettled()'),
  method('internal async void Complete()').replace(
    'internal async void Complete()',
    'public async Task Complete()',
  ),
].join('\n');
const program = `
static void Check(bool value, string message) { if (!value) throw new Exception(message); }
foreach (var delayed in new[] { true, false }) {
    var probe = new Probe(delayed);
    probe.Remove();
    Check(probe.RemovedAtPosition > 0 && probe.RemovedAtPosition < 1,
        "Publication delayed removal until the compositor had already settled");
    Check(!probe.Actions.Contains("publish") || probe.Actions.IndexOf("remove") < probe.Actions.IndexOf("publish"),
        "Evidence publication must occur after removal");
}
Console.WriteLine("lifetime publication boundary: PASS");

foreach (var (idle, current, expected) in new[] {
    (1f, 1f, false), (0f, 1f, false), (1f, 0f, false),
    (.002f, .002f, false), (.0005f, .0005f, true), (0f, 0f, true)
}) {
    var probe = new ReleaseProbe(idle, current);
    Check(probe.Settled() == expected, "Released button accepted idle/current away from zero");
}
var good = new ReleaseProbe(0, 0);
await good.Complete();
Check(good.Ended == "Passed", "Correct release must complete");
var drift = new ReleaseProbe(0, 0, drift: true);
await drift.Complete();
Check(drift.Ended == "Failed", "Release changed during observation window but still passed");
Console.WriteLine("lifetime release boundary: PASS");

sealed class ReleaseProbe {
    private enum Phase { Restored, Completing, Passed, Failed }
    private Phase phase = Phase.Restored;
    private readonly FakeDispatcher dispatcher = new();
    private readonly FakeButton button = new() { IsPressed = false };
    private readonly FakeMotion newHover = new(), newPressed = new();
    private readonly FakeMotion oldHover = new() { Disposed = true }, oldPressed = new() { Disposed = true };
    private readonly bool hoverField = true, pressedField = false;
    private readonly FakeClock clock = new();
    private readonly List<Sample> samples;
    private readonly int restoredClicks = 1, countBefore = 11;
    private int lateObservations = 0, overflow = 0;
    private readonly double detachedAtMs = 0;
    public string Ended => phase.ToString();
    public ReleaseProbe(float idle, float current, bool drift = false) {
        newPressed.Position = current;
        samples = [new("new", "pressed", new(MotionOrigin.Animation, "value", .4f)),
            new("new", "pressed", new(MotionOrigin.Animation, "idle", idle))];
        var reads = 0;
        clock.OnRead = () => { clock.Milliseconds += 20;
            if (drift && ++reads >= 3) newPressed.Position = 1;
        };
    }
    public bool Settled() => NewPressSettled();
    private FakeMotion Channel(bool hover) => hover ? newHover : newPressed;
    private int activationCount() => countBefore + 1;
    private void Transition(Phase value) => phase = value;
    private void Add(string kind, object value) { }
    private void Cleanup() { }
    private void Fail(Exception error) => phase = Phase.Failed;
    private static bool RejectsPosition(FakeMotion motion) => motion.Disposed;
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    ${releaseMethods}
}
enum MotionOrigin { Animation }
sealed record MotionObservation(MotionOrigin Origin, string Phase, float ReadbackPosition);
sealed record Sample(string Generation, string Channel, MotionObservation Motion);
sealed class FakeDispatcher { public bool HasThreadAccess => true; }

sealed class Probe {
    private enum Phase { Armed, Removing, Passed, Failed }
    private Phase phase = Phase.Armed;
    private readonly FakeButton button = new();
    private readonly FakeMotion oldHover = new(), oldPressed = new();
    private readonly bool hoverField = true, pressedField = false;
    private readonly FakeClock clock = new();
    private readonly FakeTimer deadline = new();
    private readonly FakeParent parent;
    private readonly int countBefore = 0;
    private double expiresAtMs;
    private readonly bool delayed;
    public List<string> Actions { get; } = [];
    public float RemovedAtPosition;
    public Probe(bool delayed) {
        this.delayed = delayed;
        parent = new(() => {
            Actions.Add("remove"); RemovedAtPosition = oldPressed.Position;
            button.IsLoaded = false;
            return true;
        });
    }
    public void Remove() => RemoveDuringPress();
    private FakeMotion Channel(bool hover) => hover ? oldHover : oldPressed;
    private int activationCount() => 0;
    private void Add(string kind, object value) => Actions.Add(kind);
    private void Publish() {
        Actions.Add("publish");
        // Детерминированное продвижение независимого compositor за время I/O.
        if (delayed) { clock.Milliseconds += 1000; oldPressed.Position = 1; }
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    ${methods}
}
sealed class FakeMotion { public float Position { get; set; } = .4f; public bool Disposed; }
sealed class FakeButton { public bool IsLoaded = true, IsPressed = true; }
sealed class FakeClock {
    public double Milliseconds;
    public Action? OnRead;
    public TimeSpan Elapsed { get { OnRead?.Invoke(); return TimeSpan.FromMilliseconds(Milliseconds); } }
}
sealed class FakeTimer { public void Start() { } public void Stop() { } }
sealed class FakeParent(Func<bool> remove) { public FakeChildren Children { get; } = new(remove); }
sealed class FakeChildren(Func<bool> remove) { public bool Remove(FakeButton button) => remove(); }
`;
const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'labui-lifetime-'));
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
      path.basename(resolved).startsWith('labui-lifetime-'),
    `Unsafe cleanup target: ${resolved}`,
  );
  await rm(resolved, { recursive: true, force: true });
}
