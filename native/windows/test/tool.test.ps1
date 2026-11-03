param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }

$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($Harness, [ref]$tokens, [ref]$parseErrors)
Assert ($parseErrors.Count -eq 0) 'Не удалось разобрать smoke harness.'
# Загружаются определения функций; bootstrap, GUI и системные настройки не исполняются.
foreach ($definition in $ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] }) {
    . ([scriptblock]::Create($definition.Extent.Text))
}

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('labui-tool-fixture-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$script:cli = Join-Path $PSHOME 'pwsh.exe'
Assert (Test-Path -LiteralPath $script:cli) 'Тест требует pwsh рядом с исполняющим runtime.'
$clock = [Diagnostics.Stopwatch]::StartNew()
$commands = [Collections.Generic.List[object]]::new()
$events = [Collections.Generic.List[object]]::new()

function New-ToolEvents {
    $name = 'labui-tool-' + [guid]::NewGuid().ToString('N')
    $ready = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, "$name-ready")
    $release = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, "$name-release")
    $done = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, "$name-done")
    $value = @{ readyName="$name-ready"; releaseName="$name-release"; doneName="$name-done";
        ready=$ready; release=$release; done=$done; hasDescendant=$false }
    $events.Add($value)
    return $value
}

function New-HeldPipeCode($Signals, [ValidateSet('both', 'stdout', 'stderr')][string]$Channel = 'both') {
    $Signals.hasDescendant = $true
    $Signals.channel = $Channel
    # Потомок наследует stdout/stderr, но не запускает приложение или UI.
    $descendant = @'
$ready=[Threading.EventWaitHandle]::OpenExisting('__READY__')
$release=[Threading.EventWaitHandle]::OpenExisting('__RELEASE__')
$done=[Threading.EventWaitHandle]::OpenExisting('__DONE__')
try {
    if ('__CHANNEL__' -ne 'stdout') { [Console]::Error.WriteLine('held stderr') }
    $null=$ready.Set()
    if (!$release.WaitOne(12000)) { [Console]::Error.WriteLine('fixture safety deadline') }
} finally { $null=$done.Set(); $ready.Dispose(); $release.Dispose(); $done.Dispose() }
'@
    $descendant = $descendant.Replace('__READY__', $Signals.readyName).Replace('__RELEASE__', $Signals.releaseName).
        Replace('__DONE__', $Signals.doneName).Replace('__CHANNEL__', $Channel)
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($descendant))
    return @'
if ('__CHANNEL__' -ne 'both') {
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class FixtureInheritance { [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr GetStdHandle(int id); [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags); }'
    $unused = if ('__CHANNEL__' -eq 'stderr') { -11 } else { -12 }
    if (![FixtureInheritance]::SetHandleInformation([FixtureInheritance]::GetStdHandle($unused), 1, 0)) {
        throw [ComponentModel.Win32Exception]::new([Runtime.InteropServices.Marshal]::GetLastWin32Error())
    }
}
$info=[Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME 'pwsh.exe'))
$info.UseShellExecute=$false; $info.CreateNoWindow=$true
$info.RedirectStandardOutput='__CHANNEL__' -eq 'stderr'
$info.RedirectStandardError='__CHANNEL__' -eq 'stdout'
foreach($argument in @('-NoProfile','-NonInteractive','-EncodedCommand','__CODE__')) { $info.ArgumentList.Add($argument) }
$child=[Diagnostics.Process]::Start($info)
$ready=[Threading.EventWaitHandle]::OpenExisting('__READY__')
try { if (!$ready.WaitOne(10000)) { throw 'descendant startup deadline' } }
finally { $ready.Dispose() }
$child.Dispose()
[Console]::WriteLine(' {"ok":true,"value":"preserved"} ')
'@.Replace('__CODE__', $encoded).Replace('__CHANNEL__', $Channel).Replace('__READY__', $Signals.readyName)
}

function Invoke-ToolCase([string]$Name, [string]$Code, [bool]$MustFail, [string]$ErrorPattern = '', $Signals = $null,
    [bool]$ExpectAlreadyExited = $true, [int]$CommandTimeout = 5000,
    [ValidateSet('none', 'line', 'pending')][string]$Recording = 'none', [switch]$ExpectCleanupError,
    [switch]$DeferredCancellation) {
    $script:output = Join-Path $fixtureRoot $Name
    New-Item -ItemType Directory -Path $script:output | Out-Null
    $tool = Start-Tool $Name @('-NoProfile', '-NonInteractive', '-Command', $Code) -Recording:($Recording -ne 'none')
    $handle = $tool.process.SafeHandle
    try {
        if ($Signals) {
            $ready = $Signals.ready.WaitOne(15000)
            if (!$ready -and $tool.stderr -and $tool.stderr.IsCompleted) { Write-Output $tool.stderr.GetAwaiter().GetResult() }
            Assert $ready 'Дочерний процесс не подтвердил готовность.'
        }
        if ($ExpectAlreadyExited) { Assert ($tool.process.WaitForExit(10000)) 'Прямой процесс fixture не завершился.' }
        if ($Recording -ne 'none') {
            $tool.prefix = "already read recorder prefix`n"
            $tool.lineTask = $tool.stderrReader.ReadLineAsync($tool.cancellation.Token).AsTask()
            if ($Recording -eq 'pending') {
                Assert ($tool.lineTask.Wait(10000)) 'Recorder fixture не записал первую строку.'
                $tool.prefix += "$($tool.lineTask.GetAwaiter().GetResult())`n"
                $tool.lineTask = $tool.stderrReader.ReadLineAsync($tool.cancellation.Token).AsTask()
                Assert (!$tool.lineTask.IsCompleted) 'Recorder fixture не удерживает незавершённую строку.'
            }
        }
        if ($DeferredCancellation) {
            foreach ($stream in @('stdout', 'stderr', 'lineTask')) {
                if ($null -ne $tool[$stream]) { $tool[$stream] = [ToolReadCompletion]::DeferCancellation($tool[$stream]) }
            }
        }
        $before = @{ exited=$tool.process.HasExited; stdoutDone=$tool.stdout.IsCompleted;
            stderrDone=($null -ne $tool.stderr -and $tool.stderr.IsCompleted) }
        if ($before.exited) { $before.exitCode = $tool.process.ExitCode }
        if ($Signals -and $ExpectAlreadyExited) {
            Assert (!$before.stdoutDone -or !$before.stderrDone) 'Fixture не удерживает pipe после выхода прямого процесса.'
            if ($Signals.channel -eq 'stderr') { Assert ($tool.stdout.Wait(3000)) 'Fixture удерживает лишний stdout.' }
            if ($Signals.channel -eq 'stdout') { Assert ($tool.stderr.Wait(3000)) 'Fixture удерживает лишний stderr.' }
        }
        $elapsed = [Diagnostics.Stopwatch]::StartNew()
        $failure = $null; $value = $null
        try { $value = Finish-Tool $tool -Timeout $CommandTimeout } catch { $failure = $_ }
        $elapsed.Stop()
        Write-Output ("Tool case: $Name rejected=$($null -ne $failure) elapsedMs=$($elapsed.ElapsedMilliseconds) ended=$($tool.ended) handleClosed=$($handle.IsClosed)")
        Assert (($null -ne $failure) -eq $MustFail) "Неверный исход завершения: $Name."
        if ($MustFail) {
            if ($failure.Exception.Message -notmatch $ErrorPattern) {
                Write-Output ($before | ConvertTo-Json -Compress)
                Write-Output $failure.ScriptStackTrace
            }
            Assert ($failure.Exception.Message -match $ErrorPattern) "Отказ $Name вызван другой причиной: $($failure.Exception.Message)"
        }
        else {
            Assert ($value.ok -eq $true -and $value.value -ceq 'preserved') 'Потерян полезный JSON stdout.'
            $raw = [IO.File]::ReadAllText((Join-Path $script:output "$Name.json"))
            Assert ($raw.Contains('"value":"preserved"')) 'Потерян исходный stdout в диагностике.'
            $stderr = [IO.File]::ReadAllText((Join-Path $script:output "$Name.stderr.log"))
            Assert ($stderr.Contains('diagnostic stderr')) 'Потерян диагностический stderr.'
        }
        if ($ExpectCleanupError) {
            Assert ($failure.Exception.Data.Contains('winappCleanupError')) 'Вторичная ошибка cleanup потеряна.'
        }
        if ($Recording -ne 'none') {
            $stderr = [IO.File]::ReadAllText((Join-Path $script:output "$Name.stderr.log"))
            Assert ($stderr.Contains('already read recorder prefix')) 'Потеряны уже прочитанные строки recorder.'
            if ($Recording -eq 'pending') { Assert ($stderr.Contains('held stderr')) 'Потеряна строка перед незавершённым хвостом recorder.' }
        }
        Assert ($tool.ended -and $handle.IsClosed) 'Собственный process handle не закрыт.'
        foreach ($stream in @('stdout', 'stderr', 'lineTask')) {
            $task = $tool[$stream]
            if ($null -ne $task) { Assert $task.IsCompleted "После cleanup осталось незавершённое чтение: $Name / $stream ($($task.Status))." }
        }
        # Короткий command budget плюс отдельная cleanup-фаза 5 с; запас не является новым бюджетом операции.
        Assert ($elapsed.ElapsedMilliseconds -lt ($CommandTimeout + 5000 + 2500)) 'Завершение вышло за command + cleanup budget.'
    } finally {
        if ($Signals) {
            $null = $Signals.release.Set()
            if ($Signals.hasDescendant) { Assert ($Signals.done.WaitOne(10000)) 'Потомок fixture не подтвердил освобождение.' }
        }
        if (!$tool.ended) { try { Close-Tool $tool } catch { Write-Output "Fixture cleanup: $($_.Exception.Message)" } }
        foreach ($task in @($tool.stdout, $tool.stderr, $tool.lineTask) | Where-Object { $null -ne $_ }) {
            try { $null = $task.Wait(5000) } catch { }
        }
    }
}

# На границе чтения моделируется задержка отмены: две последовательные задачи
# расходуют один бюджет. Таймер начинается при первом наблюдении process.HasExited.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
public static class ToolReadCompletion {
    public static async Task<string> DeferCancellation(Task<string> read) {
        try { return await read.ConfigureAwait(false); }
        catch (OperationCanceledException) {
            // Отмена реального pipe уже завершилась; её ACK остаётся асинхронным.
            await Task.Delay(250).ConfigureAwait(false);
            throw;
        }
    }
}
public sealed class ToolReadBoundary : IDisposable {
    public readonly TaskCompletionSource<string> Line = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public readonly TaskCompletionSource<string> Tail = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Timer lineTimer, safetyTimer;
    private bool started;
    public bool Disposed { get; private set; }
    public bool HasExited { get {
        if (!started) {
            started = true;
            lineTimer = new Timer(_ => Line.TrySetResult("boundary first line"), null, 3500, Timeout.Infinite);
            safetyTimer = new Timer(_ => Tail.TrySetResult("safety deadline"), null, 12000, Timeout.Infinite);
        }
        return true;
    } }
    public Task<string> ReadToEndAsync(CancellationToken token) => Tail.Task;
    public void Dispose() {
        if (Disposed) return;
        Disposed = true;
        lineTimer?.Dispose(); safetyTimer?.Dispose();
        Line.TrySetCanceled(); Tail.TrySetCanceled();
    }
}
public sealed class AppExitBoundary : IDisposable {
    public bool Exited, Disposed;
    public int Stops;
    public int Id => -1;
    public string Path => "fixture-owned-app";
    public DateTime StartTime => new DateTime(2026, 1, 1);
    public bool HasExited => Exited;
    public int ExitCode => 0;
    public readonly List<int> Waits = new();
    public void Refresh() { }
    public bool CloseMainWindow() => true;
    public bool WaitForExit(int timeout) { Waits.Add(timeout); return Exited; }
    public void WaitForExit() { throw new InvalidOperationException("unbounded app wait"); }
    public void Dispose() { Disposed = true; }
}
// В отдельном тестовом процессе этот тип не вызывает системные API.
public static class ClientAreaAnimation {
    public static bool Value;
    public static int Writes;
    public static void Write(bool value) { Value = value; Writes++; }
    public static bool Read() => Value;
}
'@

function Assert-SharedCleanupBudget {
    $script:output = Join-Path $fixtureRoot 'shared-cleanup'
    New-Item -ItemType Directory -Path $script:output | Out-Null
    $boundary = [ToolReadBoundary]::new()
    $tool = @{ name='shared-cleanup'; ended=$false; prefix=''; process=$boundary;
        cancellation=[Threading.CancellationTokenSource]::new();
        stdout=[Threading.Tasks.Task]::FromResult[string]('{}'); stderr=$null;
        lineTask=$boundary.Line.Task; stdoutReader=$boundary; stderrReader=$boundary }
    $elapsed = [Diagnostics.Stopwatch]::StartNew()
    $failure = $null
    try { Close-Tool $tool } catch { $failure = $_ } finally { $elapsed.Stop(); $boundary.Dispose() }
    Write-Output "Tool case: shared-cleanup rejected=$($null -ne $failure) elapsedMs=$($elapsed.ElapsedMilliseconds)"
    Assert ($null -ne $failure -and $failure.Exception.Message -match 'срок ожидания') 'Cleanup не отверг незавершённый хвост.'
    $log = [IO.File]::ReadAllText((Join-Path $script:output 'shared-cleanup.stderr.log'))
    Assert ($log.Contains('boundary first line')) 'Первая последовательная read-задача не достигнута.'
    Assert ($elapsed.ElapsedMilliseconds -lt 6500) 'Последовательные чтения получили независимые cleanup budgets.'
    Assert ($tool.ended -and $boundary.Disposed) 'Cleanup не освободил boundary после отказа.'
}

function Assert-AppCleanup([bool]$AlreadyExited) {
    $output = Join-Path $fixtureRoot "app-cleanup-$AlreadyExited"
    New-Item -ItemType Directory -Path $output | Out-Null
    $process = [AppExitBoundary]::new()
    $process.Exited = $AlreadyExited
    $app = $process.Path; $started = $process.StartTime
    $close = @{}; $saved = @{}; $commands = @()
    $animationBefore = $true
    [ClientAreaAnimation]::Value = $false; [ClientAreaAnimation]::Writes = 0
    # Подменяется только граница ОС; исполняется настоящий внешний finally smoke.
    function Get-Process { param($Id, $ErrorAction) return $process }
    function Stop-Process { param($Id, [switch]$Force) $process.Stops++ }
    $outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })
    Assert ($outer.Count -eq 1 -and $null -ne $outer[0].Finally) 'Внешняя очистка smoke не найдена однозначно.'
    $finalizer = [scriptblock]::Create(($outer[0].Finally.Statements.Extent.Text -join "`n"))
    $failure = $null
    try { & $finalizer } catch { $failure = $_ }
    if ($AlreadyExited) {
        Assert ($null -eq $failure -and $process.Stops -eq 0 -and $process.Waits.Count -eq 0) 'Завершённое приложение не проходит здоровый cleanup.'
    } else {
        Assert ($null -ne $failure -and $failure.Exception.Message -match 'не завершилось после принудительного') 'Незавершённое приложение не отвергнуто после forced wait.'
        Assert ($process.Stops -eq 1 -and $process.Waits.Count -eq 2) 'Не проверены обе фазы завершения приложения.'
        Assert (@($process.Waits | Where-Object { $_ -lt 0 -or $_ -gt 5000 }).Count -eq 0) 'Ожидание приложения потеряло ограниченный бюджет.'
    }
    Assert ($process.Disposed -and [ClientAreaAnimation]::Writes -eq 1 -and [ClientAreaAnimation]::Value) 'Ошибка завершения не достигла восстановления и освобождения.'
    $result = Get-Content -LiteralPath (Join-Path $output 'close.json') -Raw | ConvertFrom-Json
    Assert ($result.animation.expected -and $result.animation.actual) 'Результат восстановления не записан.'
    Write-Output "Tool case: app-cleanup alreadyExited=$AlreadyExited restored=True"
}

function Assert-CaptureFailure([bool]$CleanupFails) {
    $window = 'fixture-window'
    $capture = @{ process=@{ HasExited=$true }; stderrReader=[IO.StringReader]::new('fixture recorder');
        cancellation=[Threading.CancellationTokenSource]::new(); lineTask=$null; prefix=''; closes=0 }
    function Ui { param($Name, $Arguments) }
    function Start-Tool {
        param($Name, $Arguments, [switch]$Recording)
        $capture.startedMs = $clock.Elapsed.TotalMilliseconds
        return $capture
    }
    function Close-Tool {
        param($Tool)
        $Tool.closes++
        if ($CleanupFails) { throw 'fixture recorder cleanup failure' }
    }
    $failure = $null
    try { Capture-Interaction 'Light' 0 }
    catch { $failure = $_ }
    finally { $capture.stderrReader.Dispose(); $capture.cancellation.Dispose() }
    Assert ($null -ne $failure -and $failure.Exception.Message -ceq 'Запись завершилась до первого кадра.') 'Cleanup заменил первичную ошибку записи.'
    Assert ($capture.closes -eq 1) 'Отказ записи не вызвал cleanup.'
    Assert ($failure.Exception.Data.Contains('winappCleanupError') -eq $CleanupFails) 'Вторичная ошибка записи потеряна или придумана.'
    Write-Output "Tool case: capture-primary cleanupFails=$CleanupFails primaryPreserved=True"
}

try {
    Invoke-ToolCase 'healthy' '[Console]::WriteLine(''{"ok":true,"value":"preserved"}''); [Console]::Error.WriteLine(''diagnostic stderr'')' $false
    Invoke-ToolCase 'healthy-deferred' '[Console]::WriteLine(''{"ok":true,"value":"preserved"}''); [Console]::Error.WriteLine(''diagnostic stderr'')' $false -DeferredCancellation
    $signals = New-ToolEvents
    Invoke-ToolCase 'primary-error-deferred' ((New-HeldPipeCode $signals 'stderr') + "`nexit 7") $true 'кодом 7' $signals -CommandTimeout 150 -ExpectCleanupError -DeferredCancellation
    foreach ($channel in @('both', 'stdout', 'stderr')) {
        $signals = New-ToolEvents
        Invoke-ToolCase "inherited-$channel" (New-HeldPipeCode $signals $channel) $true 'Таймаут|timeout|срок ожидания|заверш' $signals $true 150
    }
    Invoke-ToolCase 'nonzero' '[Console]::WriteLine(''{"ok":false}''); [Console]::Error.WriteLine(''diagnostic stderr''); exit 7' $true 'кодом 7'
    Invoke-ToolCase 'invalid-json' '[Console]::WriteLine(''invalid json'')' $true 'JSON|json'
    Invoke-ToolCase 'recording-healthy' '[Console]::WriteLine(''{"ok":true,"value":"preserved"}''); [Console]::Error.WriteLine(''diagnostic stderr'')' $false -Recording line
    $signals = New-ToolEvents
    Invoke-ToolCase 'recording-pending' (New-HeldPipeCode $signals 'stderr') $true 'срок ожидания' $signals -Recording pending
    $signals = New-ToolEvents
    Invoke-ToolCase 'primary-error' ((New-HeldPipeCode $signals 'stderr') + "`nexit 7") $true 'кодом 7' $signals -ExpectCleanupError

    $signals = New-ToolEvents
    $code = @'
$ready=[Threading.EventWaitHandle]::OpenExisting('__READY__')
try { [Console]::WriteLine('{"ok":true}'); $null=$ready.Set(); Start-Sleep -Seconds 12 }
finally { $ready.Dispose() }
'@.Replace('__READY__', $signals.readyName)
    Invoke-ToolCase 'process-timeout' $code $true 'Таймаут|timeout' $signals $false 150
    Assert-SharedCleanupBudget
    Assert-AppCleanup $true
    Assert-AppCleanup $false
    Assert-CaptureFailure $false
    Assert-CaptureFailure $true
    Write-Output 'PASS: реальные процессы/pipe, общий бюджет очистки и сохранение ошибок; GUI и настройки ОС не изменялись.'
} finally {
    foreach ($signal in $events) {
        $null = $signal.release.Set()
        $signal.ready.Dispose(); $signal.release.Dispose(); $signal.done.Dispose()
    }
    $cleanupPath = [IO.Path]::GetFullPath($fixtureRoot)
    $prefix = Join-Path ([IO.Path]::GetTempPath()) 'labui-tool-fixture-'
    if (!$cleanupPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected fixture cleanup path.' }
    Remove-Item -LiteralPath $cleanupPath -Recurse -Force
}
