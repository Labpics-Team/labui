import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dotnet = process.env.DOTNET_HOST_PATH || 'dotnet';
const program = `
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using LabUI.Buttons;

static void Check(bool value, string message) { if (!value) throw new Exception(message); }
if (args.FirstOrDefault() == "cleanup-hold") {
    using var ready = EventWaitHandle.OpenExisting(args[1]);
    using var release = EventWaitHandle.OpenExisting(args[2]);
    ready.Set();
    Check(release.WaitOne(30000), "Pipe fixture release deadline");
    return;
}
if (args.FirstOrDefault() == "cleanup-inherited") {
    var info = new ProcessStartInfo(Path.ChangeExtension(typeof(Program).Assembly.Location, ".exe")) {
        UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true
    };
    foreach (var argument in new[] { "cleanup-hold", args[1], args[2] }) info.ArgumentList.Add(argument);
    using var holder = Process.Start(info) ?? throw new Exception("Pipe holder not started");
    using var ready = EventWaitHandle.OpenExisting(args[1]);
    Check(ready.WaitOne(10000), "Pipe holder startup deadline");
    Console.WriteLine(holder.Id);
    return;
}
if (args.FirstOrDefault() == "cleanup-eof") { Console.Error.Write("healthy-stderr"); return; }
if (args.FirstOrDefault() == "child") {
    await SpaceProtocol.RunAsync(Console.OpenStandardInput(), Console.OpenStandardOutput(),
        command => Task.FromResult<object>(new { command, pid = Environment.ProcessId }));
    return;
}
async Task<string> Run(string command, Func<string, Task<object>> dispatch, bool allowDynamic = false) {
    using var input = new MemoryStream(Encoding.UTF8.GetBytes(command));
    using var output = new MemoryStream();
    await SpaceProtocol.RunAsync(input, output, dispatch, allowDynamic);
    return Encoding.UTF8.GetString(output.ToArray());
}
var calls = 0;
var text = await Run("arm Light\\ncomplete\\n", command => {
    calls++; return Task.FromResult<object>(new { command, phase = Phase.Idle, nested = new Motion { Position = .25f } });
});
var replies = text.Trim().Split('\\n').Select(row => JsonDocument.Parse(row).RootElement).ToArray();
Check(calls == 2 && replies.Length == 2, "Lost protocol command/reply");
Check(replies[0].GetProperty("id").GetInt32() == 1 && replies[1].GetProperty("id").GetInt32() == 2, "Lost reply order");
Check(replies[0].GetProperty("value").GetProperty("phase").GetString() == "Idle", "Enum lost");
Check(replies[0].GetProperty("value").GetProperty("nested").GetProperty("position").GetSingle() == .25f, "Field lost");
calls = 0;
var readyText = await Run("ready 1\\nready 2\\n", command => {
    calls++; return Task.FromResult<object>(new { command, status = "waiting" });
});
var readyReplies = readyText.Trim().Split('\\n').Select(row => JsonDocument.Parse(row).RootElement).ToArray();
Check(calls == 2 && readyReplies.Length == 2 && readyReplies.All(reply => reply.GetProperty("ok").GetBoolean()),
    "Passive readiness commands did not reach the existing dispatcher");
foreach (var command in new[] { "ready 0", "ready 3", "ready 01", "ready 1 2" }) {
    calls = 0;
    var rejected = await Run(command + "\\n", _ => { calls++; return Task.FromResult<object>(new { }); });
    Check(calls == 0 && !JsonDocument.Parse(rejected).RootElement.GetProperty("ok").GetBoolean(), "Unbounded readiness step accepted");
}
calls = 0;
var invalid = await Run("change-product-policy\\n", command => { calls++; return Task.FromResult<object>(new { }); });
Check(calls == 0 && !JsonDocument.Parse(invalid).RootElement.GetProperty("ok").GetBoolean(), "Unknown command reached owner");
foreach (var command in new[] { "dynamic arm", "dynamic prepare", "dynamic disable", "dynamic ready 1", "dynamic ready 2", "dynamic complete" }) {
    foreach (var enabled in new[] { false, true }) {
        calls = 0;
        var reply = await Run(command + "\\n", _ => { calls++; return Task.FromResult<object>(new { }); }, enabled);
        Check(calls == (enabled ? 1 : 0) && JsonDocument.Parse(reply).RootElement.GetProperty("ok").GetBoolean() == enabled,
            "Dynamic namespace crossed opt-in boundary");
    }
}
foreach (var command in new[] { "dynamic before", "dynamic ready 0", "dynamic ready 3", "dynamic disable again" }) {
    calls = 0;
    var reply = await Run(command + "\\n", _ => { calls++; return Task.FromResult<object>(new { }); }, true);
    Check(calls == 0 && !JsonDocument.Parse(reply).RootElement.GetProperty("ok").GetBoolean(), "Internal/unbounded dynamic command reached owner");
}
var polling = await Run(string.Concat(Enumerable.Repeat("complete\\n", 202)),
    _ => Task.FromResult<object>(new { status = "waiting" }));
Check(polling.Trim().Split('\\n').Length == 202, "Two bounded polling windows cannot complete");
var twoThemes = "arm Light\\n" + string.Concat(Enumerable.Repeat("ready 1\\n", 120)) + "ready 2\\ncomplete\\n" +
    "arm Dark\\n" + string.Concat(Enumerable.Repeat("ready 1\\n", 120)) + "ready 2\\ncomplete\\n";
var composed = await Run(twoThemes, _ => Task.FromResult<object>(new { status = "waiting" }));
Check(composed.Trim().Split('\\n').Length == 246, "Bounded readiness polls lost a theme or command");
calls = 0;
try {
    await Run("arm Light\\n" + string.Concat(Enumerable.Repeat("ready 1\\n", 128)) +
        "arm Dark\\n" + string.Concat(Enumerable.Repeat("ready 2\\n", 128)), _ => { calls++; return Task.FromResult<object>(new { }); });
    throw new Exception("Readiness polling removed the shared command bound");
} catch (InvalidDataException) { Check(calls == 256, "Readiness reset the command budget at the second theme"); }
foreach (var input in new[] { new string('x', 33) + "\\n", "arm Light" }) {
    try { await Run(input, _ => Task.FromResult<object>(new { })); throw new Exception("Malformed command accepted"); }
    catch (InvalidDataException) { }
}
var large = await Run("complete\\n", _ => Task.FromResult<object>(new { data = new string('x', 128 * 1024) }));
Check(!JsonDocument.Parse(large).RootElement.GetProperty("ok").GetBoolean(), "Oversized response accepted");
Check(await SpaceProtocol.ReadLineAsync(new StringReader("123\\n"), 3) == "123", "Legal boundary rejected");
foreach (var input in new[] { "1234\\n", "123" }) {
    try { await SpaceProtocol.ReadLineAsync(new StringReader(input), 3); throw new Exception("Invalid stdout accepted"); }
    catch (InvalidDataException) { }
}
Check((await SpaceProtocol.ReadErrorAsync(new StringReader(new string('e', 32 * 1024)))).Length == 32 * 1024, "Legal stderr rejected");
try { await SpaceProtocol.ReadErrorAsync(new StringReader(new string('e', 32 * 1024 + 1))); throw new Exception("Unbounded stderr"); }
catch (InvalidDataException) { }

// Настоящий WinExe с перенаправленными pipes; приложение не создаёт UI и не вызывает Win32 input.
var executable = Path.ChangeExtension(typeof(Program).Assembly.Location, ".exe");
var start = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true,
    RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
start.ArgumentList.Add("child");
start.Environment["DOTNET_ROOT"] = args[0];
using var child = Process.Start(start) ?? throw new Exception("Child not started");
var stderr = SpaceProtocol.ReadErrorAsync(child.StandardError);
try {
    foreach (var command in new[] { "arm Light", "complete" }) {
        var line = SpaceProtocol.ReadLineAsync(child.StandardOutput, 128 * 1024);
        await child.StandardInput.WriteLineAsync(command);
        await child.StandardInput.FlushAsync();
        var reply = JsonDocument.Parse(await line.WaitAsync(TimeSpan.FromSeconds(5)) ?? throw new Exception("Child EOF"));
        Check(reply.RootElement.GetProperty("ok").GetBoolean(), "Child reply failed");
        Check(reply.RootElement.GetProperty("value").GetProperty("pid").GetInt32() == child.Id, "Wrong child identity");
    }
    child.StandardInput.Close();
    await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
    Check(child.ExitCode == 0 && (await stderr).Length == 0, "EOF did not close cleanly");
} finally {
    if (!child.HasExited) { child.Kill(); child.WaitForExit(5000); }
}
Console.WriteLine("Space protocol: bounded messages, exact serializer, WinExe pipes and EOF PASS");
enum Phase { Idle }
sealed class Motion { public float Position; }
`;

test('real Space protocol bounds messages and completes a redirected WinExe child on EOF', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'labui-space-protocol-'));
  try {
    await writeFile(
      join(dir, 'SpaceProtocol.cs'),
      await readFile(join(root, 'examples/windows/SpaceProtocol.cs')),
    );
    await writeFile(join(dir, 'Program.cs'), program);
    await writeFile(
      join(dir, 'Probe.csproj'),
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>WinExe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>',
    );
    const build = spawnSync(
      dotnet,
      [
        'build',
        join(dir, 'Probe.csproj'),
        '--verbosity',
        'quiet',
        '-target:Build',
        '-getProperty:DOTNET_HOST_PATH',
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
    assert.equal(build.status, 0, build.stdout + build.stderr);
    // SDK сообщает путь выбранного host; имя команды из PATH не является путём к runtime.
    const host = build.stdout.trim();
    assert.ok(isAbsolute(host), `SDK did not report an absolute host path: ${host}`);
    const dotnetRoot = dirname(host);
    const fixtureEnvironment = { ...process.env, DOTNET_DISABLE_GUI_ERRORS: '1' };
    const run = spawnSync(host, [join(dir, 'bin/Debug/net10.0/Probe.dll'), dotnetRoot], {
      encoding: 'utf8',
      timeout: 30_000,
      env: fixtureEnvironment,
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /WinExe pipes and EOF PASS/);
    const cleanup = spawnSync(
      process.env.PWSH_PATH || 'pwsh',
      [
        '-NoProfile',
        '-File',
        join(root, 'native/windows/test/space-cleanup.test.ps1'),
        '-PipeFixture',
        join(dir, 'bin/Debug/net10.0/Probe.exe'),
        '-DotnetRoot',
        dotnetRoot,
      ],
      { encoding: 'utf8', timeout: 45_000, env: fixtureEnvironment },
    );
    assert.equal(cleanup.status, 0, cleanup.error || cleanup.stdout + cleanup.stderr);
    assert.match(
      cleanup.stdout,
      /real-inherited PASS.*stdout=Canceled stderr=Canceled handlesClosed=True/,
    );
    assert.match(cleanup.stdout, /real-eof PASS/);
    process.stdout.write(cleanup.stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('native product compile excludes test-only input and protocol helpers', () => {
  const read = spawnSync(
    dotnet,
    ['msbuild', join(root, 'native/windows/LabUI.WinUI.csproj'), '-getItem:Compile'],
    { encoding: 'utf8', timeout: 60_000 },
  );
  assert.equal(read.status, 0, read.stdout + read.stderr);
  const items = JSON.parse(read.stdout).Items.Compile.map((item) =>
    item.Identity.replaceAll('\\', '/'),
  );
  assert.ok(items.includes('LabButton.cs'), 'Product compile must remain populated');
  assert.ok(
    items.every((item) => !item.startsWith('test/')),
    'Input helper leaked into native product',
  );
});
