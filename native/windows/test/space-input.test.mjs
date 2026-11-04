import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Компилируется весь helper. Ни одна проверка не вызывает настоящую границу Win32.
const source = await readFile(new URL('./space-input.cs', import.meta.url), 'utf8');
const program = `
using System.Runtime.InteropServices;
using System.Text.Json;

static void Check(bool value, string reason) { if (!value) throw new Exception(reason); }
static Exception Reject(Fake platform, string expected) {
    try { SpaceInput.Run(platform, 42, 100); }
    catch (Exception error) {
        Check(error.Message.Contains(expected), "Wrong failure: " + error);
        return error;
    }
    throw new Exception("Bad sequence was accepted: " + expected);
}
static void Sequence(Fake platform, params bool[] expected) {
    Check(platform.Sent.SequenceEqual(expected), "Unexpected native sends: " + string.Join(",", platform.Sent));
}

Environment.SetEnvironmentVariable("GITHUB_ACTIONS", "false");
try { SpaceInput.Run(42, 100); throw new Exception("Native facade ignored hosted-only boundary"); }
catch (InvalidOperationException error) { Check(error.Message.Contains("hosted"), "Wrong guard failure"); }

Check(IntPtr.Size == 8, "This fixture qualifies the Windows x64 structure");
Check(Marshal.SizeOf<SpaceInput.NativeInput>() == 40, "INPUT x64 size must include the full union");
Check(Marshal.OffsetOf<SpaceInput.NativeInput>("data").ToInt32() == 8, "INPUT union alignment");
foreach (bool down in new[] { true, false }) {
    var packet = SpaceInput.Packet(down);
    Check(packet.type == 1 && packet.data.keyboard.virtualKey == 0x20 && packet.data.keyboard.scan == 0 &&
        packet.data.keyboard.flags == (down ? 0u : 2u) && packet.data.keyboard.time == 0 &&
        packet.data.keyboard.extraInfo == UIntPtr.Zero, "Malformed Space packet");
}

var good = new Fake();
var receipt = SpaceInput.Run(good, 42, 100);
Sequence(good, true, false, true, false);
Check(good.Delays.SequenceEqual(new[] { 80, 50, 80 }), "Wrong history of separate edges");
Check(receipt.pid == 42 && receipt.window == 100 && receipt.clockFrequency == 1000, "Receipt identity lost");
Check(receipt.events.Length == 4 && receipt.events.All(e => e.accepted == 1), "Missing accepted events");
long previous = long.Parse(receipt.startedTicks);
foreach (var item in receipt.events) {
    Check(long.Parse(item.startedTicks) >= previous && long.Parse(item.completedTicks) >= long.Parse(item.startedTicks), "Nonmonotonic receipt");
    previous = long.Parse(item.completedTicks);
}
Check(long.Parse(receipt.completedTicks) >= previous, "Sequence end precedes event");
using (var json = JsonDocument.Parse(JsonSerializer.Serialize(receipt))) {
    Check(json.RootElement.GetProperty("startedTicks").GetString() == "9007199254740993", "Int64 ticks were rounded or not strings");
}

foreach (int key in new[] { 0x20, 0x10, 0x11, 0x12, 0x5b, 0x5c }) {
    var held = new Fake(); held.Keys.Add(key);
    Reject(held, key == 0x20 ? "Space" : "Модификатор");
    Sequence(held);
    Check(held.Keys.Contains(key), "Preexisting hold was released");
}
foreach (string fault in new[] { "foreground", "root", "pid", "foreground-pid", "missing" }) {
    var wrong = new Fake { IdentityFault = fault };
    Reject(wrong, "Foreground"); Sequence(wrong);
}

for (int failureAt = 0; failureAt < 4; failureAt++) {
    var failedSend = new Fake { RejectSendAt = failureAt };
    var error = Reject(failedSend, "SendInput");
    var expected = new[] { true, false, true, false }.Take(failureAt + 1).ToList();
    if (failureAt % 2 == 1) expected.Add(false);
    Sequence(failedSend, expected.ToArray());
    Check(error.Data["spaceInputReceipt"] is SpaceInput.Receipt, "Failure lost the exact send receipt");
    Check(error.Data["spaceInputStillHeld"] is false, "Successful cleanup retained hold");
}

var lost = new Fake { OnDelay = (p, n) => p.IdentityFault = "foreground" };
Reject(lost, "Foreground"); Sequence(lost, true, false);
var timedOut = new Fake { OnDelay = (p, n) => p.Now += 6000 };
Reject(timedOut, "5 секунд"); Sequence(timedOut, true, false);
var delayFailed = new Fake { OnDelay = (p, n) => throw new InvalidOperationException("delay failed") };
Reject(delayFailed, "delay failed"); Sequence(delayFailed, true, false);
var readAfterSendFailed = new Fake { FailTimestampAfterFirstSend = true };
Reject(readAfterSendFailed, "timestamp failed"); Sequence(readAfterSendFailed, true, false);
var midModifier = new Fake { OnDelay = (p, n) => { if (n == 2) p.Keys.Add(0x11); } };
Reject(midModifier, "Модификатор"); Sequence(midModifier, true, false);
var foreignSpace = new Fake { OnDelay = (p, n) => { if (n == 2) p.Keys.Add(0x20); } };
Reject(foreignSpace, "Space"); Sequence(foreignSpace, true, false);
Check(foreignSpace.Keys.Contains(0x20), "Another hold acquired between presses was released");

var cleanupFailed = new Fake { RejectSendAt = 1, RejectFromSend = 2 };
var primary = Reject(cleanupFailed, "SendInput");
Sequence(cleanupFailed, true, false, false);
Check(primary.Data["spaceInputCleanupError"] is string && primary.Data["spaceInputStillHeld"] is true,
    "Cleanup failure replaced primary error or hid the remaining hold");
var throwingCleanup = new Fake { OnDelay = (p, n) => { p.ThrowSend = true; throw new InvalidOperationException("primary"); } };
var preserved = Reject(throwingCleanup, "primary");
Check(preserved.Data["spaceInputCleanupError"] is string && throwingCleanup.Sent.Count == 2, "Thrown cleanup was lost or retried");
Console.WriteLine("Space input contract: PASS (four edges, identity, hold ownership, cleanup, x64 ABI, exact ticks)");

sealed class Fake : SpaceInput.Platform {
    public long Now = 9007199254740993;
    public long Timestamp {
        get {
            if (FailTimestampAfterFirstSend && Sent.Count == 1) {
                FailTimestampAfterFirstSend = false;
                throw new InvalidOperationException("timestamp failed");
            }
            return Now;
        }
    }
    public long Frequency => 1000;
    public string IdentityFault = "";
    public long Foreground => IdentityFault == "missing" ? 0 : IdentityFault == "foreground" ? 200 : 101;
    public long Root(long window) => IdentityFault == "root" || window == 200 ? 200 : 100;
    public int Process(long window) => IdentityFault == "pid" || IdentityFault == "foreground-pid" && window == 101 ? 99 : 42;
    public HashSet<int> Keys = new();
    public bool IsDown(int key) => Keys.Contains(key);
    public int LastError => 5;
    public List<bool> Sent = new();
    public List<int> Delays = new();
    public int RejectSendAt = -1, RejectFromSend = int.MaxValue;
    public bool ThrowSend;
    public bool FailTimestampAfterFirstSend;
    public Action<Fake, int> OnDelay;
    public uint Send(bool down) {
        int index = Sent.Count;
        Sent.Add(down); Now++;
        if (ThrowSend) throw new InvalidOperationException("send threw");
        if (index == RejectSendAt || index >= RejectFromSend) return 0;
        if (down) Keys.Add(0x20); else Keys.Remove(0x20);
        return 1;
    }
    public void Delay(int milliseconds) { Delays.Add(milliseconds); Now += milliseconds; OnDelay?.Invoke(this, Delays.Count); }
}
`;

const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'labui-space-input-'));
try {
  await writeFile(
    path.join(directory, 'Boundary.csproj'),
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>disable</Nullable></PropertyGroup></Project>',
  );
  await writeFile(path.join(directory, 'SpaceInput.cs'), source);
  await writeFile(path.join(directory, 'Program.cs'), program);
  const result = spawnSync(
    process.env.DOTNET_HOST_PATH || 'dotnet',
    ['run', '--project', path.join(directory, 'Boundary.csproj'), '--verbosity', 'quiet'],
    { encoding: 'utf8', windowsHide: true, timeout: 120000 },
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Actual SpaceInput contract failed');
} finally {
  const resolved = await realpath(directory);
  const relative = path.relative(temporaryRoot, resolved);
  assert.ok(
    relative &&
      !path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !relative.includes(path.sep) &&
      path.basename(resolved).startsWith('labui-space-input-'),
    `Unsafe cleanup target: ${resolved}`,
  );
  await rm(resolved, { recursive: true, force: true });
}
