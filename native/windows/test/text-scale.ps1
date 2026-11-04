param(
    [Parameter(Mandatory)][string]$OutputPath,
    [switch]$Qualify,
    [string]$ApplicationDirectory,
    [string]$EvidenceDirectory,
    [string]$AnimationSettingsPath,
    [string]$SourceCommit,
    [string]$WinAppDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or
    $env:RUNNER_OS -ne 'Windows') {
    throw 'Settings разрешены этой проверке только на одноразовом GitHub-hosted Windows runner.'
}

function Invoke-TextScaleChild([string]$Executable, [string[]]$Arguments, [int]$TimeoutMs = 15000, $Diagnostic = $null) {
    if ($TimeoutMs -le 0) { throw 'Срок наблюдения истёк до запуска дочернего процесса.' }
    $info = [Diagnostics.ProcessStartInfo]::new($Executable)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $info.Environment['WINAPP_CLI_TELEMETRY_OPTOUT'] = '1'
    $info.Environment['WINAPP_CLI_UPDATE_CHECK'] = '0'
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $budget = [Diagnostics.Stopwatch]::StartNew()
    $cancellation = [Threading.CancellationTokenSource]::new()
    $child = $null
    $stdoutReader = $null
    $stderrReader = $null
    $stdout = $null
    $stderr = $null
    $failure = $null
    $cleanupErrors = [Collections.Generic.List[Exception]]::new()
    if ($null -ne $Diagnostic) { $Diagnostic.childStarted=$false; $Diagnostic.childExited=$false }
    try {
        $child = [Diagnostics.Process]::Start($info)
        if ($null -ne $Diagnostic) { $Diagnostic.childStarted=$true }
        $cancellation.CancelAfter([int][Math]::Max(0, $TimeoutMs - $budget.ElapsedMilliseconds))
        $stdoutReader = $child.StandardOutput
        $stderrReader = $child.StandardError
        $stdout = $stdoutReader.ReadToEndAsync($cancellation.Token)
        $stderr = $stderrReader.ReadToEndAsync($cancellation.Token)
        $remaining = [int][Math]::Max(0, $TimeoutMs - $budget.ElapsedMilliseconds)
        if ($null -ne $Diagnostic) { $Diagnostic.childWaitRemainingMs=$remaining }
        if (!$child.WaitForExit($remaining)) { throw 'Дочерний процесс превысил срок наблюдения.' }
        $remaining = [int][Math]::Max(0, $TimeoutMs - $budget.ElapsedMilliseconds)
        if (![Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($stdout, $stderr), $remaining)) {
            throw 'Вывод дочернего процесса превысил общий срок наблюдения.'
        }
        $text = $stdout.GetAwaiter().GetResult()
        $errorText = $stderr.GetAwaiter().GetResult()
        if ($text.Length -gt 262144 -or $errorText.Length -gt 16384) { throw 'Ответ превысил лимит наблюдения.' }
        if ($child.ExitCode -ne 0) {
            $code = 'child_failed'
            try {
                $envelope = $errorText | ConvertFrom-Json
                if ($envelope.error.code -match '^[a-z_]{1,64}$') { $code = $envelope.error.code }
            } catch { }
            throw "Дочерний процесс: $code, exit=$($child.ExitCode)."
        }
        if ($errorText.Trim()) { throw 'Успешный дочерний процесс записал неожиданный stderr.' }
    } catch {
        $failure = $_
    } finally {
        # Каждый ресурс освобождается независимо; cleanup не заменяет первичный отказ.
        try { $cancellation.Cancel() } catch { $cleanupErrors.Add($_.Exception) }
        if ($child) {
            try { if (!$child.HasExited) { $child.Kill() } }
            catch { $cleanupErrors.Add($_.Exception) }
            try {
                if (!$child.WaitForExit(5000)) { throw 'Собственный дочерний процесс не завершился.' }
                if ($null -ne $Diagnostic) { $Diagnostic.childExited=$true }
            } catch { $cleanupErrors.Add($_.Exception) }
        }
        try {
            $reads = @(@($stdout, $stderr) | Where-Object { $null -ne $_ })
            if ($reads.Count) {
                try { $null = [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]$reads, 5000) }
                catch {
                    # Отмена чтений ожидаема; faulted task остаётся отдельной ошибкой.
                    if (@($reads | Where-Object { $_.IsFaulted }).Count -or
                        !@($reads | Where-Object { $_.IsCanceled }).Count) {
                        $cleanupErrors.Add($_.Exception)
                    }
                }
                if (@($reads | Where-Object { !$_.IsCompleted }).Count) {
                    throw 'Отменённые чтения дочернего процесса не завершились.'
                }
            }
        } catch { $cleanupErrors.Add($_.Exception) }
        foreach ($resource in @($stdoutReader, $stderrReader, $child, $cancellation)) {
            if ($null -ne $resource) {
                try { $resource.Dispose() } catch { $cleanupErrors.Add($_.Exception) }
            }
        }
    }
    if ($cleanupErrors.Count) {
        $causes = [Collections.Generic.List[Exception]]::new()
        if ($failure) { $causes.Add($failure.Exception) }
        $causes.AddRange($cleanupErrors)
        throw [AggregateException]::new('Дочерний процесс завершился с ошибками очистки.', $causes.ToArray())
    }
    if ($failure) { throw $failure }
    return $text
}

function Get-SettingsSnapshot {
    $items = [Collections.Generic.List[object]]::new()
    foreach ($process in [Diagnostics.Process]::GetProcessesByName('SystemSettings')) {
        try {
            if ($process.SessionId -eq [Diagnostics.Process]::GetCurrentProcess().SessionId) {
                $items.Add(@{ pid = $process.Id; startTicks = $process.StartTime.ToUniversalTime().Ticks;
                    path = $process.Path; sessionId = $process.SessionId })
            }
        } finally { $process.Dispose() }
    }
    return $items.ToArray()
}

function Get-OwnedSettings($Owned) {
    $process = Get-Process -Id $Owned.pid -ErrorAction Stop
    try {
        # Native handle удерживает поколение PID до Dispose владельцем операции.
        $processHandle = $process.Handle
        if ($processHandle -isnot [IntPtr] -or $processHandle -eq [IntPtr]::Zero) {
            throw 'Не получен native handle процесса Settings; чтение и закрытие запрещены.'
        }
        if ($process.HasExited -or $process.StartTime.ToUniversalTime().Ticks -ne $Owned.startTicks -or
            $process.Path -ine $Owned.path -or $process.SessionId -ne $Owned.sessionId) {
            throw 'Изменилось поколение процесса Settings; чтение и закрытие запрещены.'
        }
        return $process
    } catch {
        $process.Dispose()
        throw
    }
}

function Read-SettingsWindowOwner([long]$Handle, $Diagnostic = $null) {
    if ($Handle -le 0) { throw 'Для наблюдения нужен положительный HWND.' }
    $nativeClock=[Diagnostics.Stopwatch]::StartNew()
    if ($null -ne $Diagnostic) { $Diagnostic.nativeTypeWasLoaded=$null -ne ('LabUISettingsWindowReadback' -as [type]) }
    if ($null -eq ('LabUISettingsWindowReadback' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LabUISettingsWindowReadback
{
    [DllImport("user32.dll", ExactSpelling = true, SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll", ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PostMessageW(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}
'@
    }
    if ($null -ne $Diagnostic) { $Diagnostic.nativeTypeReadyMs=$nativeClock.ElapsedMilliseconds }
    [uint32]$ownerPid = 0
    $threadId = [LabUISettingsWindowReadback]::GetWindowThreadProcessId([IntPtr]$Handle, [ref]$ownerPid)
    $lastError = if ($threadId -eq 0) { [Runtime.InteropServices.Marshal]::GetLastWin32Error() } else { 0 }
    if ($null -ne $Diagnostic) { $Diagnostic.nativeOwnerReadMs=$nativeClock.ElapsedMilliseconds }
    return @{ nativePid = $ownerPid; nativeThreadId = $threadId; nativeAlive = $threadId -ne 0; nativeError = $lastError }
}

function Assert-SettingsWindowIdentity($Owned, $Window) {
    if (!$Window.nativeAlive -or $Window.nativePid -ne $Owned.pid -or $Window.nativeThreadId -le 0 -or
        ($Owned.ContainsKey('threadId') -and $Window.nativeThreadId -ne $Owned.threadId)) {
        throw 'Выбранный HWND больше не принадлежит прежнему Settings PID/thread.'
    }
    $Owned.threadId = $Window.nativeThreadId
}

function Test-SettingsWindowEnabled([long]$Handle) {
    return [LabUISettingsWindowReadback]::IsWindowEnabled([IntPtr]$Handle)
}

function Send-SettingsWindowClose([long]$Handle) {
    $sent = [LabUISettingsWindowReadback]::PostMessageW([IntPtr]$Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    $lastError = if (!$sent) { [Runtime.InteropServices.Marshal]::GetLastWin32Error() } else { 0 }
    return @{ sent = $sent; nativeError = $lastError }
}

function Read-SettingsWindowDiagnostic($Owned, $Diagnostic = $null) {
    $state = Read-SettingsWindowOwner $Owned.hwnd $Diagnostic
    $state.observedAtUtc = [DateTime]::UtcNow.ToString('o')
    $state.mainWindowHandle = $null
    $state.processError = $null
    $process = $null
    try {
        $process = Get-OwnedSettings $Owned
        $process.Refresh()
        $state.mainWindowHandle = $process.MainWindowHandle.ToInt64()
    } catch {
        # Наблюдение сохраняет отказ; существующий admission повторно проверит процесс.
        $state.processError = $_.Exception.Message
    } finally { if ($process) { $process.Dispose() } }
    return $state
}

function Read-SystemTextScale([int]$TimeoutMs = 15000) {
    $reader = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$null = [Windows.UI.ViewManagement.UISettings, Windows.UI.ViewManagement, ContentType=WindowsRuntime]
$settings = [Windows.UI.ViewManagement.UISettings]::new()
$process = [Diagnostics.Process]::GetCurrentProcess()
try {
    $value = $settings.TextScaleFactor
    @{ schemaVersion = 1; api = 'Windows.UI.ViewManagement.UISettings.TextScaleFactor';
        pid = $process.Id; startTicks = $process.StartTime.ToUniversalTime().Ticks; sessionId = $process.SessionId;
        observedAtUnixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); textScaleFactor = $value } |
        ConvertTo-Json -Compress
} finally { $process.Dispose() }
'@
    $started = [DateTimeOffset]::UtcNow
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($reader))
    $frameworkShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $observation = Invoke-TextScaleChild $frameworkShell @('-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', $encoded) $TimeoutMs | ConvertFrom-Json
    $current = [Diagnostics.Process]::GetCurrentProcess()
    try {
        foreach ($field in @('schemaVersion', 'pid', 'startTicks', 'sessionId', 'observedAtUnixMs')) {
            if ($observation.$field -isnot [int] -and $observation.$field -isnot [long]) {
                throw 'Повреждено целое поле OS text-scale observation.'
            }
        }
        if ($observation.schemaVersion -ne 1 -or $observation.pid -le 0 -or
            $observation.api -cne 'Windows.UI.ViewManagement.UISettings.TextScaleFactor' -or
            $observation.sessionId -ne $current.SessionId -or $observation.startTicks -lt $started.UtcTicks -or
            $observation.startTicks -gt [DateTime]::UtcNow.Ticks -or
            $observation.observedAtUnixMs -lt $started.ToUnixTimeMilliseconds() -or
            $observation.observedAtUnixMs -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) {
            throw 'OS text-scale observation не соответствует текущему вызову/session.'
        }
    } finally { $current.Dispose() }
    $value = $observation.textScaleFactor
    if (($value -isnot [int] -and $value -isnot [long] -and $value -isnot [double]) -or
        ![double]::IsFinite($value) -or $value -lt 1 -or $value -gt 2.25) {
        throw 'UISettings.TextScaleFactor не вернул конечное число в диапазоне 1..2.25.'
    }
    return $observation
}

function Assert-SettingsWindow($Owned) {
    $process = Get-OwnedSettings $Owned
    try {
        Assert-SettingsWindowIdentity $Owned (Read-SettingsWindowOwner $Owned.hwnd)
    } finally { $process.Dispose() }
}

function Close-SettingsWindow($Owned) {
    if ($null -eq $Owned -or !$Owned.hwnd) { return 'no-owned-window' }
    $process = Get-OwnedSettings $Owned
    try {
        $initialWindow=Read-SettingsWindowOwner $Owned.hwnd
        if (!$initialWindow.nativeAlive -and $initialWindow.nativeError -eq 1400) { return 'closed' }
        Assert-SettingsWindowIdentity $Owned $initialWindow
        if (!(Test-SettingsWindowEnabled $Owned.hwnd)) { throw 'Disabled окно Settings не закрывается.' }
        # Проверка и PostMessage не атомарны; другой HWND не выбирается даже при отказе.
        Assert-SettingsWindowIdentity $Owned (Read-SettingsWindowOwner $Owned.hwnd)
        $posted = Send-SettingsWindowClose $Owned.hwnd
        if (!$posted.sent) { throw "Settings close message отклонён: Win32=$($posted.nativeError)." }
        $budget = [Diagnostics.Stopwatch]::StartNew()
        do {
            if ($process.HasExited) { return 'closed' }
            $window = Read-SettingsWindowOwner $Owned.hwnd
            if (!$window.nativeAlive -and $window.nativeError -eq 1400) { return 'closed' }
            Assert-SettingsWindowIdentity $Owned $window
            $remaining = [int][Math]::Max(0, 5000 - $budget.ElapsedMilliseconds)
            if ($process.WaitForExit([Math]::Min(100, $remaining))) { return 'closed' }
        } while ($budget.ElapsedMilliseconds -lt 5000)
        throw 'Окно Settings не закрылось в срок.'
    } finally { $process.Dispose() }
}

function Read-SettingsContent($Owned, [int]$TimeoutMs,
    [ValidateSet('Observe','Apply','Restore')][string]$Operation = 'Observe', $Expected = $null, [double]$TargetValue = 0,
    $Diagnostic = $null, $DiscoveryBudget = $null) {
    if ($null -ne $Diagnostic -and $Operation -ne 'Observe') { throw 'Reader diagnostic разрешён только для Observe.' }
    $childClock=[Diagnostics.Stopwatch]::StartNew()
    # CLI 0.7.1 группирует child под GA_ROOT и допускает fallback. Весь допуск
    # страницы читается одним root; cleanup по-прежнему принадлежит исходному HWND.
    $reader = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$operationClock = [Diagnostics.Stopwatch]::StartNew()
function Write-SettingsReaderPhase([string]$Phase) {
    if ((Test-Path variable:phasePath) -and ![string]::IsNullOrEmpty($phasePath)) {
        # Только фиксированная фаза и монотонное время; UI-данные сюда не попадают.
        try {
            $phaseJson=@{ phase=$Phase; elapsedMs=$operationClock.ElapsedMilliseconds } | ConvertTo-Json -Compress
            [IO.File]::WriteAllText($phasePath,$phaseJson,[Text.UTF8Encoding]::new($false))
        } catch { }
    }
}
Write-SettingsReaderPhase 'load-uia'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$nativeSource = @"
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public sealed class LabUIContentWindow {
    public long hwnd, ownerHwnd, parentHwnd, rootHwnd;
    public uint nativePid, nativeThreadId;
    public string className;
    public bool visible;
    public long width, height;
}
public sealed class LabUIContentDescendants {
    public int visited, matching;
    public bool truncated;
    public long[] handles;
}
public static class LabUISettingsContentNative {
    private delegate bool EnumWindow(IntPtr hwnd, IntPtr state);
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll", ExactSpelling=true, SetLastError=true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", ExactSpelling=true)] private static extern IntPtr GetWindow(IntPtr hwnd, uint command);
    [DllImport("user32.dll", ExactSpelling=true)] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flag);
    [DllImport("user32.dll", ExactSpelling=true)] [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsChild(IntPtr parent, IntPtr window);
    [DllImport("user32.dll", ExactSpelling=true, CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern int GetClassNameW(IntPtr hwnd, StringBuilder text, int size);
    [DllImport("user32.dll", ExactSpelling=true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll", ExactSpelling=true, SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll", ExactSpelling=true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumChildWindows(IntPtr parent, EnumWindow callback, IntPtr state);
    public static LabUIContentWindow Read(long handle) {
        if (handle <= 0) throw new ArgumentException("Positive HWND required.");
        IntPtr hwnd = new IntPtr(handle);
        uint pid; uint thread = GetWindowThreadProcessId(hwnd, out pid);
        if (thread == 0 || pid == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
        StringBuilder text = new StringBuilder(256);
        if (GetClassNameW(hwnd, text, text.Capacity) == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
        Rect rect;
        if (!GetWindowRect(hwnd, out rect)) throw new Win32Exception(Marshal.GetLastWin32Error());
        LabUIContentWindow result = new LabUIContentWindow();
        result.hwnd = handle; result.nativePid = pid; result.nativeThreadId = thread;
        result.ownerHwnd = GetWindow(hwnd, 4).ToInt64();
        result.parentHwnd = GetAncestor(hwnd, 1).ToInt64(); result.rootHwnd = GetAncestor(hwnd, 2).ToInt64();
        result.className = text.ToString(); result.visible = IsWindowVisible(hwnd);
        result.width = (long)rect.Right - rect.Left; result.height = (long)rect.Bottom - rect.Top;
        uint finalPid; uint finalThread = GetWindowThreadProcessId(hwnd, out finalPid);
        if (finalPid != pid || finalThread != thread) throw new InvalidOperationException("Window identity changed during metadata read.");
        return result;
    }
    public static LabUIContentDescendants Descendants(long owner, uint settingsPid) {
        if (owner <= 0 || settingsPid == 0) throw new ArgumentException("Scoped owner and PID required.");
        LabUIContentDescendants result = new LabUIContentDescendants();
        List<long> handles = new List<long>();
        EnumWindow callback = delegate(IntPtr hwnd, IntPtr state) {
            if (result.visited == 128) { result.truncated = true; return false; }
            result.visited++;
            uint pid; uint thread = GetWindowThreadProcessId(hwnd, out pid);
            if (thread != 0 && pid == settingsPid) {
                result.matching++;
                if (handles.Count < 8) handles.Add(hwnd.ToInt64());
            }
            return true;
        };
        EnumChildWindows(new IntPtr(owner), callback, IntPtr.Zero);
        GC.KeepAlive(callback);
        result.handles = handles.ToArray();
        return result;
    }
}
"@
Write-SettingsReaderPhase 'compile-native'
Add-Type -TypeDefinition $nativeSource
function Assert-SettingsContentIdentity($Process, $Root) {
    if ($Process.HasExited -or $Process.StartTime.ToUniversalTime().Ticks -ne $startTicks -or
        $Process.Path -ine $settingsPath -or $Process.SessionId -ne $sessionId) {
        throw 'Settings process identity changed.'
    }
    if ($null -ne $Root -and ($Root.Current.ProcessId -ne $settingsPid -or
        $Root.Current.NativeWindowHandle -ne $handle)) { throw 'UIA root belongs to another PID/HWND.' }
}
function Assert-ContentWindow($Window, [long]$ExpectedHandle, [long]$ExpectedThread) {
    if ($Window.hwnd -ne $ExpectedHandle -or $Window.nativePid -ne $settingsPid -or
        $Window.nativeThreadId -le 0 -or ($ExpectedThread -gt 0 -and $Window.nativeThreadId -ne $ExpectedThread)) {
        throw 'Content HWND belongs to another Settings PID/thread.'
    }
}
function Test-ContentDescendant([long]$OwnerHandle, [long]$ContentHandle) {
    return [LabUISettingsContentNative]::IsChild([IntPtr]$OwnerHandle, [IntPtr]$ContentHandle)
}
function Assert-ContentAncestry($Window, $Owner) {
    if ($null -eq $Owner -or $Window.hwnd -eq $Owner.hwnd) { return }
    # IsChild учитывает вложенных потомков: parent/root кандидата не заменяют членство.
    if (!(Test-ContentDescendant $Owner.hwnd $Window.hwnd)) {
        throw 'Content HWND no longer belongs to the selected owner subtree.'
    }
}
function Select-ContentWindow($Original, $Owner, $Descendants, $Summary) {
    if ($Original.ownerHwnd -eq 0) { return $Original }
    if ($null -eq $Owner -or $Owner.hwnd -ne $Original.ownerHwnd) { throw 'Popup owner identity missing.' }
    if ($Owner.nativePid -eq $settingsPid) { return $Owner }
    if ($Summary.truncated -or $Summary.matching -ne 1) { return $null }
    if (@($Descendants).Count -ne 1) { throw 'Native descendant observation incomplete.' }
    Assert-ContentWindow $Descendants[0] $Descendants[0].hwnd 0
    Assert-ContentAncestry $Descendants[0] $Owner
    return $Descendants[0]
}
function Read-ContentTree($Process, $Root, $Walker) {
    Assert-SettingsContentIdentity $Process $Root
    $pending = [Collections.Generic.Stack[object]]::new()
    $pending.Push(@{ element=$Root; depth=0 })
    $seen = [Collections.Generic.HashSet[string]]::new()
    $elements = [Collections.Generic.List[object]]::new()
    $targets = [Collections.Generic.List[object]]::new()
    $types = @{}
    $count = 0; $maxDepth = 0; $depthLimited = $false; $nodeLimited = $false
    while ($pending.Count) {
        if ($count -eq 512) { $nodeLimited = $true; break }
        $item = $pending.Pop(); $element = $item.element; $depth = $item.depth
        $current = $element.Current
        if ($current.ProcessId -ne $settingsPid) { throw 'UIA descendant belongs to another PID.' }
        $runtimeId = @($element.GetRuntimeId())
        if (!$runtimeId.Count -or $runtimeId.Count -gt 32 -or @($runtimeId | Where-Object { $_ -isnot [int] }).Count) {
            throw 'UIA runtime identity malformed.'
        }
        if (!$seen.Add(($runtimeId -join ','))) { throw 'UIA traversal repeated a runtime identity.' }
        $count++; $maxDepth = [Math]::Max($maxDepth, $depth)
        $typeName = $current.ControlType.ProgrammaticName
        if ($typeName -isnot [string] -or $typeName -cnotmatch '^ControlType\.[A-Za-z]{1,32}$') { throw 'UIA control type malformed.' }
        $type = $typeName.Substring(12)
        if (!$types.ContainsKey($type)) { $types[$type] = 0 }; $types[$type]++
        $name = $current.Name
        if ($name -isnot [string]) { throw 'UIA name unavailable.' }
        $allowedName = $name -cmatch '^(Text size|Make text bigger|Apply)$'
        if ($type -eq 'Slider' -or $allowedName) {
            if ($elements.Count -eq 32) { throw 'Text size inventory exceeds 32 entries.' }
            $automationId = if ($allowedName) { $current.AutomationId } else { '' }
            if ($automationId -isnot [string] -or $automationId.Length -gt 256) { throw 'UIA AutomationId exceeds limit or is unavailable.' }
            if ($current.IsEnabled -isnot [bool] -or $current.IsOffscreen -isnot [bool]) { throw 'UIA visibility/enabled state unavailable.' }
            $entry = @{ name = if ($allowedName) { $name } else { '' }; type=$type; automationId=$automationId;
                runtimeId=$runtimeId; processId=$current.ProcessId; nativeWindowHandle=$current.NativeWindowHandle;
                isEnabled=$current.IsEnabled; isOffscreen=$current.IsOffscreen; rangeValue=$null; invokeSupported=$null }
            if ($type -eq 'Slider' -and $name -cmatch '^(Text size|Make text bigger)$') {
                $pattern = $null
                $supported = $element.TryGetCurrentPattern([Windows.Automation.RangeValuePattern]::Pattern, [ref]$pattern)
                $range = @{ supported=$supported; minimum=$null; maximum=$null; value=$null; isReadOnly=$null }
                if ($supported) {
                    if ($null -eq $pattern) { throw 'RangeValue pattern missing after successful lookup.' }
                    $value = $pattern.Current
                    $range.minimum=$value.Minimum; $range.maximum=$value.Maximum
                    $range.value=$value.Value; $range.isReadOnly=$value.IsReadOnly
                }
                $entry.rangeValue=$range
                $targets.Add(@{ element=$element; pattern=$pattern; observation=$entry })
            }
            if ($type -eq 'Button' -and $name -ceq 'Apply') {
                $pattern=$null
                $entry.invokeSupported=$element.TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)
                $targets.Add(@{ element=$element; pattern=$pattern; observation=$entry })
            }
            $elements.Add($entry)
        }
        # Следующий sibling добавляется лениво: предел ограничивает обход, а не только output.
        if ($depth -gt 0) {
            $sibling=$Walker.GetNextSibling($element)
            if ($null -ne $sibling) { $pending.Push(@{ element=$sibling; depth=$depth }) }
        }
        $child=$Walker.GetFirstChild($element)
        if ($null -ne $child) {
            if ($depth -eq 12) { $depthLimited=$true }
            else { $pending.Push(@{ element=$child; depth=$depth+1 }) }
        }
    }
    $Process.Refresh()
    Assert-SettingsContentIdentity $Process $Root
    return @{ elements=$elements.ToArray(); targets=$targets.ToArray(); tree=@{ nodeCount=$count; maxDepth=$maxDepth; typeCounts=$types;
        hasMoreChildren=$depthLimited -or $nodeLimited; depthLimited=$depthLimited; nodeLimited=$nodeLimited } }
}
function Assert-SettingsActionBoundary($Process, $Root, $Candidate, $Owner, $Original) {
    if ($operationClock.ElapsedMilliseconds -ge $operationTimeoutMs) { throw 'Settings action deadline expired.' }
    Assert-SettingsContentIdentity $Process $Root
    $liveCandidate=[LabUISettingsContentNative]::Read($Candidate.hwnd)
    Assert-ContentWindow $liveCandidate $Candidate.hwnd $Candidate.nativeThreadId
    if ($liveCandidate.parentHwnd -ne $Candidate.parentHwnd -or $liveCandidate.rootHwnd -ne $Candidate.rootHwnd) {
        throw 'Action content parent/root changed.'
    }
    Assert-ContentAncestry $liveCandidate $Owner
    if ($null -ne $Owner) {
        $liveOwner=[LabUISettingsContentNative]::Read($Owner.hwnd)
        if ($liveOwner.nativePid -ne $Owner.nativePid -or $liveOwner.nativeThreadId -ne $Owner.nativeThreadId) {
            throw 'Action host identity changed.'
        }
    }
}
function Assert-SettingsActionTarget($Target, [bool]$RequireEnabled) {
    $current=$Target.element.Current
    $observed=$Target.observation
    if ($current.ProcessId -ne $settingsPid -or $current.AutomationId -cne $observed.automationId -or
        $current.Name -cne $observed.name -or $current.ControlType.ProgrammaticName -cne "ControlType.$($observed.type)" -or
        $current.IsOffscreen -isnot [bool] -or $current.IsOffscreen -or $current.IsEnabled -isnot [bool] -or
        ($RequireEnabled -and !$current.IsEnabled) -or
        (@($Target.element.GetRuntimeId()) -join ',') -cne ($observed.runtimeId -join ',')) {
        throw 'Action control identity/state changed.'
    }
}
function Set-SettingsRangeAndApply($Process, $Root, $Candidate, $Owner, $Original, $Content, $Receipt) {
    $admission=@{status='unavailable';reason=$null;elements=$Content.elements;tree=$Content.tree}
    Set-TextScaleCapability $admission
    if ($admission.status -ne 'available') { throw "Action page unavailable: $($admission.reason)." }
    $sliders=@($Content.targets | Where-Object { $_.observation.type -eq 'Slider' })
    $buttons=@($Content.targets | Where-Object { $_.observation.type -eq 'Button' -and $_.observation.name -ceq 'Apply' })
    if ($sliders.Count -ne 1 -or $buttons.Count -ne 1) { throw 'Action references are not unique.' }
    $slider=$sliders[0]; $apply=$buttons[0]
    if ($slider.observation.automationId -cne $expected.sliderAutomationId -or
        $apply.observation.automationId -cne $expected.applyAutomationId) { throw 'Action controls differ from prepared page.' }
    Assert-SettingsActionBoundary $Process $Root $Candidate $Owner $Original
    Assert-SettingsActionTarget $slider $true
    Assert-SettingsActionTarget $apply $false
    $range=$slider.pattern.Current
    if ([double]::IsNaN($targetValue) -or [double]::IsInfinity($targetValue) -or $range.IsReadOnly -isnot [bool] -or
        $range.IsReadOnly -or $targetValue -lt $range.Minimum -or $targetValue -gt $range.Maximum) { throw 'Action target outside writable range.' }
    if ($operation -eq 'Apply' -and $range.Value -ne $expected.originalSliderValue) { throw 'Prepared slider value changed before apply.' }
    $Receipt.beforeValue=$range.Value
    if ($range.Value -ne $targetValue) {
        if ($operationClock.ElapsedMilliseconds -ge $operationTimeoutMs) { throw 'Settings action deadline expired before SetValue.' }
        $Receipt.stage='set-value'; $Receipt.setDispatched=$true
        $slider.pattern.SetValue($targetValue)
        $Receipt.afterValue=$slider.pattern.Current.Value
        if ($Receipt.afterValue -ne $targetValue) { throw 'RangeValue readback differs from requested value.' }
    } else { $Receipt.afterValue=$range.Value }
    $Receipt.stage='wait-apply'
    while ($true) {
        Assert-SettingsActionTarget $apply $false
        if ($apply.element.Current.IsEnabled) { break }
        if (!$Receipt.setDispatched) {
            $Receipt.stage='already-at-range'; $Receipt.noChange=$true
            return
        }
        $remaining=[int][Math]::Max(0,$operationTimeoutMs-$operationClock.ElapsedMilliseconds)
        if ($remaining -le 0) { throw 'Apply remained disabled until the operation deadline.' }
        Start-Sleep -Milliseconds ([Math]::Min(100,$remaining))
    }
    $Receipt.stage='invoke-apply'
    Assert-SettingsActionBoundary $Process $Root $Candidate $Owner $Original
    Assert-SettingsActionTarget $slider $true
    Assert-SettingsActionTarget $apply $true
    if ($slider.pattern.Current.Value -ne $targetValue) { throw 'Slider changed before Apply.' }
    if ($operationClock.ElapsedMilliseconds -ge $operationTimeoutMs) { throw 'Settings action deadline expired before Invoke.' }
    $Receipt.invokeDispatched=$true
    $apply.pattern.Invoke()
    $Receipt.stage='applied'
}
Write-SettingsReaderPhase 'pin-process'
$process = Get-Process -Id $settingsPid -ErrorAction Stop
try {
    $processHandle = $process.Handle
    if ($processHandle -isnot [IntPtr] -or $processHandle -eq [IntPtr]::Zero) {
        throw 'Settings native process handle unavailable.'
    }
    Assert-SettingsContentIdentity $process
    $original=$null; $owner=$null; $descendants=@(); $summary=@{ visited=0; matching=0; truncated=$false }
    if ($operation -eq 'Observe') {
      Write-SettingsReaderPhase 'discover-native'
      $original=[LabUISettingsContentNative]::Read($cleanupHandle)
      Assert-ContentWindow $original $cleanupHandle $cleanupThread
      if ($original.ownerHwnd -ne 0) {
        $owner=[LabUISettingsContentNative]::Read($original.ownerHwnd)
        if ($owner.nativePid -ne $settingsPid) {
            $native=[LabUISettingsContentNative]::Descendants($owner.hwnd, $settingsPid)
            $summary=@{ visited=$native.visited; matching=$native.matching; truncated=$native.truncated }
            $descendants=@(foreach ($windowHandle in $native.handles) {
                $window=[LabUISettingsContentNative]::Read($windowHandle)
                Assert-ContentWindow $window $windowHandle 0
                $window
            })
        }
      }
      $candidate=Select-ContentWindow $original $owner $descendants $summary
    } else {
        # После admission действие живёт на сохранённом content HWND, независимо от popup.
        $candidate=[LabUISettingsContentNative]::Read($expected.hwnd)
        Assert-ContentWindow $candidate $expected.hwnd $expected.threadId
        if ($expected.ownerHwnd -ne 0) {
            $owner=[LabUISettingsContentNative]::Read($expected.ownerHwnd)
            if ($owner.nativePid -ne $expected.ownerPid -or $owner.nativeThreadId -ne $expected.ownerThreadId) {
                throw 'Action cannot replace the confirmed content owner.'
            }
        }
        Assert-ContentAncestry $candidate $owner
    }
    $observation=@{ observedAtUtc=[DateTime]::UtcNow.ToString('o'); contentRoot=$null; elements=@(); tree=$null;
        action=$null;
        topology=@{ original=$original; owner=$owner; descendants=$descendants; enumeration=$summary };
        reason=if ($summary.truncated) { 'native-window-tree-truncated' } else { 'settings-content-window-not-unique' } }
    $root=$null
    if ($null -ne $candidate) {
        $handle=[long]$candidate.hwnd
        Assert-ContentWindow $candidate $handle 0
        Write-SettingsReaderPhase 'from-handle'
        $root = [Windows.Automation.AutomationElement]::FromHandle([IntPtr]$handle)
        if ($null -eq $root) { throw 'UIA root unavailable.' }
        Assert-SettingsContentIdentity $process $root
        Write-SettingsReaderPhase 'read-tree'
        $content=Read-ContentTree $process $root ([Windows.Automation.TreeWalker]::ControlViewWalker)
        $observation.contentRoot=@{ hwnd=$handle; pid=$settingsPid; threadId=$candidate.nativeThreadId;
            uiaProcessId=$root.Current.ProcessId; uiaNativeWindowHandle=$root.Current.NativeWindowHandle; runtimeId=@($root.GetRuntimeId()) }
        $observation.elements=$content.elements; $observation.tree=$content.tree; $observation.reason=$null
        if ($operation -ne 'Observe') {
            $observation.action=@{ operation=$operation; targetValue=$targetValue; beforeValue=$null; afterValue=$null;
                setDispatched=$false; invokeDispatched=$false; noChange=$false; stage='admission'; error=$null }
            try { Set-SettingsRangeAndApply $process $root $candidate $owner $original $content $observation.action }
            catch { $observation.action.error=@{ stage=$observation.action.stage; type=$_.Exception.GetType().FullName; message=$_.Exception.Message } }
        }
        Write-SettingsReaderPhase 'verify-native'
        $candidateAfter=[LabUISettingsContentNative]::Read($handle)
        Assert-ContentWindow $candidateAfter $handle $candidate.nativeThreadId
        Assert-ContentAncestry $candidateAfter $owner
        if ($candidateAfter.parentHwnd -ne $candidate.parentHwnd -or $candidateAfter.rootHwnd -ne $candidate.rootHwnd) {
            throw 'Content parent/root changed during observation.'
        }
    }
    if ($operation -eq 'Observe') {
        $originalAfter=[LabUISettingsContentNative]::Read($cleanupHandle)
        Assert-ContentWindow $originalAfter $cleanupHandle $cleanupThread
        if ($originalAfter.ownerHwnd -ne $original.ownerHwnd) { throw 'Popup owner changed during observation.' }
    }
    if ($null -ne $owner) {
        $ownerAfter=[LabUISettingsContentNative]::Read($owner.hwnd)
        if ($ownerAfter.nativePid -ne $owner.nativePid -or $ownerAfter.nativeThreadId -ne $owner.nativeThreadId) {
            throw 'Popup owner identity changed during observation.'
        }
    }
    $process.Refresh()
    Assert-SettingsContentIdentity $process $root
    Write-SettingsReaderPhase 'complete'
    $observation | ConvertTo-Json -Depth 8 -Compress
} finally { $process.Dispose() }
'@
    if ($Operation -eq 'Observe') { Assert-SettingsWindow $Owned }
    $path64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Owned.path))
    if ($Operation -ne 'Observe' -and $null -eq $Expected) { throw 'Mutation requires a prepared content identity.' }
    $expected64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($Expected | ConvertTo-Json -Depth 4 -Compress)))
    $prefix = "`$settingsPid = $([int]$Owned.pid); `$startTicks = $([long]$Owned.startTicks); `$handle = 0; " +
        "`$cleanupHandle = $([long]$Owned.hwnd); `$cleanupThread = $([long]$Owned.threadId); " +
        "`$sessionId = $([int]$Owned.sessionId); `$settingsPath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$path64')); " +
        "`$operation='$Operation'; `$targetValue=$($TargetValue.ToString('R',[Globalization.CultureInfo]::InvariantCulture)); `$operationTimeoutMs=$TimeoutMs; " +
        "`$expected=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$expected64')) | ConvertFrom-Json`n" +
        "function Set-TextScaleCapability {`n$((Get-Item Function:Set-TextScaleCapability).Definition)`n}`n"
    $frameworkShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    # ArgumentList сохраняет Unicode/quotes; UTF-16 base64 этого reader превысил бы лимит CreateProcess.
    $phasePath=$null; $phaseOwned=$false
    try {
        if ($null -ne $Diagnostic) {
            $Diagnostic.timeoutMs=$TimeoutMs; $Diagnostic.phase=$null; $Diagnostic.readerElapsedMs=$null
            $Diagnostic.childStarted=$false; $Diagnostic.childExited=$false
            $Diagnostic.phaseRead='unavailable'; $Diagnostic.cleanup='not-created'
            try {
                $phasePath=Join-Path $env:RUNNER_TEMP ('labui-settings-phase-'+[guid]::NewGuid().ToString('N')+'.json')
                $phaseFile=[IO.File]::Open($phasePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
                $phaseOwned=$true
                $phaseFile.Dispose()
                $phase64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($phasePath))
                $prefix="`$phasePath=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$phase64'))`n"+$prefix
            } catch { $Diagnostic.phaseRead='create-failed' }
        }
        if ($null -ne $Diagnostic) {
            if ($null -ne $DiscoveryBudget) { $Diagnostic.childStartRemainingMs=Get-TextScaleRemainingMs $DiscoveryBudget }
            $text = Invoke-TextScaleChild $frameworkShell @('-NoProfile', '-NonInteractive', '-STA', '-Command', ($prefix + $reader)) $TimeoutMs -Diagnostic $Diagnostic
        } else { $text = Invoke-TextScaleChild $frameworkShell @('-NoProfile', '-NonInteractive', '-STA', '-Command', ($prefix + $reader)) $TimeoutMs }
    } finally {
        if ($null -ne $Diagnostic) {
            $Diagnostic.elapsedMs=$childClock.ElapsedMilliseconds
            # Invoke-TextScaleChild уже завершил/остановил child; неполная запись остаётся неопределённостью.
            if ($phaseOwned -and (!$Diagnostic.childStarted -or $Diagnostic.childExited)) {
                try {
                    $phaseInfo=[IO.FileInfo]::new($phasePath)
                    if (!$phaseInfo.Exists -or $phaseInfo.Length -le 0 -or $phaseInfo.Length -gt 512) { throw 'Reader phase missing/oversized.' }
                    $phase=Get-Content -LiteralPath $phasePath -Raw | ConvertFrom-Json -AsHashtable
                    if ($phase.Count -ne 2 -or $phase.phase -cnotin @('load-uia','compile-native','pin-process',
                        'discover-native','from-handle','read-tree','verify-native','complete') -or
                        ($phase.elapsedMs -isnot [int] -and $phase.elapsedMs -isnot [long]) -or $phase.elapsedMs -lt 0) {
                        throw 'Reader phase malformed.'
                    }
                    $Diagnostic.phase=$phase.phase; $Diagnostic.readerElapsedMs=$phase.elapsedMs; $Diagnostic.phaseRead='observed'
                } catch { $Diagnostic.phaseRead='unavailable' }
                finally {
                    try { [IO.File]::Delete($phasePath); $Diagnostic.cleanup='deleted' }
                    catch { $Diagnostic.cleanup='failed' }
                }
            } elseif ($phaseOwned) { $Diagnostic.phaseRead='child-exit-unconfirmed'; $Diagnostic.cleanup='child-exit-unconfirmed' }
        }
    }
    if ($Operation -eq 'Observe') { Assert-SettingsWindow $Owned }
    return $text | ConvertFrom-Json
}

function Set-TextScaleCapability($Result) {
    if ($Result.tree.hasMoreChildren) { $Result.reason='settings-content-tree-truncated'; return }
    $markers = @($Result.elements | Where-Object {
        $_.type -in @('Text', 'Group', 'Pane') -and $_.name -match '^(Text size|Make text bigger)$' -and !$_.isOffscreen
    })
    $sliders = @($Result.elements | Where-Object { $_.type -eq 'Slider' -and !$_.isOffscreen })
    $apply = @($Result.elements | Where-Object { $_.type -eq 'Button' -and $_.name -eq 'Apply' -and !$_.isOffscreen })
    if (!$markers.Count) { $Result.reason = 'text-size-page-marker-not-observed'; return }
    if ($sliders.Count -ne 1) { $Result.reason = 'text-size-slider-not-unique'; return }
    if ($sliders[0].name -notmatch '(?i)\b(text size|make text bigger)\b') {
        $Result.reason = 'text-size-slider-label-not-observed'; return
    }
    if (@($Result.elements | Where-Object type -eq 'Slider').Count -ne 1) { $Result.reason = 'range-reader-slider-not-unique'; return }
    $range = $sliders[0].rangeValue
    if ($range.supported -isnot [bool]) { throw 'RangeValue supported не является boolean.' }
    if (!$range.supported) { $Result.reason = 'range-value-pattern-not-supported'; return }
    foreach ($field in @('minimum', 'maximum', 'value')) {
        if (($range.$field -isnot [int] -and $range.$field -isnot [long] -and $range.$field -isnot [double]) -or
            [double]::IsNaN($range.$field) -or [double]::IsInfinity($range.$field)) { throw 'RangeValue не содержит конечное числовое значение.' }
    }
    if ($range.minimum -gt $range.maximum -or $range.value -lt $range.minimum -or $range.value -gt $range.maximum -or
        $range.isReadOnly -isnot [bool]) { throw 'RangeValue нарушил контракт диапазона.' }
    if ($range.isReadOnly -or !$sliders[0].isEnabled) { $Result.reason = 'text-size-slider-read-only-or-disabled'; return }
    if ($apply.Count -ne 1) { $Result.reason = 'apply-button-not-unique'; return }
    if ($apply[0].invokeSupported -isnot [bool]) { throw 'Apply Invoke availability не является boolean.' }
    if (!$apply[0].invokeSupported) { $Result.reason = 'apply-invoke-pattern-not-supported'; return }
    $Result.status = 'available'
    $Result.reason = 'text-size-page-and-writable-range-observed'
}

function Get-TextScaleRemainingMs($Budget, [int]$LimitMs=20000) { return [int][Math]::Max(0, $LimitMs - $Budget.ElapsedMilliseconds) }

function Observe-SettingsContent($Owned, $Result, $Budget, $Diagnostic = $null) {
    do {
        $remaining=Get-TextScaleRemainingMs $Budget
        if ($remaining -le 0) { break }
        if ($null -ne $Diagnostic) {
            $Diagnostic.reader=[ordered]@{ attempt=$Result.samples.Count+1; remainingMs=$remaining }
            $observation=Read-SettingsContent $Owned $remaining -Diagnostic $Diagnostic.reader -DiscoveryBudget $Budget
        } else { $observation=Read-SettingsContent $Owned $remaining }
        $Result.contentRoot=$observation.contentRoot; $Result.topology=$observation.topology
        $Result.tree=$observation.tree; $Result.elements=@($observation.elements)
        $Result.reason=$observation.reason
        if ($null -ne $Result.contentRoot) { Set-TextScaleCapability $Result }
        $Result.samples+=@{ observedAtUtc=$observation.observedAtUtc; reason=$Result.reason;
            contentHwnd=if ($null -ne $Result.contentRoot) { $Result.contentRoot.hwnd } else { $null };
            tree=$Result.tree }
        if ($Result.status -eq 'available' -or $Result.reason -in @('native-window-tree-truncated', 'settings-content-tree-truncated')) { return }
        $remaining=Get-TextScaleRemainingMs $Budget
        if ($remaining -le 500) { break }
        Start-Sleep -Milliseconds 500
    } while ($Result.samples.Count -lt 40)
    if ($null -eq $Result.reason) { $Result.reason='settings-content-not-observed-within-deadline' }
}

function Wait-SystemTextScale([double]$ExpectedFactor, $Budget, [int]$LimitMs) {
    do {
        $remaining=Get-TextScaleRemainingMs $Budget $LimitMs
        if ($remaining -le 0) { throw 'Срок независимого OS readback истёк.' }
        $observation=Read-SystemTextScale $remaining
        if ($observation.textScaleFactor -eq $ExpectedFactor) { return $observation }
        $remaining=Get-TextScaleRemainingMs $Budget $LimitMs
        if ($remaining -gt 0) { Start-Sleep -Milliseconds ([Math]::Min(100,$remaining)) }
    } while ((Get-TextScaleRemainingMs $Budget $LimitMs) -gt 0)
    throw 'Независимый OS getter не подтвердил ожидаемый масштаб в срок.'
}

function Get-PreparedTextScale($Result) {
    if ($Result.status -ne 'available' -or $null -eq $Result.contentRoot) { throw 'Qualification требует доступную страницу Text size.' }
    $admission=@{status='unavailable';reason=$null;tree=$Result.tree;elements=$Result.elements}
    Set-TextScaleCapability $admission
    if ($admission.status -ne 'available') { throw 'Prepared page больше не соответствует capability.' }
    $slider=@($Result.elements | Where-Object type -eq 'Slider')
    $apply=@($Result.elements | Where-Object { $_.type -eq 'Button' -and $_.name -ceq 'Apply' })
    if ($slider.Count -ne 1 -or $apply.Count -ne 1 -or
        [string]::IsNullOrEmpty($slider[0].automationId) -or [string]::IsNullOrEmpty($apply[0].automationId)) {
        throw 'Qualification не получила однозначные AutomationId controls.'
    }
    if ($slider[0].rangeValue.minimum -gt 225 -or $slider[0].rangeValue.maximum -lt 225 -or
        $null -eq $Result.systemTextScaleBefore -or $Result.systemTextScaleBefore.textScaleFactor -lt 1 -or
        $Result.systemTextScaleBefore.textScaleFactor -gt 2.25) { throw 'Исходный OS factor или диапазон 225% не подтверждён.' }
    $owner=$Result.topology.owner
    return @{ hwnd=$Result.contentRoot.hwnd; threadId=$Result.contentRoot.threadId;
        ownerHwnd=$Result.topology.original.ownerHwnd;
        ownerPid=if ($null -ne $owner) { $owner.nativePid } else { $null };
        ownerThreadId=if ($null -ne $owner) { $owner.nativeThreadId } else { $null };
        sliderAutomationId=$slider[0].automationId; applyAutomationId=$apply[0].automationId;
        originalSliderValue=$slider[0].rangeValue.value }
}

function Invoke-TextScaleAction($Owned, $Expected, [string]$Operation, [double]$TargetValue, [int]$TimeoutMs) {
    $observation=Read-SettingsContent $Owned $TimeoutMs $Operation $Expected $TargetValue
    if ($null -eq $observation.action) { throw 'Settings action не вернул receipt.' }
    return $observation.action
}

function Invoke-QualifiedSmoke($Context, $WinApp) {
    # Отдельный script scope в том же PowerShell сохраняет finally владельца анимации.
    & (Join-Path $PSScriptRoot 'smoke.ps1') -ApplicationDirectory $Context.applicationDirectory `
        -OutputDirectory $Context.evidenceDirectory -AnimationSettingsPath $Context.animationSettingsPath `
        -AnimationsEnabled $true -ExpectedTextScale 2.25 -Lifetime:$false -WinApp $WinApp
}

function Read-TextScaleSmokeReceipt($Context, $WinApp) {
    $artifacts=@{}
    foreach ($name in @('identity','result')) {
        $bytes=[IO.File]::ReadAllBytes((Join-Path $Context.evidenceDirectory "$name.json"))
        if (!$bytes.Length -or $bytes.Length -gt 262144) { throw 'Smoke JSON выходит за предел размера.' }
        $artifacts[$name]=@{ value=([Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xfeff) | ConvertFrom-Json);
            sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant() }
    }
    $identity=$artifacts.identity.value; $smoke=$artifacts.result.value
    if ($identity.source -cne $Context.sourceCommit -or $identity.pid -le 0 -or
        ($identity.pid -isnot [int] -and $identity.pid -isnot [long]) -or
        ($identity.startedAtUnixMs -isnot [int] -and $identity.startedAtUnixMs -isnot [long]) -or
        $identity.startedAtUnixMs -lt $Context.smokeStartedAtUnixMs -or
        $identity.startedAtUnixMs -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
        $identity.cliVersion -cne $WinApp.version -or $identity.cliZipSha256 -cne $WinApp.archiveSha256 -or
        $identity.appSha256.ToLowerInvariant() -cne $Context.appSha256 -or
        $identity.animation.expected -isnot [bool] -or !$identity.animation.expected -or
        $smoke.passed -isnot [bool] -or !$smoke.passed -or
        $smoke.initialLayout.pid -ne $identity.pid -or $smoke.initialLayout.textScaleFactor -ne 2.25 -or
        $smoke.initialLayout.observedAtUnixMs -lt $identity.startedAtUnixMs -or
        $smoke.initialLayout.observedAtUnixMs -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) {
        throw 'Smoke receipt не подтверждает текущий source/app/run и TextScaleFactor=2.25.'
    }
    return @{ source=$Context.sourceCommit; tree=$Context.sourceTree; pid=$identity.pid;
        startedAtUnixMs=$identity.startedAtUnixMs; textScaleFactor=$smoke.initialLayout.textScaleFactor;
        appSha256=$Context.appSha256; identitySha256=$artifacts.identity.sha256; resultSha256=$artifacts.result.sha256;
        visualReview='pending' }
}

function Invoke-TextScaleQualification($Owned, $Result, $Context, $WinApp) {
    $prepared=Get-PreparedTextScale $Result
    $Result.prepared=$prepared
    $Result.qualification=@{ status='not-completed'; source=$Context.sourceCommit; tree=$Context.sourceTree;
        apply=$null; scaleAtTarget=$null; smoke=$null; transitionObserved=$false }
    $budget=[Diagnostics.Stopwatch]::StartNew()
    # Родитель знает исходные значения до dispatch, даже если child потеряет ответ после эффекта.
    $Result.changeMayHaveOccurred=$true; $Result.systemTextScaleChanged=$null
    $Result.qualification.apply=Invoke-TextScaleAction $Owned $prepared 'Apply' 225 (Get-TextScaleRemainingMs $budget 30000)
    if ($null -ne $Result.qualification.apply.error) { throw "Settings apply failed at $($Result.qualification.apply.error.stage): $($Result.qualification.apply.error.message)" }
    $Result.qualification.scaleAtTarget=Wait-SystemTextScale 2.25 $budget 30000
    $Result.systemTextScaleChanged=$Result.systemTextScaleBefore.textScaleFactor -ne 2.25
    $Result.qualification.transitionObserved=$Result.systemTextScaleChanged -and $Result.qualification.apply.setDispatched
    $Context.smokeStartedAtUnixMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    Invoke-QualifiedSmoke $Context $WinApp | Out-Null
    $Result.qualification.smoke=Read-TextScaleSmokeReceipt $Context $WinApp
    $Result.qualification.status='runtime-captured'
    $Result.fontQualification='runtime-capture-awaiting-visual-review'
}

function Restore-TextScaleQualification($Owned, $Result) {
    $budget=[Diagnostics.Stopwatch]::StartNew()
    $Result.restore=@{ action=$null; os=$null; confirmed=$false }
    try {
        # Резерв штатного getter внутри 60 секунд оставляет readback после timeout action/его cleanup.
        $actionBudget=[Math]::Max(0,(Get-TextScaleRemainingMs $budget 60000)-15000)
        $Result.restore.action=Invoke-TextScaleAction $Owned $Result.prepared 'Restore' $Result.prepared.originalSliderValue $actionBudget
        if ($null -ne $Result.restore.action.error) { throw "Settings restore failed at $($Result.restore.action.error.stage): $($Result.restore.action.error.message)" }
    } catch {
        $Result.restoreError=@{ stage='restore'; type=$_.Exception.GetType().FullName; message=$_.Exception.Message }
    } finally {
        try {
            $Result.restore.os=Wait-SystemTextScale $Result.systemTextScaleBefore.textScaleFactor $budget 60000
            $Result.restore.confirmed=$true
        } catch {
            $Result.restoreGetterError=@{ stage='restore-os-readback'; type=$_.Exception.GetType().FullName; message=$_.Exception.Message }
        }
    }
}

$output = [IO.Path]::GetFullPath($OutputPath)
$tempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (!$output.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $output)) {
    throw 'Результат должен быть новым файлом внутри RUNNER_TEMP.'
}
if ([string]::IsNullOrWhiteSpace($WinAppDirectory)) { throw 'Требуется новый job-owned WinAppDirectory.' }
. (Join-Path $PSScriptRoot 'winapp.ps1')
$context=$null
if ($Qualify) {
    foreach ($value in @($ApplicationDirectory,$EvidenceDirectory,$AnimationSettingsPath,$SourceCommit)) {
        if ([string]::IsNullOrWhiteSpace($value)) { throw 'Qualification требует app/evidence/animation/source параметры.' }
    }
    $evidence=[IO.Path]::GetFullPath($EvidenceDirectory)
    $evidencePrefix=$evidence.TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
    $toolDirectory=[IO.Path]::GetFullPath($WinAppDirectory)
    if (Test-Path -LiteralPath $evidence) { throw 'Qualification evidence directory уже существует.' }
    if ($output.Equals($evidence,[StringComparison]::OrdinalIgnoreCase) -or
        $output.StartsWith($evidencePrefix,[StringComparison]::OrdinalIgnoreCase) -or
        $toolDirectory.Equals($evidence,[StringComparison]::OrdinalIgnoreCase) -or
        $toolDirectory.StartsWith($evidencePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Smoke evidence должен быть отдельным от receipt и CLI.' }
    $actualSource=(git -C $PSScriptRoot rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $SourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $actualSource -cne $SourceCommit) { throw 'Qualification source не совпадает с checkout.' }
    $tree=(git -C $PSScriptRoot rev-parse 'HEAD^{tree}')
    if ($LASTEXITCODE -ne 0 -or $tree -cnotmatch '^[a-f0-9]{40}$') { throw 'Qualification source tree не определён.' }
    $appPath=Join-Path ([IO.Path]::GetFullPath($ApplicationDirectory)) 'Buttons.exe'
    if (!(Test-Path -LiteralPath $AnimationSettingsPath -PathType Leaf)) { throw 'Animation helper отсутствует.' }
    $context=@{ applicationDirectory=[IO.Path]::GetFullPath($ApplicationDirectory); evidenceDirectory=$evidence;
        animationSettingsPath=[IO.Path]::GetFullPath($AnimationSettingsPath); sourceCommit=$SourceCommit; sourceTree=$tree;
        appSha256=(Get-FileHash -LiteralPath $appPath -Algorithm SHA256).Hash.ToLowerInvariant(); smokeStartedAtUnixMs=$null }
}
$winapp=$null; $cli=$null
$owned = $null
$ownedProcess = $null
$failure = $null
$discoveryBudget = $null
$stage = 'read-system-text-scale'
$result = [ordered]@{
    schemaVersion = 3; experiment = if ($Qualify) { 'settings-text-size-qualification' } else { 'settings-text-size-capability' }; status = 'unavailable'; reason = $null;
    uri = 'ms-settings:easeofaccess-display'; observedAtUtc = [DateTime]::UtcNow.ToString('o');
    osVersion = [Environment]::OSVersion.Version.ToString(); imageOS = $env:ImageOS; imageVersion = $env:ImageVersion;
    cliVersion = $null; cliSha256 = $null;
    systemTextScaleChanged = $false; fontQualification = 'not-performed';
    changeMayHaveOccurred=$false; prepared=$null; qualification=$null; restore=$null; restoreError=$null; restoreGetterError=$null;
    systemTextScaleBefore = $null; snapshotBefore = @(); snapshotAfter = @(); windowCandidate = $null;
    windowDiagnostic = $null; discovery=[ordered]@{ limitMs=20000; launchElapsedMs=$null; startedAtUtc=$null;
        elapsedMs=$null; remainingMs=$null; phases=[ordered]@{}; nativeRead=[ordered]@{}; reader=$null };
    window = $null; contentRoot=$null; topology=$null; tree=$null; samples=@();
    elements = @(); cleanup = 'not-started'; error = $null; cleanupError = $null
}
try {
    $stage='bootstrap-cli'
    $winapp=Initialize-WinApp -Directory $WinAppDirectory
    $cli=$winapp.path; $result.cliVersion=$winapp.version; $result.cliSha256=$winapp.executableSha256
    $stage='read-system-text-scale'
    $result.systemTextScaleBefore = Read-SystemTextScale
    $stage = 'snapshot-before'
    $before = @(Get-SettingsSnapshot)
    $result.snapshotBefore = @($before | Select-Object pid, startTicks, sessionId)
    if ($before.Count) {
        $result.reason = 'settings-process-already-existed'
        $result.snapshotAfter = @(Get-SettingsSnapshot | Select-Object pid, startTicks, sessionId)
    } else {
        $stage = 'launch-uri'
        $launchTicks = [DateTime]::UtcNow.Ticks
        # URI не выдаёт receipt нового Settings PID. Владелец устанавливается отдельно.
        $launchClock=[Diagnostics.Stopwatch]::StartNew()
        try {
            $null = Invoke-TextScaleChild (Join-Path $PSHOME 'pwsh.exe') @('-NoProfile', '-NonInteractive', '-Command',
                'Start-Process -FilePath ms-settings:easeofaccess-display') 10000
        } finally { $result.discovery.launchElapsedMs=$launchClock.ElapsedMilliseconds }
        $discoveryBudget = [Diagnostics.Stopwatch]::StartNew()
        $result.discovery.startedAtUtc=[DateTime]::UtcNow.ToString('o')
        $stage = 'snapshot-after'
        do {
            $after = @(Get-SettingsSnapshot)
            if ($after.Count) { break }
            Start-Sleep -Milliseconds 250
        } while ((Get-TextScaleRemainingMs $discoveryBudget) -gt 0)
        $result.snapshotAfter = @($after | Select-Object pid, startTicks, sessionId)
        $result.discovery.phases.snapshotAfterMs=$discoveryBudget.ElapsedMilliseconds
        $settingsPath = Join-Path $env:SystemRoot 'ImmersiveControlPanel/SystemSettings.exe'
        if ($after.Count -ne 1 -or $after[0].startTicks -lt $launchTicks -or $after[0].path -ine $settingsPath) {
            $result.reason = 'fresh-settings-process-not-unique'
        } else {
            $stage = 'discover-window'
            $result.discovery.phases.windowSearchStartedMs=$discoveryBudget.ElapsedMilliseconds
            $windows=@()
            do {
                $remaining=Get-TextScaleRemainingMs $discoveryBudget
                if ($remaining -le 0) { break }
                $windows = @(Invoke-TextScaleChild $cli @('ui', 'list-windows', '-a', [string]$after[0].pid, '--json') $remaining | ConvertFrom-Json)
                if ($windows.Count) { break }
                Start-Sleep -Milliseconds 250
            } while ((Get-TextScaleRemainingMs $discoveryBudget) -gt 0)
            $result.discovery.phases.windowSearchCompletedMs=$discoveryBudget.ElapsedMilliseconds
            if ($windows.Count -ne 1 -or $windows[0].processId -ne $after[0].pid -or $windows[0].hwnd -le 0) {
                $result.reason = 'settings-window-not-unique'
            } else {
                $owned = $after[0]
                $owned.hwnd = [long]$windows[0].hwnd
                $result.windowCandidate = @{ pid = $owned.pid; startTicks = $owned.startTicks; hwnd = $owned.hwnd;
                    ownerHwnd = $windows[0].ownerHwnd; className = $windows[0].className }
                $ownedProcess = Get-OwnedSettings $owned
                $stage = 'window-diagnostic'
                $result.discovery.phases.windowDiagnosticStartedMs=$discoveryBudget.ElapsedMilliseconds
                $result.windowDiagnostic = Read-SettingsWindowDiagnostic $owned $result.discovery.nativeRead
                $result.discovery.phases.windowDiagnosticCompletedMs=$discoveryBudget.ElapsedMilliseconds
                $stage = 'window-admission'
                Assert-SettingsWindow $owned
                $result.discovery.phases.windowAdmissionCompletedMs=$discoveryBudget.ElapsedMilliseconds
                $result.window = @{ pid = $owned.pid; startTicks = $owned.startTicks; hwnd = $owned.hwnd; threadId = $owned.threadId }
                $stage = 'observe-content'
                try { Observe-SettingsContent $owned $result $discoveryBudget $result.discovery }
                finally { $discoveryBudget.Stop() }
            }
        }
    }
    if ($Qualify) {
        $stage='qualify-text-scale'
        Invoke-TextScaleQualification $owned $result $context $winapp
    }
} catch {
    $failure = $_
    $result.status = 'unavailable'
    $result.reason = 'unexpected-error'
    $result.error = @{ stage = $stage; type = $_.Exception.GetType().FullName; message = $_.Exception.Message }
} finally {
    if ($null -ne $discoveryBudget) {
        $discoveryBudget.Stop()
        $result.discovery.elapsedMs=$discoveryBudget.ElapsedMilliseconds
        $result.discovery.remainingMs=Get-TextScaleRemainingMs $discoveryBudget
    }
    if ($Qualify -and $result.changeMayHaveOccurred) {
        try { Restore-TextScaleQualification $owned $result }
        catch { $result.restoreError=@{ stage='restore'; type=$_.Exception.GetType().FullName; message=$_.Exception.Message } }
        if ($null -ne $result.restoreError -or $null -ne $result.restoreGetterError -or !$result.restore.confirmed) {
            $result.status='failed'
            if (!$failure) { $result.reason='restore-not-clean'; $failure=[InvalidOperationException]::new('Исходный scale не восстановлен без ошибок.') }
        }
    }
    try {
        try { $result.cleanup = Close-SettingsWindow $owned }
        finally { if ($ownedProcess) { $ownedProcess.Dispose() } }
    } catch {
        $result.cleanup = 'failed'
        $result.status = 'unavailable'
        $result.cleanupError = @{ stage = 'cleanup'; type = $_.Exception.GetType().FullName; message = $_.Exception.Message }
        if (!$failure) { $result.reason = 'cleanup-error'; $failure = $_ }
    }
    if ($Qualify -and !$failure) { $result.status='passed'; $result.reason='runtime-captured-and-original-scale-restored' }
    $json = $result | ConvertTo-Json -Depth 8 -Compress
    if ([Text.Encoding]::UTF8.GetByteCount($json) -gt 65536) { throw 'Capability JSON превысил 64 KiB.' }
    [IO.File]::WriteAllText($output, $json, [Text.UTF8Encoding]::new($false))
    Write-Output "LABUI_TEXT_SCALE_CAPABILITY_JSON $json"
}
if ($failure) { throw $failure }
