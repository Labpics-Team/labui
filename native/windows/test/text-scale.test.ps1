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

# Реальное тело child исполняется с инертными владельцами процесса и отмены.
# Отказы cleanup не теряют primary и не прерывают освобождение других ресурсов.
& {
    $definition = @($ast.EndBlock.Statements | Where-Object {
        $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Invoke-TextScaleChild'
    })[0].Extent.Text
    $inert = $definition.Replace('[Diagnostics.ProcessStartInfo]::new($Executable)', '(New-ChildInfoFixture)').
        Replace('[Diagnostics.Process]::Start($info)', '(Start-ChildFixture)').
        Replace('[Threading.CancellationTokenSource]::new()', '(New-ChildCancellationFixture)')
    . ([scriptblock]::Create($inert))
    function New-ChildInfoFixture {
        return [pscustomobject]@{ UseShellExecute=$true; CreateNoWindow=$false; RedirectStandardOutput=$false;
            RedirectStandardError=$false; StandardOutputEncoding=$null; StandardErrorEncoding=$null;
            Environment=@{}; ArgumentList=[Collections.Generic.List[string]]::new() }
    }
    $cases = @(
        @{ name='success'; primary=$false; faults=@() },
        @{ name='timeout'; primary=$true; faults=@() }
    )
    foreach ($fault in @('kill', 'cancel', 'wait', 'read', 'stdout-dispose', 'stderr-dispose', 'process-dispose', 'cancellation-dispose')) {
        $cases += @{ name="timeout+$fault"; primary=$true; faults=@($fault) }
    }
    foreach ($fault in @('cancel', 'stdout-dispose', 'stderr-dispose', 'process-dispose', 'cancellation-dispose')) {
        $cases += @{ name="success+$fault"; primary=$false; faults=@($fault) }
    }
    $cases += @{ name='timeout+all'; primary=$true; faults=@('kill', 'cancel', 'wait', 'read',
        'stdout-dispose', 'stderr-dispose', 'process-dispose', 'cancellation-dispose') }
    $cases += @{ name='timeout+cancelled-read'; primary=$true; faults=@('cancelled-read') }
    foreach ($case in $cases) {
        & {
            param($Case)
            $readers = foreach ($stream in @('stdout', 'stderr')) {
                $reader = [pscustomobject]@{ Stream=$stream; Faults=$Case.faults; DisposeCalls=0 }
                $reader | Add-Member ScriptMethod ReadToEndAsync {
                    param($Token)
                    $completion = [Threading.Tasks.TaskCompletionSource[string]]::new()
                    if ($this.Stream -eq 'stdout' -and 'read' -in $this.Faults) {
                        $completion.SetException([InvalidOperationException]::new('fixture read'))
                    } elseif ($this.Stream -eq 'stdout' -and 'cancelled-read' -in $this.Faults) {
                        $completion.SetCanceled()
                    } else { $completion.SetResult($(if ($this.Stream -eq 'stdout') { 'fixture output' } else { '' })) }
                    return $completion.Task
                }
                $reader | Add-Member ScriptMethod Dispose {
                    $this.DisposeCalls++
                    if (($this.Stream + '-dispose') -in $this.Faults) { throw ('fixture ' + $this.Stream + '-dispose') }
                }
                $reader
            }
            $fixture = [pscustomobject]@{ HasExited=!$Case.primary; Primary=$Case.primary; Faults=$Case.faults;
                StandardOutput=$readers[0]; StandardError=$readers[1]; ExitCode=0; KillCalls=0; WaitCalls=0; DisposeCalls=0 }
            $fixture | Add-Member ScriptMethod WaitForExit {
                param($Timeout)
                $this.WaitCalls++
                if ($this.WaitCalls -eq 1 -and $this.Primary) { return $false }
                if ('wait' -in $this.Faults) { throw 'fixture wait' }
                $this.HasExited=$true
                return $true
            }
            $fixture | Add-Member ScriptMethod Kill {
                $this.KillCalls++
                if ('kill' -in $this.Faults) { throw 'fixture kill' }
                $this.HasExited=$true
            }
            $fixture | Add-Member ScriptMethod Dispose {
                $this.DisposeCalls++
                if ('process-dispose' -in $this.Faults) { throw 'fixture process-dispose' }
            }
            $cancellationFixture = [pscustomobject]@{ Token=[Threading.CancellationToken]::None;
                Faults=$Case.faults; CancelCalls=0; DisposeCalls=0 }
            $cancellationFixture | Add-Member ScriptMethod CancelAfter { param($Timeout) }
            $cancellationFixture | Add-Member ScriptMethod Cancel {
                $this.CancelCalls++
                if ('cancel' -in $this.Faults) { throw 'fixture cancel' }
            }
            $cancellationFixture | Add-Member ScriptMethod Dispose {
                $this.DisposeCalls++
                if ('cancellation-dispose' -in $this.Faults) { throw 'fixture cancellation-dispose' }
            }
            function Start-ChildFixture { return $fixture }
            function New-ChildCancellationFixture { return $cancellationFixture }
            $failure=$null; $output=$null
            $diagnostic=@{}
            try { $output=Invoke-TextScaleChild 'inert' @() 1000 -Diagnostic $diagnostic } catch { $failure=$_ }
            $message = if ($failure) { $failure.Exception.Message } else { '' }
            Write-Output ('Child cleanup witness: ' + (@{ case=$Case.name; message=$message;
                kill=$fixture.KillCalls; wait=$fixture.WaitCalls; stdoutDispose=$readers[0].DisposeCalls;
                stderrDispose=$readers[1].DisposeCalls; processDispose=$fixture.DisposeCalls;
                cancel=$cancellationFixture.CancelCalls; cancellationDispose=$cancellationFixture.DisposeCalls } | ConvertTo-Json -Compress))
            if ($Case.primary) {
                Assert ($message.Contains('Дочерний процесс превысил срок наблюдения.')) "Cleanup стёр первичный timeout: $($Case.name)."
                Assert ($fixture.KillCalls -eq 1 -and $fixture.WaitCalls -ge 2) "Cleanup не попытался завершить собственный процесс: $($Case.name)."
            } elseif (!$Case.faults.Count) {
                Assert ($null -eq $failure -and $output -ceq 'fixture output') 'Child cleanup нарушил разрешённый успешный ответ.'
            } else { Assert ($null -ne $failure) "Cleanup error превратился в успех: $($Case.name)." }
            foreach ($fault in $Case.faults | Where-Object { $_ -ne 'cancelled-read' }) {
                Assert ($message.Contains("fixture $fault")) "Cleanup потерял конкретный отказ $fault : $($Case.name)."
            }
            Assert ($readers[0].DisposeCalls -eq 1 -and $readers[1].DisposeCalls -eq 1 -and
                $fixture.DisposeCalls -eq 1 -and $cancellationFixture.DisposeCalls -eq 1 -and
                $cancellationFixture.CancelCalls -eq 1) "Один cleanup отказ прервал остальные attempts: $($Case.name)."
            Assert ($diagnostic.childStarted -and $diagnostic.childWaitRemainingMs -ge 0 -and
                $diagnostic.childWaitRemainingMs -le 1000 -and $diagnostic.childExited -eq ('wait' -notin $Case.faults)) `
                "Child diagnostic выдал неподтверждённый exit либо потерял остаток срока: $($Case.name)."
            if ($Case.name -eq 'timeout+cancelled-read') {
                Assert ($failure.Exception -isnot [AggregateException]) 'Ожидаемая отмена чтения добавлена как новый cleanup отказ.'
            }
        } $case
    }
}

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
        $success = $fault -in @('none', 'window-gone', 'window-gone-before')
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
        $Qualify=$false
        $result = [ordered]@{ status = 'available'; reason = $null; error = $null; cleanupError = $null; cleanup = 'not-started' }
        $output = Join-Path ([IO.Path]::GetTempPath()) "labui-settings-error-$([guid]::NewGuid()).json"
        $owned = $null
        $ownedProcess = $null
        $discoveryBudget = $null
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
$phaseWriter=@($readerAst.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Write-SettingsReaderPhase'
})[0].Extent.Text

# Исполняются настоящее владение phase-файлом и сериализация; граница child инертна.
foreach ($fault in @('success','timeout','malformed','extra-field','unknown-phase','missing','oversized','not-started','exit-unconfirmed','create-failed')) {
    & {
        param($fault)
        $fixtureRoot=Join-Path ([IO.Path]::GetTempPath()) ('labui-phase-fixture-'+[guid]::NewGuid().ToString('N'))
        $null=New-Item -ItemType Directory -Path $fixtureRoot
        $savedTemp=$env:RUNNER_TEMP
        $env:RUNNER_TEMP=if ($fault -eq 'create-failed') { Join-Path $fixtureRoot 'absent' } else { $fixtureRoot }
        $owned=@{pid=3187;startTicks=42;path='fixture/SystemSettings.exe';sessionId=1;hwnd=43;threadId=55}
        $calls=@{path=$null;admission=0}
        function Assert-SettingsWindow { param($Owned) $calls.admission++ }
        function Invoke-TextScaleChild {
            param($Executable,$Arguments,$TimeoutMs,$Diagnostic)
            Assert ($TimeoutMs -eq 18000) 'Phase observation изменила заданный срок child.'
            $Diagnostic.childStarted=$fault -ne 'not-started'; $Diagnostic.childExited=$fault -notin @('not-started','exit-unconfirmed')
            $Diagnostic.childWaitRemainingMs=17999
            $commandAst=[Management.Automation.Language.Parser]::ParseInput($Arguments[-1],[ref]$null,[ref]$null)
            $pathAssignment=@($commandAst.EndBlock.Statements | Where-Object {
                $_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -eq '$phasePath'
            })
            if ($fault -eq 'create-failed') { Assert ($pathAssignment.Count -eq 0) 'Child получил не принадлежащий вызову файл.' }
            else {
                Assert ($pathAssignment.Count -eq 1) 'Phase path не передан ровно один раз.'
                . ([scriptblock]::Create($pathAssignment[0].Extent.Text))
                $calls.path=$phasePath
                Assert ([IO.File]::Exists($phasePath)) 'Child создал файл вместо parent.'
                . ([scriptblock]::Create($phaseWriter))
                $operationClock=[Diagnostics.Stopwatch]::StartNew()
                $phaseOutput=@(if ($fault -ne 'not-started') { Write-SettingsReaderPhase 'from-handle' })
                Assert ($phaseOutput.Count -eq 0) 'Phase writer загрязнил stdout.'
                switch ($fault) {
                    'malformed' { [IO.File]::WriteAllText($phasePath,'{"phase":"from-handle","elapsedMs":"0"}') }
                    'extra-field' { [IO.File]::WriteAllText($phasePath,'{"phase":"from-handle","elapsedMs":0,"name":"private UI"}') }
                    'unknown-phase' { [IO.File]::WriteAllText($phasePath,'{"phase":"private UI","elapsedMs":0}') }
                    'missing' { [IO.File]::Delete($phasePath) }
                    'oversized' { [IO.File]::WriteAllText($phasePath,('x'*513)) }
                }
            }
            if ($fault -ne 'success') { throw 'fixture primary observation failure' }
            return '{"contentRoot":null,"reason":"fixture"}'
        }
        try {
            $diagnostic=[ordered]@{}; $failure=$null; $observation=$null
            $fixtureBudget=[pscustomobject]@{ElapsedMilliseconds=3000}
            try { $observation=Read-SettingsContent $owned 18000 -Diagnostic $diagnostic -DiscoveryBudget $fixtureBudget } catch { $failure=$_ }
            Assert (($null -eq $failure) -eq ($fault -eq 'success')) "Phase diagnostic изменила исход: $fault."
            if ($failure) { Assert ($failure.Exception.Message -ceq 'fixture primary observation failure') "Phase diagnostic стёрла primary: $fault." }
            $observed=$fault -in @('success','timeout')
            Assert (($diagnostic.phaseRead -ceq 'observed') -eq $observed) "Неверный допуск phase JSON: $fault."
            if ($observed) { Assert ($diagnostic.phase -ceq 'from-handle' -and $diagnostic.readerElapsedMs -ge 0) "Потеряна последняя фаза: $fault." }
            else { Assert ($null -eq $diagnostic.phase -and $null -eq $diagnostic.readerElapsedMs) "Неопределённость подменена фазой: $fault." }
            Assert ($diagnostic.timeoutMs -eq 18000 -and $diagnostic.elapsedMs -ge 0) "Потеряно время вызова: $fault."
            Assert ($diagnostic.childStartRemainingMs -eq 17000) 'Child start выдал старый timeout за текущий остаток discovery.'
            if ($fault -eq 'exit-unconfirmed') {
                Assert ($diagnostic.cleanup -eq 'child-exit-unconfirmed' -and [IO.File]::Exists($calls.path)) 'Phase читался/удалялся при живом child.'
            } elseif ($fault -eq 'create-failed') { Assert ($diagnostic.cleanup -eq 'not-created') 'Приписано владение несозданным файлом.' }
            else { Assert ($diagnostic.cleanup -eq 'deleted' -and ![IO.File]::Exists($calls.path)) "Утёк собственный phase-файл: $fault." }
            $receipt=@{status=if ($failure) {'unavailable'} else {'fixture'};discovery=@{reader=$diagnostic}} | ConvertTo-Json -Depth 8 -Compress
            $readback=$receipt | ConvertFrom-Json
            Assert ($readback.discovery.reader.phaseRead -eq $diagnostic.phaseRead -and $receipt -notmatch 'private UI|labui-settings-phase-') 'Receipt раскрыл UI/path либо потерял diagnostic.'
        } finally {
            $env:RUNNER_TEMP=$savedTemp
            # Нет настоящего child; fixture владеет каждым созданным здесь файлом.
            if ($calls.path -and [IO.File]::Exists($calls.path)) { [IO.File]::Delete($calls.path) }
            [IO.Directory]::Delete($fixtureRoot)
        }
    } $fault
}
Write-Output 'Settings phase diagnostic: PASS (fixed schema, time, primary failure, confirmed exit, owned cleanup; no GUI).'

# Startup failure не оставляет несуществующий child в состоянии started.
& {
    $diagnostic=@{}; $failure=$null
    $missing=Join-Path ([IO.Path]::GetTempPath()) ('labui-no-child-'+[guid]::NewGuid().ToString('N')+'.exe')
    try { Invoke-TextScaleChild $missing @() 1000 -Diagnostic $diagnostic | Out-Null } catch { $failure=$_ }
    Assert ($null -ne $failure -and !$diagnostic.childStarted -and !$diagnostic.childExited) 'Отказ Process.Start получил ложную identity child.'
}

# Реальная компиляция shim; единственный native вызов заменён значениями fixture.
& {
    $nativeDefinition=@($ast.EndBlock.Statements | Where-Object {
        $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Read-SettingsWindowOwner'
    })[0].Extent.Text
    $nativeCall='$threadId = [LabUISettingsWindowReadback]::GetWindowThreadProcessId([IntPtr]$Handle, [ref]$ownerPid)'
    Assert ($nativeDefinition.Contains($nativeCall)) 'Native timing fixture потерял границу user32.'
    . ([scriptblock]::Create($nativeDefinition.Replace($nativeCall,'$ownerPid=3187; $threadId=55')))
    foreach ($attempt in @(1,2)) {
        $diagnostic=[ordered]@{}
        $value=Read-SettingsWindowOwner 42 $diagnostic
        Assert ($value.nativePid -eq 3187 -and $diagnostic.nativeTypeReadyMs -ge 0 -and
            $diagnostic.nativeOwnerReadMs -ge $diagnostic.nativeTypeReadyMs) 'Native timing потерял порядок compile/read.'
        if ($attempt -eq 2) { Assert $diagnostic.nativeTypeWasLoaded 'Повторный native read снова заявил cold compile.' }
    }
}

# Настоящие main/catch/finally с инертными границами: elapsed и remaining сохраняются при отказе Observe.
foreach ($rejectObserve in @($false,$true)) {
    & {
        param($rejectObserve)
        $Qualify=$false
        $resultInitialization=@($ast.EndBlock.Statements | Where-Object {
            $_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -eq '$result'
        })[0].Extent.Text
        . ([scriptblock]::Create($resultInitialization))
        $Qualify=$false; $WinAppDirectory='inert'; $owned=$null; $ownedProcess=$null; $failure=$null; $discoveryBudget=$null
        $calls=@{snapshots=0}; $stage='fixture'
        $output=Join-Path ([IO.Path]::GetTempPath()) ('labui-discovery-time-'+[guid]::NewGuid().ToString('N')+'.json')
        function Initialize-WinApp { param($Directory) return @{path='inert';version='fixture';executableSha256='fixture'} }
        function Read-SystemTextScale { return @{textScaleFactor=1} }
        function Get-SettingsSnapshot {
            $calls.snapshots++
            if ($calls.snapshots -gt 1) { return @{pid=3187;startTicks=[DateTime]::UtcNow.Ticks;sessionId=1;path=(Join-Path $env:SystemRoot 'ImmersiveControlPanel/SystemSettings.exe')} }
        }
        function Invoke-TextScaleChild {
            param($Executable,$Arguments,$TimeoutMs)
            if ($Executable -eq 'inert') { return '[{"processId":3187,"hwnd":42,"ownerHwnd":0,"className":"fixture"}]' }
            Assert ($TimeoutMs -eq 10000) 'URI launch получил другой deadline.'
        }
        function Get-OwnedSettings { param($Owned) return $null }
        function Read-SettingsWindowDiagnostic { param($Owned,$Diagnostic) return @{nativePid=3187} }
        function Assert-SettingsWindow { param($Owned) $Owned.threadId=55 }
        function Read-SettingsContent {
            param($Owned,$TimeoutMs,$Diagnostic)
            Assert ($Diagnostic.remainingMs -eq $TimeoutMs -and $TimeoutMs -gt 0 -and $TimeoutMs -le 20000) 'Reader не получил фактический остаток discovery.'
            $Diagnostic.timeoutMs=$TimeoutMs
            if ($rejectObserve) { throw 'fixture Observe timeout' }
            $result.status='available'
            return @{contentRoot=$null;topology=$null;tree=$null;elements=@();reason='fixture';observedAtUtc='fixture'}
        }
        function Close-SettingsWindow { param($Owned) return 'closed' }
        try {
            try { . ([scriptblock]::Create($mainBody.Substring(1,$mainBody.Length-2))) } catch { . $catchBlock }
            . $finallyBlock | Out-Null
            $receipt=Get-Content -LiteralPath $output -Raw | ConvertFrom-Json
            Assert ($receipt.discovery.elapsedMs -ge 0 -and $receipt.discovery.remainingMs -eq [Math]::Max(0,20000-$receipt.discovery.elapsedMs)) 'Discovery elapsed/remaining потерян при сериализации.'
            Assert ($receipt.discovery.launchElapsedMs -ge 0 -and $receipt.discovery.reader.timeoutMs -gt 0) 'Launch/reader timing отсутствует.'
            $previous=0
            foreach ($phase in $receipt.discovery.phases.PSObject.Properties) {
                Assert ($phase.Value -ge $previous -and $phase.Value -le $receipt.discovery.elapsedMs) 'Parent phases переставлены либо вышли за свой clock.'
                $previous=$phase.Value
            }
            Assert (($null -ne $receipt.error) -eq $rejectObserve) 'Timing diagnostic изменила исход Observe.'
            if ($rejectObserve) { Assert ($receipt.error.message -ceq 'fixture Observe timeout' -and $receipt.error.stage -ceq 'observe-content') 'Timing diagnostic потеряла primary/stage.' }
        } finally { if ([IO.File]::Exists($output)) { [IO.File]::Delete($output) } }
    } $rejectObserve
}
Write-Output 'Settings discovery timing: PASS (launch, native compilation, parent deadline, Observe failure receipt; no GUI).'

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
            Assert (!((@{elements=$observed.elements;tree=$observed.tree} | ConvertTo-Json -Depth 8) -match 'PRIVATE ACCOUNT')) 'Reader раскрыл посторонний Settings label/AutomationId.'
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

# Настоящий action body с удержанными fake UIA references; эффектов ОС нет.
$actionTests = {
    foreach($fault in @('apply','restore','already-original','rounded','partial-set','invoke-failed','apply-disabled',
        'control-before-set','control-before-invoke','root-before-set','root-before-invoke','deadline-before-set')) {
        & {
            param($fault)
            $settingsPid=3187; $operation=if($fault -in @('restore','already-original')){'Restore'}else{'Apply'}
            $targetValue=if($operation -eq 'Restore'){137}else{225}
            $operationTimeoutMs=30000; $operationClock=[pscustomobject]@{ElapsedMilliseconds=0}
            $expected=@{sliderAutomationId='id-3';applyAutomationId='id-4';originalSliderValue=137}
            $slider=New-TreeNode 3 'Slider' 'Text size'; $apply=New-TreeNode 4 'Button' 'Apply'
            $apply.Current.IsEnabled=$false
            if($fault -eq 'restore'){$slider.Range.Value=225}
            $range=[pscustomobject]@{Current=$slider.Range;Apply=$apply;Slider=$slider;Fault=$fault;Sets=0}
            $range | Add-Member ScriptMethod SetValue {
                param($Value)
                $this.Sets++; $this.Current.Value=$Value
                if($this.Fault -eq 'rounded'){$this.Current.Value=$Value-1}
                if($this.Fault -eq 'partial-set'){throw 'fixture partial effect'}
                if($this.Fault -eq 'control-before-invoke'){$this.Slider.Current.AutomationId='changed'}
                if($this.Fault -ne 'apply-disabled'){$this.Apply.Current.IsEnabled=$true}
            }
            $invoke=[pscustomobject]@{Calls=0;Fault=$fault}
            $invoke | Add-Member ScriptMethod Invoke { $this.Calls++; if($this.Fault -eq 'invoke-failed'){throw 'fixture invoke failure'} }
            $elements=@(
                @{type='Text';name='Text size';isOffscreen=$false;isEnabled=$true},
                @{type='Slider';name='Text size';automationId='id-3';runtimeId=@(42,3);isOffscreen=$false;isEnabled=$true;
                    rangeValue=@{supported=$true;minimum=100;maximum=225;value=$slider.Range.Value;isReadOnly=$false}},
                @{type='Button';name='Apply';automationId='id-4';runtimeId=@(42,4);isOffscreen=$false;isEnabled=$false;invokeSupported=$true})
            $content=@{elements=$elements;tree=@{hasMoreChildren=$false};targets=@(
                @{element=$slider;pattern=$range;observation=$elements[1]},
                @{element=$apply;pattern=$invoke;observation=$elements[2]})}
            $calls=@{boundary=0}
            function Assert-SettingsActionBoundary {
                param($Process,$Root,$Candidate,$Owner,$Original)
                $calls.boundary++
                if(($fault -eq 'root-before-set' -and $calls.boundary -eq 1) -or
                   ($fault -eq 'root-before-invoke' -and $calls.boundary -eq 2)){throw 'fixture root changed'}
                if($fault -eq 'deadline-before-set'){$operationClock.ElapsedMilliseconds=30000}
            }
            function Start-Sleep { param($Milliseconds) $operationClock.ElapsedMilliseconds+=$Milliseconds }
            if($fault -eq 'control-before-set'){$slider.Current.ProcessId=9999}
            $receipt=@{beforeValue=$null;afterValue=$null;setDispatched=$false;invokeDispatched=$false;noChange=$false;stage='admission'}
            $failure=$null
            try { Set-SettingsRangeAndApply $null $null $null $null $null $content $receipt } catch { $failure=$_ }
            $success=$fault -in @('apply','restore','already-original')
            Assert (($null -eq $failure) -eq $success) "Action accepted/rejected wrong case: $fault."
            $set=$fault -notin @('already-original','control-before-set','root-before-set','deadline-before-set')
            $invoked=$fault -in @('apply','restore','invoke-failed')
            Assert ($range.Sets -eq [int]$set -and $receipt.setDispatched -eq $set) "Set dispatch receipt lost: $fault."
            Assert ($invoke.Calls -eq [int]$invoked -and $receipt.invokeDispatched -eq $invoked) "Invoke boundary lost: $fault."
            if($fault -eq 'already-original'){Assert $receipt.noChange 'Unchanged disabled Apply did not return noChange.'}
            if($fault -eq 'partial-set'){Assert ($range.Current.Value -eq 225) 'Fixture did not exercise an effect before throw.'}
            if($fault -eq 'apply-disabled'){Assert ($operationClock.ElapsedMilliseconds -eq 30000) 'Apply wait reset/exceeded phase budget.'}
        } $fault
    }
    'Action witness: real SetValue/Invoke bodies checked with inert references, including partial effect and disabled Apply.'
}
& $actionTests
$actionDefinitions=@('Assert','New-TreeNode','Set-TextScaleCapability','Assert-SettingsActionTarget','Set-SettingsRangeAndApply') |
    ForEach-Object { "function $_ {`n$((Get-Item "Function:$_").Definition)`n}" }
$actionCommand=($actionDefinitions -join "`n")+"`n& {`n$($actionTests.ToString())`n}"
$actionReadback=Invoke-TextScaleChild $frameworkShell @('-NoProfile','-NonInteractive','-STA','-Command',$actionCommand)
Assert ($actionReadback -match '^Action witness:') 'PS5 action body did not execute.'
Write-Output "PS5 $($actionReadback.Trim())"

# Полный production prefix + reader проходят настоящий PS5 transport/compilation.
# Выполнение останавливается до Get-Process/FromHandle; ни discovery, ни mutation нет.
& {
    $realChild=${function:Invoke-TextScaleChild}
    $owned=@{pid=3187;startTicks=638900000000000000L;hwnd=42;threadId=5500;sessionId=1;path='C:\Windows\ImmersiveControlPanel\SystemSettings.exe'}
    $prepared=@{hwnd=43;threadId=5501;ownerHwnd=900;ownerPid=9999;ownerThreadId=9900;
        sliderAutomationId='s'*256;applyAutomationId='a'*256;originalSliderValue=137}
    function Assert-SettingsWindow {throw 'Action required original popup.'}
    function Invoke-TextScaleChild {
        param($Executable,$Arguments,$TimeoutMs)
        Assert ($Arguments[-2] -eq '-Command') 'Reader transport changed.'
        $code=$Arguments[-1]; $end=$code.IndexOf('$process = Get-Process -Id $settingsPid')
        Assert ($end -gt 0 -and $code.Length -lt 31000) 'Reader exceeded Windows command line budget.'
        $compiled=$code.Substring(0,$end)+"`n'{`"action`":{`"stage`":`"compiled`"}}'"
        & $realChild $Executable @('-NoProfile','-NonInteractive','-STA','-Command',$compiled) $TimeoutMs
    }
    $observed=Read-SettingsContent $owned 15000 'Restore' $prepared 137
    Assert ($observed.action.stage -eq 'compiled') 'Full action reader did not compile in PS5.'
}

# Apply/Restore берут сохранённый content напрямую: исходный popup может уже исчезнуть.
$selectionBranch=$readerAst.Find({param($node)
    $node -is [Management.Automation.Language.IfStatementAst] -and
    $node.Extent.Text -match '(?s)^if \(\$operation -eq ''Observe''\).*\$candidate=Select-ContentWindow'
},$true)
Assert ($null -ne $selectionBranch) 'Saved content selection branch missing.'
$savedSelection=[scriptblock]::Create($selectionBranch.Extent.Text.Replace('[LabUISettingsContentNative]::Read(', '(Read-FixtureWindow '))
$boundaryDefinition=($readerAst.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Assert-SettingsActionBoundary'
}).Extent.Text
$fixtureBoundary=[scriptblock]::Create($boundaryDefinition.Replace('[LabUISettingsContentNative]::Read(', '(Read-FixtureWindow '))
foreach($fault in @('popup-gone','foreign-content','changed-thread','foreign-owner','reparented','expired','root-drift')) {
    & {
        param($fault)
        . $fixtureBoundary
        $operation='Restore'; $operationTimeoutMs=60000; $operationClock=[pscustomobject]@{ElapsedMilliseconds=0}
        $settingsPid=3187; $settingsPath='fixture/SystemSettings.exe'; $sessionId=1; $handle=43
        $started=[DateTime]::UtcNow.AddMinutes(-1); $startTicks=$started.Ticks
        $process=[pscustomobject]@{StartTime=$started;Path=$settingsPath;SessionId=1;HasExited=$false}
        $root=New-TreeNode 1; $root.Current.NativeWindowHandle=43
        $expected=@{hwnd=43;threadId=5501;ownerHwnd=900;ownerPid=9999;ownerThreadId=9900}
        $candidate=$null; $owner=$null; $original=$null
        $reads=[Collections.Generic.List[long]]::new()
        function Read-FixtureWindow {param($Handle)
            $reads.Add($Handle)
            if($Handle -eq 42){throw 'Original popup no longer exists.'}
            if($Handle -eq 43){return @{hwnd=43;nativePid=if($fault -eq 'foreign-content'){9}else{3187};
                nativeThreadId=if($fault -eq 'changed-thread'){5502}else{5501};parentHwnd=900;rootHwnd=900}}
            if($Handle -eq 900){return @{hwnd=900;nativePid=if($fault -eq 'foreign-owner'){8}else{9999};nativeThreadId=9900}}
            throw 'Selection reached unknown HWND.'
        }
        function Test-ContentDescendant {param($OwnerHandle,$ContentHandle) return $fault -ne 'reparented'}
        $failure=$null
        try {
            . $savedSelection
            if($fault -eq 'expired'){$operationClock.ElapsedMilliseconds=60000}
            if($fault -eq 'root-drift'){$root.Current.NativeWindowHandle=44}
            Assert-SettingsActionBoundary $process $root $candidate $owner $original
        } catch {$failure=$_}
        Assert (($null -eq $failure) -eq ($fault -eq 'popup-gone')) "Saved content boundary lost: $fault."
        Assert (!$reads.Contains(42) -and @($reads | Where-Object {$_ -notin @(43,900)}).Count -eq 0) 'Action discovered/replaced a root or required old popup.'
    } $fault
}

# Публикуется projection, а не приватные AutomationElement/Pattern references.
$projection=@($readerAst.FindAll({param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -like '$observation*'
},$true) | ForEach-Object {$_.Extent.Text}) -join "`n"
Assert ($projection -notmatch '\$content($|[;\r\n])|\$content\.targets') 'Private UIA references reached JSON projection.'

# Штатный Observe не dispatch-ит действия: исполняется точная ветка production reader.
$actionBranch=$readerAst.Find({param($node)
    $node -is [Management.Automation.Language.IfStatementAst] -and $node.Extent.Text -match '(?s)^if \(\$operation -ne ''Observe''\).*\$observation.action='
},$true)
Assert ($null -ne $actionBranch) 'Operation dispatch branch missing.'
& {
    $operation='Observe'; $observation=@{action=$null}
    function Set-SettingsRangeAndApply { throw 'Observe dispatched mutation.' }
    . ([scriptblock]::Create($actionBranch.Extent.Text))
    Assert ($null -eq $observation.action) 'Observe created action receipt.'
}

# Настоящие qualification/restore и внешний catch/finally, подменены лишь эффекты.
foreach($fault in @('none','apply-throw','apply-error','target-getter','smoke','receipt',
    'restore-throw','restore-error','restore-getter','restore-both','cleanup')) {
    & {
        param($fault)
        $Qualify=$true; $owned=@{hwnd=42}; $ownedProcess=$null; $discoveryBudget=$null; $failure=$null; $stage='qualify-text-scale'
        $output=Join-Path ([IO.Path]::GetTempPath()) "labui-scale-orchestration-$([guid]::NewGuid()).json"
        $result=New-CapabilityFixture; Set-TextScaleCapability $result
        $result.contentRoot=@{hwnd=43;threadId=5501}
        $result.topology=@{original=@{ownerHwnd=900};owner=@{nativePid=9999;nativeThreadId=9900}}
        foreach($field in @('prepared','qualification','restore','restoreError','restoreGetterError','cleanupError','error')){$result[$field]=$null}
        $result.systemTextScaleBefore=@{textScaleFactor=1.3}; $result.changeMayHaveOccurred=$false
        $result.systemTextScaleChanged=$false; $result.fontQualification='not-performed'; $result.cleanup='not-started'
        $context=@{sourceCommit='a'*40;sourceTree='b'*40;smokeStartedAtUnixMs=$null}; $winapp=@{}
        $calls=[Collections.Generic.List[string]]::new()
        function Invoke-TextScaleAction {
            param($Owned,$Expected,$Operation,$TargetValue,$TimeoutMs)
            Assert ($Owned.hwnd -eq 42 -and $Expected.hwnd -eq 43) 'Action replaced saved HWND.'
            Assert ($result.changeMayHaveOccurred -and $result.prepared.originalSliderValue -eq 130 -and
                $result.systemTextScaleBefore.textScaleFactor -eq 1.3) 'Dispatch preceded saved originals/possible-effect flag.'
            $calls.Add($Operation)
            $limit=if($Operation -eq 'Apply'){30000}else{45000}
            Assert ($TimeoutMs -gt 0 -and $TimeoutMs -le $limit) 'Action budget exceeded phase/reserve.'
            Assert ($TargetValue -eq $(if($Operation -eq 'Apply'){225}else{130})) 'Restore guessed original percentage.'
            if(($Operation -eq 'Apply' -and $fault -eq 'apply-throw') -or
               ($Operation -eq 'Restore' -and $fault -in @('restore-throw','restore-both'))){throw "fixture $Operation throw"}
            return @{setDispatched=$true;error=if(($Operation -eq 'Apply' -and $fault -eq 'apply-error') -or
                ($Operation -eq 'Restore' -and $fault -eq 'restore-error')){@{stage='invoke';message="fixture $Operation error"}}else{$null}}
        }
        function Wait-SystemTextScale {
            param($ExpectedFactor,$Budget,$LimitMs)
            $calls.Add("getter-$LimitMs")
            Assert ($null -ne $Budget -and $LimitMs -in @(30000,60000)) 'Getter has no phase budget.'
            if(($LimitMs -eq 30000 -and $fault -eq 'target-getter') -or
               ($LimitMs -eq 60000 -and $fault -in @('restore-getter','restore-both'))){throw 'fixture independent getter'}
            return @{textScaleFactor=$ExpectedFactor}
        }
        function Invoke-QualifiedSmoke { param($Context,$WinApp) $calls.Add('smoke'); if($fault -eq 'smoke'){throw 'fixture smoke'} }
        function Read-TextScaleSmokeReceipt { param($Context,$WinApp) $calls.Add('receipt'); if($fault -eq 'receipt'){throw 'fixture receipt'}; return @{visualReview='pending'} }
        function Close-SettingsWindow { param($Owned) Assert ($Owned.hwnd -eq 42) 'Cleanup changed target.'; $calls.Add('cleanup'); if($fault -eq 'cleanup'){throw 'fixture cleanup'}; return 'closed' }
        try {
            try { Invoke-TextScaleQualification $owned $result $context $winapp } catch { . $catchBlock }
            . $finallyBlock | Out-Null
            $readback=Get-Content -LiteralPath $output -Raw | ConvertFrom-Json
            Assert ($calls[-1] -eq 'cleanup' -and $calls.Contains('Restore') -and $calls.Contains('getter-60000')) "Restore/getter/cleanup order lost: $fault."
            Assert ($calls.IndexOf('Restore') -lt $calls.IndexOf('getter-60000')) 'Independent getter skipped/reordered after restore.'
            Assert (($readback.status -eq 'passed') -eq ($fault -eq 'none')) "False qualification PASS: $fault."
            Assert (($null -ne $readback.restoreError) -eq ($fault -in @('restore-throw','restore-error','restore-both'))) 'Restore error was erased/invented.'
            Assert (($null -ne $readback.restoreGetterError) -eq ($fault -in @('restore-getter','restore-both'))) 'Getter error was erased/invented.'
            Assert (($null -ne $readback.error) -eq ($fault -in @('apply-throw','apply-error','target-getter','smoke','receipt'))) 'Primary error was erased/invented.'
            if($fault -eq 'none'){Assert ($readback.fontQualification -eq 'runtime-capture-awaiting-visual-review') 'Runtime capture became visual acceptance.'}
        } finally { if(Test-Path -LiteralPath $output){Remove-Item -LiteralPath $output} }
    } $fault
}
Write-Output 'Qualification witness: partial apply/smoke/restore/getter failures retain separate errors; original HWND cleanup runs last.'

# Readback расходует общий остаток, включая повторы; исчерпанный бюджет не перезапускается.
& {
    $budget=[pscustomobject]@{ElapsedMilliseconds=1000}; $timeouts=[Collections.Generic.List[int]]::new()
    function Read-SystemTextScale {param($TimeoutMs) $timeouts.Add($TimeoutMs); $budget.ElapsedMilliseconds+=1000; return @{textScaleFactor=if($timeouts.Count -eq 1){1}else{2.25}}}
    function Start-Sleep {param($Milliseconds) $budget.ElapsedMilliseconds+=$Milliseconds}
    $value=Wait-SystemTextScale 2.25 $budget 30000
    Assert ($value.textScaleFactor -eq 2.25 -and $timeouts[0] -eq 29000 -and $timeouts[1] -eq 27900) 'OS readback reset phase budget.'
    $budget.ElapsedMilliseconds=60000; $failure=$null
    try { Wait-SystemTextScale 1 $budget 60000 | Out-Null } catch {$failure=$_}
    Assert ($null -ne $failure -and $timeouts.Count -eq 2) 'Getter launched after restore deadline.'
}

# Receipt связывает нетронутые JSON bytes с одним app/source/PID/start.
foreach($fault in @('none','source','pid','start','cli','app','animation','factor','time','passed')) {
    & {
        param($fault)
        $directory=Join-Path ([IO.Path]::GetTempPath()) "labui-scale-receipt-$([guid]::NewGuid())"
        $null=New-Item -ItemType Directory -Path $directory
        $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $context=@{evidenceDirectory=$directory;sourceCommit='a'*40;sourceTree='b'*40;appSha256='c'*64;smokeStartedAtUnixMs=$now-5000}
        $winapp=@{version='0.7.1';archiveSha256='d'*64}
        $identity=@{source=$context.sourceCommit;pid=3187;startedAtUnixMs=$now-1000;cliVersion=$winapp.version;
            cliZipSha256=$winapp.archiveSha256;appSha256=$context.appSha256;animation=@{expected=$true}}
        $result=@{passed=$true;initialLayout=@{pid=3187;textScaleFactor=2.25;observedAtUnixMs=$now}}
        switch($fault){
            'source'{$identity.source='e'*40}; 'pid'{$result.initialLayout.pid=99}; 'start'{$identity.startedAtUnixMs=$now-6000}
            'cli'{$identity.cliZipSha256='f'*64}; 'app'{$identity.appSha256='f'*64}; 'animation'{$identity.animation.expected=$false}
            'factor'{$result.initialLayout.textScaleFactor=1}; 'time'{$result.initialLayout.observedAtUnixMs=$now-2000}; 'passed'{$result.passed=$false}
        }
        try {
            foreach($name in @('identity','result')){[IO.File]::WriteAllText((Join-Path $directory "$name.json"),((Get-Variable $name -ValueOnly)|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))}
            $before=@(Get-FileHash -LiteralPath (Join-Path $directory 'identity.json'),(Join-Path $directory 'result.json'))
            $failure=$null; $receipt=$null
            try {$receipt=Read-TextScaleSmokeReceipt $context $winapp} catch {$failure=$_}
            Assert (($null -eq $failure) -eq ($fault -eq 'none')) "Smoke receipt identity boundary lost: $fault."
            $after=@(Get-FileHash -LiteralPath (Join-Path $directory 'identity.json'),(Join-Path $directory 'result.json'))
            Assert ($before[0].Hash -ceq $after[0].Hash -and $before[1].Hash -ceq $after[1].Hash) 'Qualifier rewrote smoke JSON.'
            if($fault -eq 'none'){Assert ($receipt.identitySha256 -ceq $before[0].Hash.ToLowerInvariant() -and
                $receipt.resultSha256 -ceq $before[1].Hash.ToLowerInvariant() -and $receipt.visualReview -eq 'pending') 'Receipt hashes/visual boundary lost.'}
        } finally {
            Remove-Item -LiteralPath (Join-Path $directory 'identity.json'),(Join-Path $directory 'result.json') -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $directory
        }
    } $fault
}

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
Assert ($source -notmatch '\bSet-ItemProperty\b|\bStop-Process\b|HKCU:|HKLM:|ui.+set-value') 'Harness получил registry/CLI fallback либо убийство чужого процесса.'

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
