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
    return [ordered]@{ status = 'unavailable'; reason = $null; tree=@{ hasMoreChildren=$false }; elements = @(
        @{ name = 'Text size'; automationId = 'observed-header'; type = 'Text'; isOffscreen = $false; isEnabled = $true },
        @{ name = 'Text size'; automationId = 'observed-slider'; type = 'Slider'; isOffscreen = $false; isEnabled = $true;
            rangeValue=@{ supported=$true; minimum=100; maximum=225; value=130; isReadOnly=$false } },
        @{ name = 'Apply'; automationId = 'observed-apply'; type = 'Button'; isOffscreen = $false; isEnabled = $false; invokeSupported=$true }
    ) }
}
foreach ($fault in @('none', 'missing-page', 'duplicate-slider', 'wrong-slider-label', 'extra-offscreen-slider', 'missing-apply',
    'unsupported', 'readonly', 'invalid-value', 'string-value', 'truncated', 'apply-not-invokable', 'duplicate-apply')) {
    $result = New-CapabilityFixture
    $range = $result.elements[1].rangeValue
    switch ($fault) {
        'missing-page' { $result.elements = @($result.elements | Where-Object type -ne 'Text') }
        'duplicate-slider' { $result.elements += $result.elements[1].Clone() }
        'wrong-slider-label' { $result.elements[1].name = '' }
        'extra-offscreen-slider' { $other=$result.elements[1].Clone(); $other.isOffscreen=$true; $result.elements+=$other }
        'missing-apply' { $result.elements = @($result.elements | Where-Object type -ne 'Button') }
        'unsupported' { $range.supported = $false }
        'readonly' { $range.isReadOnly = $true }
        'invalid-value' { $range.value = 300 }
        'string-value' { $range.value = '130' }
        'truncated' { $result.tree.hasMoreChildren=$true }
        'apply-not-invokable' { $result.elements[2].invokeSupported=$false }
        'duplicate-apply' { $result.elements+=$result.elements[2].Clone() }
    }
    $failure = $null
    try { Set-TextScaleCapability $result } catch { $failure = $_ }
    Assert (($null -ne $failure) -eq ($fault -in @('invalid-value', 'string-value'))) "Неверный контракт RangeValue: $fault."
    Assert (($result.status -eq 'available') -eq ($fault -eq 'none')) "Ложный capability available: $fault."
}

# Вложенный PS5 reader проверяется как source; UIAutomation/Settings здесь не запускаются.
$readerText = @($ast.FindAll({ param($node)
    $node -is [Management.Automation.Language.StringConstantExpressionAst] -and
    $node.StringConstantType -eq [Management.Automation.Language.StringConstantType]::SingleQuotedHereString
}, $true) | Where-Object Value -Match 'UIAutomationClient')[0].Value
$null = [Management.Automation.Language.Parser]::ParseInput($readerText, [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Повреждён синтаксис framework reader.'
$readerAst = [Management.Automation.Language.Parser]::ParseInput($readerText, [ref]$tokens, [ref]$errors)
$rangeIdentity = @($readerAst.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Assert-SettingsContentIdentity'
})[0]
foreach ($definition in $readerAst.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst]
}) { . ([scriptblock]::Create($definition.Extent.Text)) }
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
        try { Assert-SettingsContentIdentity $fixtureProcess $fixtureRoot } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Range reader identity пропустил отказ: $fault."
    } $fault
}
Assert ($readerText -notmatch 'MainWindowHandle') 'Range reader сохранил main-window heuristic.'
$pinOffset = $readerText.IndexOf('$processHandle = $process.Handle')
Assert ($pinOffset -ge 0 -and $pinOffset -lt $readerText.IndexOf('::FromHandle')) 'Range reader не закрепил процесс до UIA lookup.'
Assert ($readerText.LastIndexOf('Assert-SettingsContentIdentity $process $root') -gt $readerText.IndexOf('$content=Read-ContentTree')) 'Content reader не проверил identity после чтения.'
Assert ($readerText -notmatch '\.FindAll\(' -and $source -notmatch "'ui', 'inspect'|Get-TextScaleElements|Read-SettingsRanges") 'Остался отдельный источник допуска либо неограниченный UIA обход.'

# Native shim компилируется без вызовов user32; topology проверяется подставными данными.
$nativeText = @($readerAst.FindAll({ param($node)
    $node -is [Management.Automation.Language.StringConstantExpressionAst] -or
    $node -is [Management.Automation.Language.ExpandableStringExpressionAst]
}, $true) | Where-Object Value -Match 'class LabUISettingsContentNative')[0].Value
Add-Type -TypeDefinition $nativeText
$readerStart=@($readerAst.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -eq '$process'
})[0].Extent.StartOffset
$readerInitialization=$readerText.Substring(0,$readerStart)+"`n'PS5 reader initialization: native/UIA types compiled; no discovery executed.'"
$frameworkShell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$initialization=Invoke-TextScaleChild $frameworkShell @('-NoProfile','-NonInteractive','-STA','-Command',$readerInitialization)
Assert ($initialization.Trim() -eq 'PS5 reader initialization: native/UIA types compiled; no discovery executed.') 'PS5 command transport/compilation lost the real reader.'
Write-Output $initialization.Trim()
foreach ($invalidScope in @(@(0,3187), @(900,0))) {
    $failure=$null
    try { [LabUISettingsContentNative]::Descendants($invalidScope[0], $invalidScope[1]) | Out-Null } catch { $failure=$_ }
    Assert ($null -ne $failure) 'NULL owner/empty PID получил desktop-wide enumeration.'
}
foreach ($fault in @('own-root', 'own-owner', 'hosted-child', 'no-child', 'two-children', 'truncated', 'missing-owner', 'foreign-child', 'wrong-thread')) {
    & {
        param($fault)
        $settingsPid=3187
        $original=[pscustomobject]@{ hwnd=42; ownerHwnd=900; nativePid=3187; nativeThreadId=5500 }
        $owner=[pscustomobject]@{ hwnd=900; nativePid=9999; nativeThreadId=9900 }
        $child=[pscustomobject]@{ hwnd=43; parentHwnd=900; rootHwnd=900; nativePid=3187; nativeThreadId=5501 }
        $summary=@{ visited=3; matching=1; truncated=$false }; $descendants=@($child)
        function Test-ContentDescendant { param($OwnerHandle,$ContentHandle)
            Assert ($OwnerHandle -eq 900 -and $ContentHandle -eq 43) 'Ancestry lookup вышел за fixture owner/child.'
            return $true
        }
        switch($fault) {
            'own-root' { $original.ownerHwnd=0; $owner=$null; $descendants=@() }
            'own-owner' { $owner.nativePid=3187; $descendants=@() }
            'no-child' { $summary.matching=0; $descendants=@() }
            'two-children' { $summary.matching=2; $descendants+= $child }
            'truncated' { $summary.truncated=$true }
            'missing-owner' { $owner=$null }
            'foreign-child' { $child.nativePid=9999 }
            'wrong-thread' { $child.nativeThreadId=0 }
        }
        $failure=$null; $selected=$null
        try { $selected=Select-ContentWindow $original $owner $descendants $summary } catch { $failure=$_ }
        Assert (($null -ne $failure) -eq ($fault -in @('missing-owner','foreign-child','wrong-thread'))) "Topology error lost: $fault."
        $expected=switch($fault){ 'own-root'{42}; 'own-owner'{900}; 'hosted-child'{43}; default{$null} }
        Assert (($null -eq $selected -and $null -eq $expected) -or ($null -ne $selected -and $selected.hwnd -eq $expected)) "Wrong content selection: $fault."
        Assert ($original.hwnd -eq 42) 'Content discovery изменил cleanup HWND.'
    } $fault
}

# Загружаются только типы UIA. FromHandle, UIA walker и Settings не вызываются.
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function New-TreeNode([int]$Id, [string]$Type='Pane', [string]$Name='PRIVATE ACCOUNT') {
    $node=[pscustomobject]@{ Id=$Id; Child=$null; Sibling=$null; RangeReads=0; InvokeReads=0; ReadFault=$false;
        Current=[pscustomobject]@{ ProcessId=3187; NativeWindowHandle=0; Name=$Name; AutomationId="id-$Id";
            ControlType=[pscustomobject]@{ ProgrammaticName="ControlType.$Type" }; IsEnabled=$true; IsOffscreen=$false };
        Range=[pscustomobject]@{ Minimum=100; Maximum=225; Value=137; IsReadOnly=$false } }
    $node | Add-Member ScriptMethod GetRuntimeId { return [int[]]@(42,$this.Id) }
    $node | Add-Member ScriptMethod TryGetCurrentPattern {
        param($Pattern, $Value)
        if ($this.ReadFault) { throw 'fixture pattern failure' }
        if ($Pattern -eq [Windows.Automation.RangeValuePattern]::Pattern) {
            $this.RangeReads++; $Value.Value=[pscustomobject]@{ Current=$this.Range }; return $true
        }
        if ($Pattern -eq [Windows.Automation.InvokePattern]::Pattern) { $this.InvokeReads++; return $true }
        throw 'Unexpected pattern read'
    }
    return $node
}
function New-TreeWalker {
    $walker=[pscustomobject]@{ Calls=0 }
    $walker | Add-Member ScriptMethod GetFirstChild { param($Node) $this.Calls++; return $Node.Child }
    $walker | Add-Member ScriptMethod GetNextSibling { param($Node) $this.Calls++; return $Node.Sibling }
    return $walker
}
foreach ($fault in @('healthy-child', 'foreign-root', 'foreign-node', 'wrong-root-hwnd', 'changes-after-read',
    'pattern-error', 'duplicate-runtime', 'long-relevant-id', 'private-slider', 'node-limit', 'depth-limit', 'entry-limit')) {
    & {
        param($fault)
        $settingsPid=3187; $settingsPath='fixture/SystemSettings.exe'; $sessionId=1; $handle=43
        $started=[DateTime]::UtcNow.AddMinutes(-1); $startTicks=$started.Ticks
        $process=[pscustomobject]@{ StartTime=$started; Path=$settingsPath; SessionId=1; HasExited=$false; ChangeAfter=$fault -eq 'changes-after-read' }
        $process | Add-Member ScriptMethod Refresh { if($this.ChangeAfter){ $this.StartTime=$this.StartTime.AddSeconds(1) } }
        $root=New-TreeNode 1; $root.Current.NativeWindowHandle=43
        $header=New-TreeNode 2 'Text' 'Text size'; $slider=New-TreeNode 3 'Slider' 'Text size'; $apply=New-TreeNode 4 'Button' 'Apply'
        $root.Child=$header; $header.Sibling=$slider; $slider.Sibling=$apply
        $outside=New-TreeNode 5 'Slider' 'Text size'; $outside.Current.ProcessId=9999
        $root.Sibling=$outside
        switch($fault) {
            'foreign-root' { $root.Current.ProcessId=9999 }
            'foreign-node' { $header.Current.ProcessId=9999 }
            'wrong-root-hwnd' { $root.Current.NativeWindowHandle=900 }
            'pattern-error' { $slider.ReadFault=$true }
            'duplicate-runtime' { $slider.Id=$header.Id }
            'long-relevant-id' { $slider.Current.AutomationId='x'*257 }
            'private-slider' { $slider.Current.Name='PRIVATE ACCOUNT'; $slider.Current.AutomationId='PRIVATE ACCOUNT' }
            'node-limit' {
                $node=$apply
                foreach($id in 10..530){ $node.Sibling=New-TreeNode $id; $node=$node.Sibling }
            }
            'depth-limit' {
                $node=$root
                foreach($id in 10..22){ $node.Child=New-TreeNode $id; $node=$node.Child }
                $node.Child=$header
            }
            'entry-limit' {
                $node=$apply
                foreach($id in 10..40){ $node.Sibling=New-TreeNode $id 'Text' 'Text size'; $node=$node.Sibling }
            }
        }
        $walker=New-TreeWalker; $failure=$null; $observed=$null
        try { $observed=Read-ContentTree $process $root $walker } catch { $failure=$_ }
        $fails=$fault -in @('foreign-root','foreign-node','wrong-root-hwnd','changes-after-read','pattern-error','duplicate-runtime','long-relevant-id','entry-limit')
        Assert (($null -ne $failure) -eq $fails) "Same-root reader boundary lost: $fault."
        Assert ($outside.RangeReads -eq 0) 'Reader прочитал соседний root с теми же labels/AutomationId.'
        if(!$fails) {
            Assert (!(($observed | ConvertTo-Json -Depth 8) -match 'PRIVATE ACCOUNT')) 'Reader раскрыл посторонний Settings label/AutomationId.'
            $result=@{ status='unavailable'; reason=$null; elements=@($observed.elements); tree=$observed.tree }
            Set-TextScaleCapability $result
            Assert (($result.status -eq 'available') -eq ($fault -eq 'healthy-child')) "Incomplete/private tree became available: $fault."
            if($fault -eq 'healthy-child') {
                Assert ($observed.tree.nodeCount -eq 4 -and $observed.elements.Count -eq 3 -and $slider.RangeReads -eq 1 -and $apply.InvokeReads -eq 1) 'Same-root healthy control не прочитал полный набор.'
                Assert ($observed.elements[1].rangeValue.value -eq 137 -and $observed.elements[1].runtimeId[1] -eq 3) 'RangeValue оторван от наблюдённого Slider.'
            }
            if($fault -eq 'private-slider') { Assert ($slider.RangeReads -eq 0 -and $null -eq $observed.elements[1].rangeValue) 'Reader прочитал значение нерелевантного Slider.' }
            if($fault -eq 'node-limit') { Assert ($observed.tree.nodeCount -eq 512 -and $observed.tree.nodeLimited -and $walker.Calls -le 1024) 'Node bound ограничил только output.' }
            if($fault -eq 'depth-limit') { Assert ($observed.tree.maxDepth -eq 12 -and $observed.tree.depthLimited -and $slider.RangeReads -eq 0) 'Reader вышел за depth bound.' }
        }
    } $fault
}
Write-Output 'Same-root witness: hosted child accepted; neighboring root unread; range=137 retained; identity/privacy/depth/node/entry limits checked.'

# F1: исполняются текущий selector и настоящий блок readback после native metadata.
# Только IsChild/metadata/UIA заменены fixture; подмена не меняет проверяемый guard.
$afterAssignment=$readerAst.Find({ param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$candidateAfter'
}, $true)
$readbackGuard=[scriptblock]::Create((@($afterAssignment.Parent.Statements | Where-Object {
    $_.Extent.StartOffset -gt $afterAssignment.Extent.EndOffset
} | ForEach-Object { $_.Extent.Text }) -join "`n"))
foreach($mode in @('direct','nested','owner-self','own-root','reparented-before-metadata','ancestor-moved-before-readback')) {
    & {
        param($mode)
        $settingsPid=3187; $settingsPath='fixture/SystemSettings.exe'; $sessionId=1
        $started=[DateTime]::UtcNow.AddMinutes(-1); $startTicks=$started.Ticks
        $process=[pscustomobject]@{StartTime=$started;Path=$settingsPath;SessionId=1;HasExited=$false}
        $process | Add-Member ScriptMethod Refresh {}
        $original=[pscustomobject]@{hwnd=42;ownerHwnd=900;parentHwnd=0;rootHwnd=42;nativePid=3187;nativeThreadId=5500}
        $owner=[pscustomobject]@{hwnd=900;parentHwnd=1000;rootHwnd=1000;nativePid=9999;nativeThreadId=9900}
        $child=[pscustomobject]@{hwnd=43;parentHwnd=900;rootHwnd=1000;nativePid=3187;nativeThreadId=5501}
        if($mode -in @('nested','ancestor-moved-before-readback')){ $child.parentHwnd=800 }
        if($mode -eq 'reparented-before-metadata'){ $child.parentHwnd=901; $child.rootHwnd=901 }
        if($mode -eq 'owner-self'){ $owner.nativePid=3187 }
        if($mode -eq 'own-root'){ $original.ownerHwnd=0; $owner=$null }
        $calls=@{ ancestry=0; uia=0 }
        function Test-ContentDescendant { param($OwnerHandle,$ContentHandle)
            Assert ($OwnerHandle -eq 900 -and $ContentHandle -eq 43) 'IsChild получил неверные HWND.'
            $calls.ancestry++
            return $mode -ne 'reparented-before-metadata' -and !($mode -eq 'ancestor-moved-before-readback' -and $calls.ancestry -eq 2)
        }
        $failure=$null; $result=@{status='unavailable';reason=$null;tree=$null;elements=@()}
        try {
            $candidate=Select-ContentWindow $original $owner @($child) @{visited=1;matching=1;truncated=$false}
            $handle=[long]$candidate.hwnd
            Assert-ContentWindow $candidate $handle 0
            $root=New-TreeNode 1; $root.Current.NativeWindowHandle=[int]$handle
            $header=New-TreeNode 2 'Text' 'Text size'; $slider=New-TreeNode 3 'Slider' 'Text size'; $apply=New-TreeNode 4 'Button' 'Apply'
            $root.Child=$header; $header.Sibling=$slider; $slider.Sibling=$apply
            $calls.uia++
            $content=Read-ContentTree $process $root (New-TreeWalker)
            $candidateAfter=$candidate.PSObject.Copy()
            . $readbackGuard
            $result.tree=$content.tree; $result.elements=$content.elements
            Set-TextScaleCapability $result
        } catch { $failure=$_ }
        $reject=$mode -in @('reparented-before-metadata','ancestor-moved-before-readback')
        Write-Output ("Ancestry witness: mode=$mode rejected=$($null -ne $failure) status=$($result.status) checks=$($calls.ancestry) uiaReads=$($calls.uia) cleanup=$($original.hwnd)")
        Assert (($null -ne $failure) -eq $reject -and ($result.status -eq 'available') -eq !$reject) "F1 ancestry boundary failed: $mode."
        if($reject){ Assert ($failure.Exception.Message -match 'subtree') 'Отказ вызван не ancestry guard.' }
        Assert ($original.hwnd -eq 42) 'Ancestry guard изменил cleanup target.'
        if($mode -eq 'reparented-before-metadata'){ Assert ($calls.uia -eq 0 -and $calls.ancestry -eq 1) 'Stale enumeration допустил UIA lookup.' }
        elseif($mode -in @('owner-self','own-root')){ Assert ($calls.ancestry -eq 0) 'Self/root требует ложного IsChild(owner,owner).' }
    } $mode
}

# Topology и UIA повторяются внутри одного остаточного бюджета; cleanup HWND не подменяется.
foreach($fault in @('late-page','exhausted','truncated')) {
    & {
        param($fault)
        $owned=@{ hwnd=42 }; $budget=[pscustomobject]@{ ElapsedMilliseconds=if($fault -eq 'exhausted'){20000}else{1000} }
        $calls=[Collections.Generic.List[int]]::new()
        $result=[ordered]@{ status='unavailable'; reason=$null; contentRoot=$null; topology=$null; tree=$null; elements=@(); samples=@() }
        function Read-SettingsContent { param($Owned,$TimeoutMs)
            Assert ($Owned.hwnd -eq 42) 'Retry изменил cleanup HWND.'
            $calls.Add($TimeoutMs); $budget.ElapsedMilliseconds+=1000
            $fixture=New-CapabilityFixture
            if($calls.Count -eq 1){ $fixture.elements=@() }
            if($fault -eq 'truncated'){ $fixture.tree.hasMoreChildren=$true }
            return @{ contentRoot=@{hwnd=43}; topology=@{}; tree=$fixture.tree; elements=$fixture.elements; reason=$null; observedAtUtc=[DateTime]::UtcNow.ToString('o') }
        }
        function Start-Sleep { param($Milliseconds) $budget.ElapsedMilliseconds+=$Milliseconds }
        Observe-SettingsContent $owned $result $budget
        Assert ($owned.hwnd -eq 42) 'Observed content стал cleanup target.'
        if($fault -eq 'late-page') {
            Assert ($result.status -eq 'available' -and $result.samples.Count -eq 2 -and $calls[0] -eq 19000 -and $calls[1] -eq 17500) 'Retry заново выдал deadline либо не увидел позднюю страницу.'
        } elseif($fault -eq 'exhausted') { Assert ($calls.Count -eq 0 -and $result.status -eq 'unavailable') 'Reader запущен после deadline.' }
        else { Assert ($calls.Count -eq 1 -and $result.reason -eq 'settings-content-tree-truncated') 'Заведомо неполный обход повторён/принят.' }
    } $fault
}

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
    $_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -eq '$original'
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
