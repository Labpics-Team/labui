param(
    [string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'),
    [string]$Protocol = (Join-Path $PSScriptRoot '../../../examples/windows/SpaceProtocol.cs'),
    [string]$PipeFixture = '',
    [string]$DotnetRoot = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Value, [string]$Message) { if (!$Value) { throw $Message } }
Add-Type -Path $Protocol
Add-Type -TypeDefinition @'
#nullable enable
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
public sealed class SpaceCleanupReader : TextReader {
    public bool Disposed, ThrowOnDispose;
    public string? Text;
    public Exception? Failure;
    private readonly TaskCompletionSource<int> pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private CancellationTokenRegistration registration;
    public override Task<int> ReadAsync(char[] buffer, int index, int count) => Read(buffer.AsMemory(index, count), default).AsTask();
    public override ValueTask<int> ReadAsync(Memory<char> buffer, CancellationToken cancellationToken = default) => Read(buffer, cancellationToken);
    private ValueTask<int> Read(Memory<char> buffer, CancellationToken token) {
        if (Failure != null) return ValueTask.FromException<int>(Failure);
        if (Text != null) {
            int count = Math.Min(Text.Length, buffer.Length);
            Text.AsSpan(0, count).CopyTo(buffer.Span); Text = Text.Substring(count);
            return ValueTask.FromResult(count);
        }
        registration = token.Register(() => pending.TrySetCanceled(token));
        return new ValueTask<int>(pending.Task);
    }
    protected override void Dispose(bool disposing) {
        Disposed = true; pending.TrySetCanceled(); registration.Dispose();
        if (ThrowOnDispose) throw new IOException("stdout-dispose-failure");
    }
}
public sealed class SpaceCleanupProcess : IDisposable {
    public readonly SpaceCleanupReader StandardOutput = new();
    public readonly SpaceCleanupReader StandardError = new();
    public readonly StringWriter StandardInput = new();
    public bool Disposed, Exited = true, RefreshFailure;
    public CancellationTokenSource? Cancellation;
    public bool HasExited => Exited;
    public int ExitCode => 0;
    public void Refresh() { if (RefreshFailure) throw new IOException("process-refresh-failure"); }
    public bool CloseMainWindow() => true;
    public bool WaitForExit(int timeout) {
        if (Cancellation == null || !Cancellation.IsCancellationRequested) throw new IOException("cancel-must-precede-process-wait");
        Exited = true; return true;
    }
    // Process.Dispose не закрывает readers, уже полученные через свойства.
    public void Dispose() { Disposed = true; }
}
'@
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($Harness, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
$outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })
Assert ($outer.Count -eq 1 -and $null -ne $outer[0].Finally) 'Нет однозначного внешнего finally.'
$finalizer = [scriptblock]::Create(($outer[0].Finally.Statements.Extent.Text -join "`n"))
# Исполняются настоящие присваивания канала, после запуска процесса и до ожидания окна.
$setup = [Collections.Generic.List[string]]::new()
$collect = $false
foreach ($statement in $outer[0].Body.Statements) {
    if ($statement -is [Management.Automation.Language.AssignmentStatementAst]) {
        if ($statement.Left.Extent.Text -ceq '$spaceChannel') { $collect = $true }
        if ($collect -and $statement.Left.Extent.Text -ceq '$started') { break }
    }
    if ($collect) { $setup.Add($statement.Extent.Text) }
}
Assert ($setup.Count -gt 0) 'Нет настоящей инициализации канала.'
$initialize = [scriptblock]::Create(($setup -join "`n"))
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('labui-space-cleanup-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $fixtureRoot
try {
    foreach ($case in @('pending', 'eof', 'process-exit', 'process-failure', 'dispose-failure', 'read-failure', 'extra-reply')) {
        & {
            param($case)
            $process = [SpaceCleanupProcess]::new()
            if ($case -eq 'eof') { $process.StandardOutput.Text = ''; $process.StandardError.Text = 'healthy-stderr' }
            if ($case -eq 'dispose-failure') { $process.StandardOutput.ThrowOnDispose = $true }
            if ($case -eq 'read-failure') { $process.StandardError.Failure = [IO.IOException]::new('stderr-read-failure') }
            if ($case -eq 'process-failure') { $process.RefreshFailure = $true }
            if ($case -eq 'process-exit') { $process.Exited = $false }
            if ($case -eq 'extra-reply') { $process.StandardOutput.Text = "unexpected`n" }
            $spaceChannel = $null
            . $initialize
            if ($spaceChannel.ContainsKey('cancellation')) { $process.Cancellation = $spaceChannel.cancellation }
            $output = Join-Path $fixtureRoot $case
            $null = New-Item -ItemType Directory -Path $output
            $close = @{}; $saved = @{}; $commands = @(); $animationBefore = $null
            $smokeFailure = if ($case -in @('dispose-failure', 'read-failure', 'process-failure')) {
                [Management.Automation.ErrorRecord]::new([TimeoutException]::new('primary-space-timeout'),
                    'space-timeout', [Management.Automation.ErrorCategory]::OperationTimeout, $null)
            } else { $null }
            $failure = $null; $elapsed = [Diagnostics.Stopwatch]::StartNew()
            try {
                try { & $finalizer } catch { $failure = $_ }
                $elapsed.Stop()
                Assert ($spaceChannel.read.IsCompleted -and $spaceChannel.errorRead.IsCompleted) 'Cleanup оставил незавершённые Space read-задачи.'
                Assert ($process.StandardOutput.Disposed -and $process.StandardError.Disposed -and $process.Disposed) 'Cleanup не освободил все принадлежащие каналу ресурсы.'
                $disposed = $false
                try { $spaceChannel.cancellation.Cancel() } catch { $disposed = $_.Exception.InnerException -is [ObjectDisposedException] }
                Assert $disposed 'CancellationTokenSource не освобождён.'
                Assert ($elapsed.ElapsedMilliseconds -lt 6500) 'Отменяемые чтения не завершились в общем бюджете.'
                if ($smokeFailure) {
                    Assert ($null -eq $failure -and $smokeFailure.Exception.Message -ceq 'primary-space-timeout') 'Cleanup заменил исходную ошибку.'
                    Assert ($smokeFailure.Exception.Data.Contains('applicationCleanupError')) 'Вторичная ошибка cleanup потеряна.'
                    $expected = switch ($case) {
                        'dispose-failure' { 'stdout-dispose-failure' }
                        'read-failure' { 'stderr-read-failure' }
                        'process-failure' { 'process-refresh-failure' }
                    }
                    Assert ($close.applicationCleanupError.Contains($expected)) 'Сохранена другая причина cleanup.'
                } elseif ($case -eq 'extra-reply') {
                    Assert ($null -ne $failure -and $failure.Exception.Message.Contains('лишний ответ')) 'Лишний ответ Space скрыт отменой.'
                } else {
                    Assert ($null -eq $failure -and $close.spaceChannel -ceq 'closed') 'Штатная отмена или EOF ошибочно отвергнуты.'
                    if ($case -eq 'eof') { Assert ($close.stderr -ceq 'healthy-stderr') 'Завершённый stderr потерян.' }
                }
                "Space cleanup: $case PASS elapsedMs=$($elapsed.ElapsedMilliseconds)"
            } finally {
                foreach ($reader in @($process.StandardOutput, $process.StandardError)) {
                    $reader.ThrowOnDispose = $false; $reader.Dispose()
                }
                foreach ($task in @($spaceChannel.read, $spaceChannel.errorRead)) { try { $null = $task.Wait(2000) } catch { } }
                if ($spaceChannel.ContainsKey('cancellation')) { $spaceChannel.cancellation.Dispose() }
                $process.StandardInput.Dispose(); $process.Dispose()
            }
        } $case
    }
    if ($PipeFixture) {
        foreach ($case in @('inherited', 'eof')) {
            & {
                param($case)
                $eventName = 'labui-space-pipe-' + [guid]::NewGuid().ToString('N')
                $ready = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, "$eventName-ready")
                $release = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, "$eventName-release")
                $info = [Diagnostics.ProcessStartInfo]::new($PipeFixture)
                $info.UseShellExecute = $false; $info.CreateNoWindow = $true
                $info.RedirectStandardInput = $true; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
                $info.Environment['DOTNET_ROOT'] = $DotnetRoot
                foreach ($argument in @("cleanup-$case", "$eventName-ready", "$eventName-release")) { $info.ArgumentList.Add($argument) }
                $process = [Diagnostics.Process]::Start($info)
                $processHandle = $process.SafeHandle
                $holder = $null; $spaceChannel = $null
                try {
                    if ($case -eq 'inherited') {
                        $identity = $process.StandardOutput.ReadLineAsync()
                        Assert ($identity.Wait(10000)) 'Нет PID процесса, удерживающего writers.'
                        $holder = [Diagnostics.Process]::GetProcessById([int]$identity.GetAwaiter().GetResult())
                    }
                    Assert ($process.WaitForExit(10000) -and $process.ExitCode -eq 0) 'Прямой BCL fixture не завершился.'
                    . $initialize
                    $stdoutHandle = $spaceChannel.stdoutReader.BaseStream.SafeFileHandle
                    $stderrHandle = $spaceChannel.stderrReader.BaseStream.SafeFileHandle
                    if ($case -eq 'inherited') {
                        Assert (!$holder.HasExited -and !$spaceChannel.read.IsCompleted -and !$spaceChannel.errorRead.IsCompleted) 'Fixture не удерживает оба настоящих чтения после выхода прямого процесса.'
                    } else {
                        Assert ([Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($spaceChannel.read, $spaceChannel.errorRead), 5000)) 'Здоровый EOF не завершил чтения.'
                    }
                    $output = Join-Path $fixtureRoot "real-$case"
                    $null = New-Item -ItemType Directory -Path $output
                    $close = @{}; $saved = @{}; $commands = @(); $animationBefore = $null; $smokeFailure = $null
                    $elapsed = [Diagnostics.Stopwatch]::StartNew()
                    & $finalizer
                    $elapsed.Stop()
                    Assert ($spaceChannel.read.IsCompleted -and $spaceChannel.errorRead.IsCompleted) 'Реальные pipe read-задачи остались незавершёнными.'
                    Assert ($stdoutHandle.IsClosed -and $stderrHandle.IsClosed -and $processHandle.IsClosed) 'Реальные reader/process handles не освобождены.'
                    Assert ($elapsed.ElapsedMilliseconds -lt 6500 -and $close.spaceChannel -ceq 'closed') 'Реальная очистка не закончилась в общем бюджете.'
                    if ($case -eq 'inherited') {
                        Assert (!$holder.HasExited -and $spaceChannel.read.IsCanceled -and $spaceChannel.errorRead.IsCanceled) 'Отмена подменена закрытием writers или естественным EOF.'
                    } else { Assert ($close.stderr -ceq 'healthy-stderr') 'Здоровый реальный stderr потерян.' }
                    $disposed = $false
                    try { $spaceChannel.cancellation.Cancel() } catch { $disposed = $_.Exception.InnerException -is [ObjectDisposedException] }
                    Assert $disposed 'Реальный канал не освободил CancellationTokenSource.'
                    "Space cleanup: real-$case PASS elapsedMs=$($elapsed.ElapsedMilliseconds) stdout=$($spaceChannel.read.Status) stderr=$($spaceChannel.errorRead.Status) handlesClosed=True"
                } finally {
                    $null = $release.Set()
                    if ($holder) {
                        if (!$holder.WaitForExit(5000)) { $holder.Kill(); $null = $holder.WaitForExit(5000) }
                        $holder.Dispose()
                    }
                    if (!$processHandle.IsClosed) {
                        if (!$process.HasExited) { $process.Kill($true); $null = $process.WaitForExit(5000) }
                        $process.StandardOutput.Dispose(); $process.StandardError.Dispose(); $process.Dispose()
                    }
                    if ($spaceChannel) { $spaceChannel.cancellation.Dispose() }
                    $ready.Dispose(); $release.Dispose()
                }
            } $case
        }
    }
} finally {
    $target = [IO.Path]::GetFullPath($fixtureRoot)
    Assert ($target.StartsWith((Join-Path ([IO.Path]::GetTempPath()) 'labui-space-cleanup-'), [StringComparison]::OrdinalIgnoreCase)) 'Неожиданный каталог cleanup.'
    Remove-Item -LiteralPath $target -Recurse -Force
}
