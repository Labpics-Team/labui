param([string]$Harness = (Join-Path $PSScriptRoot 'text-scale.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }
$tokens = $null
$errors = $null
$source = [IO.File]::ReadAllText($Harness)
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Повреждён синтаксис capability harness.'
foreach ($definition in $ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst]
}) { . ([scriptblock]::Create($definition.Extent.Text)) }

# Запускается настоящий script entry; отказ обязан предшествовать любому discovery.
$saved = @{}
foreach ($name in @('GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT', 'RUNNER_OS')) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
}
try {
    foreach ($setting in @(
        @('false', 'github-hosted', 'Windows'), @('true', 'self-hosted', 'Windows'),
        @('true', 'github-hosted', 'Linux')
    )) {
        $env:GITHUB_ACTIONS, $env:RUNNER_ENVIRONMENT, $env:RUNNER_OS = $setting
        $failure = $null
        try { & $Harness -OutputPath 'unreachable.json' } catch { $failure = $_ }
        Assert ($null -ne $failure -and $failure.Exception.Message -match '^Settings разрешены') 'Hosted guard пропустил неподходящую среду.'
    }
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}

# Owned HWND допустим при MainWindowHandle=0; чужая identity не получает close.
foreach ($fault in @('none', 'window-gone', 'pid-reused', 'path-changed', 'session-changed', 'process-exited',
    'foreign-pid', 'window-gone-before', 'thread-changed', 'changes-before-post', 'disabled',
    'close-refused', 'close-timeout', 'foreign-after-post', 'read-error-after-post')) {
    & {
        param($fault)
        $started = [DateTime]::UtcNow.AddMinutes(-1)
        $owned = @{ pid = 3187; startTicks = $started.Ticks; path = 'fixture/SystemSettings.exe'; sessionId = 1; hwnd = 42; threadId = 5500 }
        $fixtureProcess = [pscustomobject]@{ StartTime = $started; Path = $owned.path; SessionId = 1; HasExited = $false;
            MainWindowHandle = [IntPtr]0; Fault = $fault; Disposed = $false; PinReads = 0 }
        $fixtureProcess | Add-Member ScriptProperty Handle { $this.PinReads++; return [IntPtr]9 }
        $fixtureProcess | Add-Member ScriptMethod WaitForExit {
            param($Timeout)
            if ($this.Fault -eq 'close-timeout') { Start-Sleep -Milliseconds $Timeout; return $false }
            return $true
        }
        $fixtureProcess | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
        $calls = @{ read = 0; post = 0 }
        switch ($fault) {
            'pid-reused' { $fixtureProcess.StartTime = $started.AddSeconds(1) }
            'path-changed' { $fixtureProcess.Path = 'fixture/foreign.exe' }
            'session-changed' { $fixtureProcess.SessionId = 2 }
            'process-exited' { $fixtureProcess.HasExited = $true }
        }
        function Get-Process { param($Id, $ErrorAction) return $fixtureProcess }
        function Read-SettingsWindowOwner { param($Handle)
            Assert ($Handle -eq 42) 'Close наблюдает чужой HWND.'
            $calls.read++
            $window = @{ nativePid = 3187; nativeThreadId = 5500; nativeAlive = $true; nativeError = 0 }
            if ($fault -eq 'foreign-pid' -or ($fault -eq 'changes-before-post' -and $calls.read -ge 2) -or
                ($fault -eq 'foreign-after-post' -and $calls.post)) { $window.nativePid = 9999 }
            if ($fault -eq 'thread-changed') { $window.nativeThreadId = 5501 }
            if ($fault -eq 'window-gone-before' -or ($fault -eq 'window-gone' -and $calls.post)) {
                $window.nativeAlive = $false; $window.nativeThreadId = 0; $window.nativeError = 1400
            }
            if ($fault -eq 'read-error-after-post' -and $calls.post) {
                $window.nativeAlive = $false; $window.nativeThreadId = 0; $window.nativeError = 5
            }
            return $window
        }
        function Test-SettingsWindowEnabled { param($Handle) return $fault -ne 'disabled' }
        function Send-SettingsWindowClose { param($Handle)
            Assert ($Handle -eq 42 -and !$fixtureProcess.Disposed -and $fixtureProcess.PinReads -gt 0) 'Close вышел за HWND/pinned process scope.'
            $calls.post++
            return @{ sent = $fault -ne 'close-refused'; nativeError = if ($fault -eq 'close-refused') { 5 } else { 0 } }
        }
        $failure = $null
        $result = $null
        $timer = [Diagnostics.Stopwatch]::StartNew()
        try { $result = Close-SettingsWindow $owned } catch { $failure = $_ }
        $success = $fault -in @('none', 'window-gone')
        Assert (($null -ne $failure) -eq !$success) "Cleanup потерял отказ: $fault."
        $shouldPost = $fault -in @('none', 'window-gone', 'close-refused', 'close-timeout', 'foreign-after-post', 'read-error-after-post')
        Assert ($calls.post -eq [int]$shouldPost) "Закрыто чужое окно либо повторён close: $fault."
        Assert ($fixtureProcess.Disposed -and $fixtureProcess.PinReads -gt 0) "Process handle не закреплён/освобождён: $fault."
        if ($success) { Assert ($result -eq 'closed') 'Нет readback закрытия.' }
        if ($fault -eq 'close-timeout') { Assert ($timer.ElapsedMilliseconds -ge 5000 -and $timer.ElapsedMilliseconds -lt 7000) 'Close потерял ограниченное ожидание.' }
    } $fault
}
Assert ((Close-SettingsWindow $null) -eq 'no-owned-window') 'Cleanup требует несуществующее владение.'

# Исполняются настоящий catch/finally: cleanup не должен стирать первичный отказ.
$outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })[-1]
$catchBody = $outer.CatchClauses[0].Body.Extent.Text
$catchBlock = [scriptblock]::Create($catchBody.Substring(1, $catchBody.Length - 2))
$finallyBody = $outer.Finally.Extent.Text
$finallyBlock = [scriptblock]::Create($finallyBody.Substring(1, $finallyBody.Length - 2))
foreach ($hasPrimary in @($true, $false)) {
    & {
        param($hasPrimary)
        $result = [ordered]@{ status = 'available'; reason = $null; error = $null; cleanupError = $null; cleanup = 'not-started' }
        $output = Join-Path ([IO.Path]::GetTempPath()) "labui-settings-error-$([guid]::NewGuid()).json"
        $owned = $null
        $ownedProcess = $null
        $failure = $null
        $stage = 'window-admission'
        function Close-SettingsWindow { param($Owned) throw 'fixture cleanup' }
        try {
            if ($hasPrimary) { try { throw 'fixture primary' } catch { . $catchBlock } }
            . $finallyBlock | Out-Null
            $readback = Get-Content -LiteralPath $output -Raw | ConvertFrom-Json
            if ($hasPrimary) {
                Assert ($readback.error.message -eq 'fixture primary' -and $readback.error.stage -eq 'window-admission') 'Cleanup стёр первичный отказ в JSON.'
                Assert ($failure.Exception.Message -eq 'fixture primary') 'Cleanup заменил выбрасываемый первичный отказ.'
            } else {
                Assert ($null -eq $readback.error -and $readback.reason -eq 'cleanup-error') 'Создан несуществующий первичный отказ.'
            }
            Assert ($readback.cleanupError.message -eq 'fixture cleanup') 'Отказ cleanup не сохранён отдельно.'
        } finally { if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output } }
    } $hasPrimary
}

# UISettings child подменён только на границе процесса; WinRT/GUI не запускаются.
foreach ($fault in @('none', 'wrong-api', 'wrong-session', 'stale', 'future', 'string-value', 'out-of-range', 'child-failed')) {
    & {
        param($fault)
        function Invoke-TextScaleChild {
            param($Executable, $Arguments)
            Assert ($Executable -like '*WindowsPowerShell*v1.0*powershell.exe') 'Getter не направлен в framework PowerShell.'
            $code = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($Arguments[-1]))
            Assert ($code -match 'ContentType=WindowsRuntime' -and $code -match '\$settings.TextScaleFactor') 'Getter не читает настоящий OS API.'
            if ($fault -eq 'child-failed') { throw 'fixture getter failure' }
            $now = [DateTimeOffset]::UtcNow
            $value = @{ schemaVersion = 1; api = 'Windows.UI.ViewManagement.UISettings.TextScaleFactor';
                pid = 3187; sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId;
                startTicks = $now.UtcTicks; observedAtUnixMs = $now.ToUnixTimeMilliseconds(); textScaleFactor = 1.25 }
            switch ($fault) {
                'wrong-api' { $value.api = 'registry' }
                'wrong-session' { $value.sessionId = -1 }
                'stale' { $value.startTicks = $now.AddMinutes(-1).UtcTicks }
                'future' { $value.observedAtUnixMs = $now.AddMinutes(1).ToUnixTimeMilliseconds() }
                'string-value' { $value.textScaleFactor = '1.25' }
                'out-of-range' { $value.textScaleFactor = 2.5 }
            }
            return $value | ConvertTo-Json -Compress
        }
        $failure = $null
        $value = $null
        try { $value = Read-SystemTextScale } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -ne 'none')) "OS getter потерял границу readback: $fault."
        if ($fault -eq 'none') { Assert ($value.textScaleFactor -eq 1.25) 'Getter подменил реальное значение expected/default.' }
    } $fault
}

# MainWindow остаётся диагностикой: валидный creator PID/thread допускается при любом main HWND.
foreach ($mainHandle in @(0, 42, 43)) {
    & {
        param($mainHandle)
        $started = [DateTime]::UtcNow.AddMinutes(-1)
        $owned = @{ pid = 3187; startTicks = $started.Ticks; path = 'fixture/SystemSettings.exe'; sessionId = 1; hwnd = 42 }
        $fixtureProcess = [pscustomobject]@{ StartTime = $started; Path = $owned.path; SessionId = 1; Handle = [IntPtr]9; HasExited = $false;
            MainWindowHandle = [IntPtr]$mainHandle; Refreshed = $false }
        $fixtureProcess | Add-Member ScriptMethod Refresh { $this.Refreshed = $true }
        $fixtureProcess | Add-Member ScriptMethod Dispose { }
        function Get-Process { param($Id, $ErrorAction) return $fixtureProcess }
        function Read-SettingsWindowOwner { param($Handle)
            Assert ($Handle -eq 42) 'Native read вышел за выбранный HWND.'
            return @{ nativePid = 3187; nativeThreadId = 5500; nativeAlive = $true; nativeError = 0 }
        }
        $value = Read-SettingsWindowDiagnostic $owned
        Assert ($fixtureProcess.Refreshed -and $value.mainWindowHandle -eq $mainHandle -and $value.nativePid -eq 3187) 'Потерян различитель main/native HWND.'
        $failure = $null
        try { Assert-SettingsWindow $owned } catch { $failure = $_ }
        Assert ($null -eq $failure -and $owned.threadId -eq 5500) 'MainWindow heuristic отверг допустимый PID-scoped HWND либо thread не закреплён.'
    } $mainHandle
}
$mainBody = $outer.Body.Extent.Text
Assert ($mainBody.IndexOf('Read-SystemTextScale') -lt $mainBody.IndexOf('Start-Process -FilePath ms-settings:')) 'OS getter должен завершиться до Settings launch.'
Assert ($mainBody.IndexOf('$result.windowCandidate =') -lt $mainBody.IndexOf('Assert-SettingsWindow $owned')) 'Candidate теряется при отказе admission.'
Assert ($mainBody.IndexOf('Read-SettingsWindowDiagnostic $owned') -lt $mainBody.IndexOf('Assert-SettingsWindow $owned')) 'Native HWND observation записан после admission.'

function New-CapabilityFixture {
    return [ordered]@{ status = 'unavailable'; reason = $null; elements = @(
        @{ selector = 'observed-header'; name = 'Text size'; automationId = 'observed-header'; type = 'Text'; isOffscreen = $false; isEnabled = $true },
        @{ selector = 'observed-slider'; name = 'Text size'; automationId = 'observed-slider'; type = 'Slider'; isOffscreen = $false; isEnabled = $true },
        @{ selector = 'observed-apply'; name = 'Apply'; automationId = 'observed-apply'; type = 'Button'; isOffscreen = $false; isEnabled = $false }
    ) }
}
foreach ($fault in @('none', 'missing-page', 'duplicate-slider', 'wrong-slider-label', 'foreign-range', 'extra-range', 'missing-apply', 'unsupported', 'readonly', 'invalid-value', 'string-value')) {
    $result = New-CapabilityFixture
    $range = @{ name = 'Text size'; automationId = 'observed-slider'; type = 'Slider'; supported = $true;
        minimum = 100; maximum = 225; value = 130; isReadOnly = $false }
    switch ($fault) {
        'missing-page' { $result.elements = @($result.elements | Where-Object type -ne 'Text') }
        'duplicate-slider' { $result.elements += $result.elements[1].Clone() }
        'wrong-slider-label' { $result.elements[1].name = 'Brightness'; $range.name = 'Brightness' }
        'foreign-range' { $range.automationId = 'foreign' }
        'missing-apply' { $result.elements = @($result.elements | Where-Object type -ne 'Button') }
        'unsupported' { $range.supported = $false }
        'readonly' { $range.isReadOnly = $true }
        'invalid-value' { $range.value = 300 }
        'string-value' { $range.value = '130' }
    }
    $ranges = @($range)
    if ($fault -eq 'extra-range') {
        $other = $range.Clone()
        $other.automationId = 'second-slider-beyond-inspect-depth'
        $ranges += $other
    }
    $failure = $null
    try { Set-TextScaleCapability $result $ranges } catch { $failure = $_ }
    Assert (($null -ne $failure) -eq ($fault -in @('invalid-value', 'string-value'))) "Неверный контракт RangeValue: $fault."
    Assert (($result.status -eq 'available') -eq ($fault -eq 'none')) "Ложный capability available: $fault."
}

$tree = '{"windows":[{"hwnd":42,"elements":[{"selector":"account","name":"PRIVATE ACCOUNT","type":"Text","isEnabled":true,"isOffscreen":false,"children":[{"selector":"live-slider","name":"Text size","automationId":"live-slider","type":"Slider","isEnabled":true,"isOffscreen":false},{"type":"Pane"}]}]}]}' | ConvertFrom-Json
$inventory = @(Get-TextScaleElements $tree 42)
Assert ($inventory.Count -eq 1 -and $inventory[0].selector -eq 'live-slider') 'В опубликованный inventory попал посторонний текст Settings.'
Assert (!(($inventory | ConvertTo-Json -Depth 5) -match 'PRIVATE ACCOUNT')) 'Inventory раскрыл нерелевантный label.'
$failure = $null
try { Get-TextScaleElements $tree 43 | Out-Null } catch { $failure = $_ }
Assert ($null -ne $failure) 'Inspect другого HWND принят.'

# Вложенный PS5 reader проверяется как source; UIAutomation/Settings здесь не запускаются.
$readerText = @($ast.FindAll({ param($node)
    $node -is [Management.Automation.Language.StringConstantExpressionAst] -and
    $node.StringConstantType -eq [Management.Automation.Language.StringConstantType]::SingleQuotedHereString
}, $true) | Where-Object Value -Match 'UIAutomationClient')[0].Value
$null = [Management.Automation.Language.Parser]::ParseInput($readerText, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Повреждён синтаксис framework reader.'
$readerAst = [Management.Automation.Language.Parser]::ParseInput($readerText, [ref]$tokens, [ref]$errors)
$rangeIdentity = @($readerAst.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Assert-SettingsRangeIdentity'
})[0]
. ([scriptblock]::Create($rangeIdentity.Extent.Text))
foreach ($fault in @('none', 'pid-reused', 'wrong-path', 'wrong-session', 'exited', 'foreign-root', 'wrong-hwnd')) {
    & {
        param($fault)
        $settingsPid = 3187; $settingsPath = 'fixture/SystemSettings.exe'; $sessionId = 1; $handle = 42
        $started = [DateTime]::UtcNow.AddMinutes(-1); $startTicks = $started.Ticks
        $fixtureProcess = [pscustomobject]@{ StartTime = $started; Path = $settingsPath; SessionId = 1; HasExited = $false; MainWindowHandle = [IntPtr]0 }
        $fixtureRoot = [pscustomobject]@{ Current = [pscustomobject]@{ ProcessId = 3187; NativeWindowHandle = 42 } }
        switch ($fault) {
            'pid-reused' { $fixtureProcess.StartTime = $started.AddSeconds(1) }
            'wrong-path' { $fixtureProcess.Path = 'fixture/foreign.exe' }
            'wrong-session' { $fixtureProcess.SessionId = 2 }
            'exited' { $fixtureProcess.HasExited = $true }
            'foreign-root' { $fixtureRoot.Current.ProcessId = 9999 }
            'wrong-hwnd' { $fixtureRoot.Current.NativeWindowHandle = 43 }
        }
        $failure = $null
        try { Assert-SettingsRangeIdentity $fixtureProcess $fixtureRoot } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Range reader identity пропустил отказ: $fault."
    } $fault
}
Assert ($readerText -notmatch 'MainWindowHandle') 'Range reader сохранил main-window heuristic.'
$pinOffset = $readerText.IndexOf('$processHandle = $process.Handle')
Assert ($pinOffset -ge 0 -and $pinOffset -lt $readerText.IndexOf('::FromHandle')) 'Range reader не закрепил процесс до UIA lookup.'
Assert ($readerText.LastIndexOf('Assert-SettingsRangeIdentity $process $root') -gt $readerText.IndexOf('$ranges += $entry')) 'Range reader не проверил identity после чтения.'

# Настоящий .NET getter важен: PowerShell может поглотить его исключение.
$handleFixture = @'
using System;
using System.ComponentModel;
public sealed class LabUIHandleAdmissionFixture {
    public int Mode;
    public DateTime StartTime;
    public string Path;
    public int SessionId = 1;
    public bool HasExited;
    public bool Disposed;
    public int HandleAttempts;
    public int HandleAcquired;
    public IntPtr Handle { get {
        HandleAttempts++;
        if (Mode == 1) throw new Win32Exception(5);
        if (Mode == 2) return IntPtr.Zero;
        HandleAcquired++;
        return new IntPtr(9);
    } }
    public bool WaitForExit(int timeout) { return true; }
    public void Dispose() { Disposed = true; }
}
'@
Add-Type -TypeDefinition $handleFixture
function New-HandleAdmissionFixture {
    param($Fault, $Started, $Path)
    if ($Fault -in @('missing', 'wrong-type')) {
        $fixture = [pscustomobject]@{ StartTime = $Started; Path = $Path; SessionId = 1; HasExited = $false; Disposed = $false }
        $fixture | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
        if ($Fault -eq 'wrong-type') { $fixture | Add-Member NoteProperty Handle 9 }
        return $fixture
    }
    $fixture = [LabUIHandleAdmissionFixture]::new()
    $fixture.StartTime = $Started; $fixture.Path = $Path
    $fixture.Mode = if ($Fault -eq 'denied') { 1 } elseif ($Fault -eq 'zero') { 2 } else { 0 }
    return $fixture
}

# Исполняется точный reader prefix до FromHandle на PS5; вместо UIA — счётчик допуска.
$rangeTry = @($readerAst.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })[0]
$rootLookup = @($rangeTry.Body.Statements | Where-Object {
    $_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -eq '$root'
})[0]
$rangePrefix = ($rangeTry.Body.Statements | Where-Object { $_.Extent.StartOffset -lt $rootLookup.Extent.StartOffset } | ForEach-Object { $_.Extent.Text }) -join "`n"
$factory = "function New-HandleAdmissionFixture {`n$((Get-Item Function:New-HandleAdmissionFixture).Definition)`n}"
$rangeProbe = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('__FIXTURE__')))
. ([scriptblock]::Create([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('__FACTORY__'))))
. ([scriptblock]::Create([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('__IDENTITY__'))))
$guard = [scriptblock]::Create([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('__GUARD__')))
$observations = foreach ($fault in @('healthy', 'denied', 'zero', 'missing', 'wrong-type')) {
    $started = [DateTime]::UtcNow.AddMinutes(-1); $startTicks = $started.Ticks
    $settingsPid = 3187; $settingsPath = 'fixture/SystemSettings.exe'; $sessionId = 1; $handle = 42
    $process = New-HandleAdmissionFixture $fault $started $settingsPath
    $failed = $false; $uiaReads = 0
    try { . $guard; $uiaReads++ } catch { $failed = $true }
    finally { $process.Dispose() }
    @{ fault = $fault; failed = $failed; uiaReads = $uiaReads; disposed = $process.Disposed }
}
@{ powershell = $PSVersionTable.PSVersion.ToString(); observations = @($observations) } | ConvertTo-Json -Depth 4 -Compress
'@
foreach ($entry in @{
    '__FIXTURE__' = $handleFixture; '__FACTORY__' = $factory;
    '__IDENTITY__' = $rangeIdentity.Extent.Text; '__GUARD__' = $rangePrefix
}.GetEnumerator()) {
    $rangeProbe = $rangeProbe.Replace($entry.Key, [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($entry.Value)))
}
$encodedProbe = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($rangeProbe))
$frameworkShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$rangeHandleResult = Invoke-TextScaleChild $frameworkShell @('-NoProfile', '-NonInteractive', '-EncodedCommand', $encodedProbe) | ConvertFrom-Json
Write-Output ('PS5 handle witness: ' + ($rangeHandleResult | ConvertTo-Json -Depth 4 -Compress))
foreach ($row in $rangeHandleResult.observations) {
    $healthy = $row.fault -eq 'healthy'
    Assert ($row.failed -eq !$healthy -and $row.uiaReads -eq [int]$healthy -and $row.disposed) "PS5 range reader допустил UIA без handle: $($row.fault)."
}
foreach ($fault in @('healthy', 'denied', 'zero', 'missing', 'wrong-type')) {
    & {
        param($fault)
        $started = [DateTime]::UtcNow.AddMinutes(-1)
        $owned = @{ pid = 3187; startTicks = $started.Ticks; path = 'fixture/SystemSettings.exe'; sessionId = 1; hwnd = 42; threadId = 5500 }
        $fixture = New-HandleAdmissionFixture $fault $started $owned.path
        $calls = @{ native = 0; post = 0 }
        function Get-Process { param($Id, $ErrorAction) return $fixture }
        function Read-SettingsWindowOwner { param($Handle)
            $calls.native++
            return @{ nativePid = 3187; nativeThreadId = 5500; nativeAlive = $true; nativeError = 0 }
        }
        function Test-SettingsWindowEnabled { param($Handle) return $true }
        function Send-SettingsWindowClose { param($Handle) $calls.post++; return @{ sent = $true; nativeError = 0 } }
        $failure = $null
        try { Close-SettingsWindow $owned | Out-Null } catch { $failure = $_ }
        $healthy = $fault -eq 'healthy'
        Assert (($null -ne $failure) -eq !$healthy -and $fixture.Disposed) "Handle admission потерял отказ/dispose: $fault."
        Assert ($calls.post -eq [int]$healthy -and ($healthy -or $calls.native -eq 0)) "Native read/close выполнен без handle: $fault."
        if ($healthy) { Assert ($fixture.HandleAcquired -eq 1) 'Healthy control не получил настоящий IntPtr.' }
    } $fault
}
$getterText = @($ast.FindAll({ param($node)
    $node -is [Management.Automation.Language.StringConstantExpressionAst] -and
    $node.StringConstantType -eq [Management.Automation.Language.StringConstantType]::SingleQuotedHereString
}, $true) | Where-Object Value -Match 'ContentType=WindowsRuntime')[0].Value
$null = [Management.Automation.Language.Parser]::ParseInput($getterText, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Повреждён синтаксис framework getter.'
Assert ($source -notmatch '\bSetValue\s*\(|\bset-value\b|\bSet-ItemProperty\b|\bStop-Process\b') 'Read-only experiment получил путь изменения настройки/чужого процесса.'

# Настоящий свежий PS5 getter: служебный progress не должен ломать JSON-ответ.
# Читается действующее значение OS API; настройка и окна не изменяются.
$systemScale = Read-SystemTextScale
Assert ($systemScale.textScaleFactor -ge 1 -and $systemScale.textScaleFactor -le 2.25) 'OS getter не вернул действующий масштаб.'

# Настоящий bounded child, но только echo/exit/sleep: никакого GUI или UIAutomation.
$shell = Join-Path $PSHOME 'pwsh.exe'
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("[Console]::OutputEncoding = [Text.UTF8Encoding]::new(`$false); 'Размер текста'"))
$readback = Invoke-TextScaleChild $shell @('-NoProfile', '-NonInteractive', '-EncodedCommand', $encoded)
Assert ($readback.Trim() -ceq 'Размер текста') 'Дочерний процесс исказил UTF-8.'
foreach ($command in @('exit 2', '[Console]::Error.WriteLine("fixture error")', 'Start-Sleep -Seconds 30')) {
    $failure = $null
    $timer = [Diagnostics.Stopwatch]::StartNew()
    try { Invoke-TextScaleChild $shell @('-NoProfile', '-NonInteractive', '-Command', $command) 1000 | Out-Null } catch { $failure = $_ }
    Assert ($null -ne $failure -and $timer.Elapsed.TotalSeconds -lt 10) 'Child error/timeout не завершился ограниченно.'
}

# Прямой child уже вышел, но потомок держит унаследованные pipes ещё четыре секунды.
$definition = @($ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Invoke-TextScaleChild'
})[0]
$readAssignment = $definition.Find({ param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$stderr' -and $node.Right.Extent.Text -match 'ReadToEndAsync'
}, $true)
$script:textScaleReadTasks = @()
# Наблюдаются ссылки настоящих Task; реализация чтения/ожидания/cleanup не подменяется.
$instrumented = $definition.Extent.Text.Replace($readAssignment.Extent.Text,
    $readAssignment.Extent.Text + "`n`$script:textScaleReadTasks = @(`$stdout, `$stderr)")
. ([scriptblock]::Create($instrumented))
$childCode = '$info=[Diagnostics.ProcessStartInfo]::new((Join-Path $PSHOME ''pwsh.exe'')); $info.UseShellExecute=$false; $info.CreateNoWindow=$true; foreach($argument in @(''-NoProfile'',''-NonInteractive'',''-Command'',''Start-Sleep -Seconds 4'')){$info.ArgumentList.Add($argument)}; $child=[Diagnostics.Process]::Start($info); $child.Dispose()'
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childCode))
$failure = $null
$timer = [Diagnostics.Stopwatch]::StartNew()
try { Invoke-TextScaleChild $shell @('-NoProfile', '-NonInteractive', '-EncodedCommand', $encoded) 1500 | Out-Null } catch { $failure = $_ }
$elapsed = $timer.ElapsedMilliseconds
$readsCompleted = $script:textScaleReadTasks.Count -eq 2 -and @($script:textScaleReadTasks | Where-Object { !$_.IsCompleted }).Count -eq 0
# Потомок fixture завершится сам; это не новая production-политика управления потомками.
if ($elapsed -lt 5000) { Start-Sleep -Milliseconds (5000 - $elapsed) }
Write-Output "Pipe witness: timeoutMs=1500 elapsedMs=$elapsed failed=$($null -ne $failure) readsCompleted=$readsCompleted"
Assert ($null -ne $failure -and $elapsed -lt 4000) 'Ожидание EOF вышло за общий deadline дочернего процесса.'
Assert $readsCompleted 'После возврата harness остались незавершённые чтения pipes.'
Write-Output 'PASS: owned HWND admission, scoped close, range identity, OS getter and bounded child; Settings/UIA not executed.'
