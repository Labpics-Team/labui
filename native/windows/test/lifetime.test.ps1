param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }

$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput(
    [IO.File]::ReadAllText($Harness), [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
$functions = @($ast.EndBlock.Statements | Where-Object {
    $_ -is [Management.Automation.Language.FunctionDefinitionAst]
})
foreach ($name in @('Assert-LifetimeObservation', 'Assert-LifetimeCompletion',
    'Read-LifetimeObservation', 'Invoke-Lifetime', 'Assert-Count', 'Write-SpaceFailure')) {
    $definition = @($functions | Where-Object { $_.Name -eq $name })
    Assert ($definition.Count -eq 1) "Отсутствует исполняемая граница $name."
}
foreach ($definition in $functions | Where-Object { $_.Name -match 'Lifetime' -or $_.Name -in @('Assert-Count', 'Write-SpaceFailure') }) {
    . ([scriptblock]::Create($definition.Extent.Text))
}

$started = [DateTime]::UtcNow.AddMinutes(-1)
$epoch = ([DateTimeOffset]$started).ToUnixTimeMilliseconds()
$processFixture = [pscustomobject]@{ Id = 3187; StartTime = $started; HasExited = $false }
$processFixture | Add-Member ScriptMethod Refresh { }

# Эталон задаёт потребительскую историю; он не строится из проверяемого validator.
function New-Observation {
    $events = @(
        @{ kind = 'armed'; elapsedMs = 10; unixMs = $epoch + 10; data = @{ countBefore = 11; index = 1; hover = 0; pressed = 0 } },
        @{ kind = 'removing'; elapsedMs = 26; unixMs = $epoch + 26; data = @{ isLoaded = $true; isPressed = $true; pressed = 0.4; count = 11;
            positionReadAtMs = 19; removeStartedMs = 20; removeCompletedMs = 24 } },
        @{ kind = 'unloaded'; elapsedMs = 30; unixMs = $epoch + 30; data = @{ eventAtMs = 25; eventAtUnixMs = $epoch + 25 } },
        @{ kind = 'detached'; elapsedMs = 40; unixMs = $epoch + 40; data = @{ isLoaded = $false; containerAbsent = $true; hoverRejected = $true; pressedRejected = $true; count = 11 } },
        @{ kind = 'restoring'; elapsedMs = 50; unixMs = $epoch + 50; data = @{ count = 11 } },
        @{ kind = 'loaded'; elapsedMs = 60; unixMs = $epoch + 60; data = @{ eventAtMs = 55; eventAtUnixMs = $epoch + 55 } },
        @{ kind = 'restored'; elapsedMs = 70; unixMs = $epoch + 70; data = @{ isLoaded = $true; freshHover = $true; freshPressed = $true; containerPresent = $true; freshContainerReference = $true; containerIdentityScope = 'managed-reference'; count = 11 } },
        @{ kind = 'activated'; elapsedMs = 100; unixMs = $epoch + 100; data = @{ restoredClicks = 1; count = 12 } },
        @{ kind = 'completed'; elapsedMs = 240; unixMs = $epoch + 240; data = @{ countBefore = 11; countAfter = 12; lateObservations = 0; oldObservationWindowStartMs = 25; oldObservationWindowEndMs = 235; quietFromMs = 110; quietUntilMs = 230;
            releasedPosition = 0; releaseTolerance = 0.001 } }
    )
    $observations = @(
        @{ elapsedMs = 19; threadId = 1; generation = 'old'; channel = 'pressed'; motion = @{ origin = 'Animation'; phase = 'value'; readbackPosition = 0.3 } },
        @{ elapsedMs = 75; threadId = 1; generation = 'new'; channel = 'pressed'; motion = @{ origin = 'Animation'; phase = 'value'; readbackPosition = 0.5 } },
        @{ elapsedMs = 105; threadId = 1; generation = 'new'; channel = 'pressed'; motion = @{ origin = 'Animation'; phase = 'idle'; readbackPosition = 0 } }
    )
    return @{ schemaVersion = 1; pid = 3187; observedAtUnixMs = $epoch + 300; elapsedMs = 300;
        status = 'passed'; failure = $null; countBefore = 11; countNow = 12; restoredClicks = 1;
        lateObservations = 0; events = $events; observations = $observations } |
        ConvertTo-Json -Depth 10 | ConvertFrom-Json
}

Assert-LifetimeCompletion (New-Observation) $processFixture 11
foreach ($mutation in @(
    { param($v) $v.pid = 3188 },
    { param($v) $v.pid = '3187' },
    { param($v) $v.pid = 3187.25 },
    { param($v) $v.schemaVersion = '1' },
    { param($v) $v.observedAtUnixMs = $epoch - 1 },
    { param($v) $v.observedAtUnixMs = [DateTimeOffset]::UtcNow.AddMinutes(1).ToUnixTimeMilliseconds() },
    { param($v) $v.elapsedMs = [double]::NaN },
    { param($v) $v.status = 'failed'; $v.failure = 'disposed check failed' },
    { param($v) $v.failure = 'prior failure' },
    { param($v) $v.countBefore = '11' },
    { param($v) $v.countNow = 13 },
    { param($v) $v.restoredClicks = 0 },
    { param($v) $v.lateObservations = 1 },
    { param($v) $v.events = @() },
    { param($v) $v.events = $v.events[0] },
    { param($v) $v.events[2].kind = 'loaded' },
    { param($v) $v.events[2].elapsedMs = 1 },
    { param($v) $v.events[2].unixMs = $epoch - 1 },
    { param($v) $v.events[2].data.eventAtMs = 31 },
    { param($v) $v.events[1].data.positionReadAtMs = '19' },
    { param($v) $v.events[1].data.removeCompletedMs = 18 },
    { param($v) $v.events[3].data.hoverRejected = 'true' },
    { param($v) $v.events[3].data.pressedRejected = $false },
    { param($v) $v.events[3].data.isLoaded = $true },
    { param($v) $v.events[4].data.count = 12 },
    { param($v) $v.events[6].data.freshPressed = $false },
    { param($v) $v.events[6].data.containerIdentityScope = 'native-COM' },
    { param($v) $v.events[7].data.restoredClicks = '1' },
    { param($v) $v.events[8].data.countBefore = '11' },
    { param($v) $v.events[8].data.quietUntilMs = 229 },
    { param($v) $v.events[8].data.oldObservationWindowEndMs = 229 },
    { param($v) $v.events[8].data.releasedPosition = 1 },
    { param($v) $v.events[8].data.releasedPosition = '0' },
    { param($v) $v.events[8].data.releaseTolerance = 0.01 },
    { param($v) $v.observations = @() },
    { param($v) $v.observations = $v.observations[0] },
    { param($v) $v.observations[0].motion.readbackPosition = 0 },
    { param($v) $v.observations[0].elapsedMs = 26 },
    { param($v) $v.observations[1].motion.readbackPosition = 1 },
    { param($v) $v.observations[2].motion.phase = 'value' },
    { param($v) $v.observations[2].motion.readbackPosition = 1 }
)) {
    $value = New-Observation
    & $mutation $value
    $failure = $null
    try { Assert-LifetimeCompletion $value $processFixture 11 } catch { $failure = $_ }
    Assert ($null -ne $failure) "Неверное lifetime observation принято: $mutation"
}

# Исполняется настоящий parser/readback; файлы, ожидание и процесс подменены на границе.
foreach ($expectedStatus in @('armed', 'removed', 'restored', 'passed')) {
    foreach ($fault in @('none', 'json', 'failed', 'pid', 'size', 'exited', 'missing', 'missing-field')) {
        & {
            param($fault, $expectedStatus)
            $value = New-Observation
            $value.status = $expectedStatus
            if ($fault -eq 'failed') { $value.status = 'failed'; $value.failure = 'injected failure' }
            if ($fault -eq 'pid') { $value.pid++ }
            if ($fault -eq 'missing-field') { $value.PSObject.Properties.Remove('schemaVersion') }
            $payload = if ($fault -eq 'json') { '{broken' } else { $value | ConvertTo-Json -Depth 10 }
            $process = [pscustomobject]@{ Id = 3187; StartTime = $started; HasExited = $fault -eq 'exited' }
            $process | Add-Member ScriptMethod Refresh { }
            function Test-Path { param($LiteralPath) return $fault -ne 'missing' }
            function Get-Item { param($LiteralPath) return @{ Length = $(if ($fault -eq 'size') { 262145 } else { 4096 }) } }
            function Get-Content { param($LiteralPath, [switch]$Raw) return $payload }
            function Start-Sleep { throw 'Неверное наблюдение не должно превращаться в ожидание.' }
            $script:lifetimeDiagnostic = @{ expectedStatus = 'stale'; observation = @{ status = 'passed' }; observationAdmitted = $true }
            $failure = $null
            try { $result = Read-LifetimeObservation 'fixture.json' $process $expectedStatus } catch { $failure = $_ }
            Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Readback неверно обработал $fault : $failure"
            Assert ($lifetimeDiagnostic.expectedStatus -ceq $expectedStatus -and
                $lifetimeDiagnostic.observationAdmitted -eq ($fault -eq 'none')) 'Lifetime диагностика не сбросила прежний status/admission [lifetime-diagnostic-reset].'
            if ($fault -in @('json', 'size', 'exited', 'missing')) {
                Assert ($null -eq $lifetimeDiagnostic.observation) 'Непрочитанный ответ выдан за наблюдение.'
            } else {
                Assert ($null -ne $lifetimeDiagnostic.observation) 'Диагностика потеряла распарсенное observation [lifetime-diagnostic-snapshot].'
                $raw = $lifetimeDiagnostic.observation | ConvertTo-Json -Depth 10 | ConvertFrom-Json
                $actualFields = @($raw.PSObject.Properties.Name)
                $allowedFields = @('schemaVersion', 'pid', 'observedAtUnixMs', 'elapsedMs', 'status', 'failure', 'events')
                Assert (@($actualFields | Where-Object { $_ -notin $allowedFields }).Count -eq 0) 'В диагностику попали полный motion trace или лишние поля.'
                Assert ($raw.pid -eq $value.pid -and $raw.observedAtUnixMs -eq $value.observedAtUnixMs -and
                    $raw.elapsedMs -eq $value.elapsedMs -and $raw.status -ceq $value.status -and $raw.failure -ceq $value.failure) 'Диагностика изменила отклонённые значения.'
                Assert (($raw.events | ConvertTo-Json -Depth 8 -Compress) -ceq ($value.events | ConvertTo-Json -Depth 8 -Compress)) 'Диагностика потеряла lifetime events.'
                if ($fault -eq 'missing-field') {
                    Assert (!$raw.PSObject.Properties['schemaVersion'] -or $null -eq $raw.schemaVersion) 'Отсутствующая схема получила выдуманный default.'
                } else { Assert ($raw.schemaVersion -eq 1) 'Диагностика потеряла schemaVersion.' }
            }
            if ($fault -eq 'none') { Assert ($result.pid -eq 3187 -and $result.status -ceq $expectedStatus) 'Readback потерял принятое observation.' }
        } $fault $expectedStatus
    }
}

# Допуск промежуточного ответа не переносится на следующий отклонённый ответ.
foreach ($fault in @('failed', 'pid')) {
    & {
        param($fault)
        $intermediate = New-Observation
        $intermediate.status = 'armed'
        $rejected = New-Observation
        if ($fault -eq 'failed') { $rejected.status = 'failed'; $rejected.failure = 'later failure' }
        if ($fault -eq 'pid') { $rejected.pid++ }
        $payloads = @($intermediate, $rejected) | ForEach-Object { $_ | ConvertTo-Json -Depth 10 }
        $state = @{ reads = 0 }
        function Test-Path { param($LiteralPath) return $true }
        function Get-Item { param($LiteralPath) return @{ Length = 4096 } }
        function Get-Content { param($LiteralPath, [switch]$Raw) return $payloads[$state.reads++] }
        function Start-Sleep { if ($state.reads -ne 1) { throw 'Readback продолжил ожидание после отклонённого ответа.' } }
        $failure = $null
        try { $null = Read-LifetimeObservation 'fixture.json' $processFixture 'removed' } catch { $failure = $_ }
        Assert ($null -ne $failure -and $state.reads -eq 2) 'Последовательный readback не дошёл до отклонённого ответа.'
        Assert (!$lifetimeDiagnostic.observationAdmitted -and
            $lifetimeDiagnostic.observation.pid -eq $rejected.pid -and
            $lifetimeDiagnostic.observation.status -ceq $rejected.status -and
            $lifetimeDiagnostic.observation.failure -ceq $rejected.failure) 'Допуск промежуточного ответа присвоен отклонённому наблюдению.'
    } $fault
}

# Исполняются настоящий catch и ограниченный writer; основной сценарий заменён одним отказом.
$mainTry = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })
Assert ($mainTry.Count -eq 1 -and $mainTry[0].CatchClauses.Count -eq 1) 'Не найден единственный основной catch harness.'
$failureBoundary = [scriptblock]::Create('param($Primary) try { throw $Primary } catch ' + $mainTry[0].CatchClauses[0].Body.Extent.Text)
$lifetimeBlock = @($mainTry[0].Body.Statements | Where-Object {
    $_ -is [Management.Automation.Language.IfStatementAst] -and $_.Clauses.Count -eq 1 -and
    $_.Clauses[0].Item1.Extent.Text -ceq '$Lifetime'
})
Assert ($lifetimeBlock.Count -eq 1) 'Не найден основной Lifetime блок.'
$lifetimeBoundary = [scriptblock]::Create($lifetimeBlock[0].Extent.Text)
& {
    $Lifetime = $true
    $lifetimeObservationPath = 'fixture.json'
    $process = $processFixture
    $result = @{}
    $before = @{ expectedStatus = 'removed'; observation = $null; observationAdmitted = $false }
    $lifetimeDiagnostic = $before
    $primary = [InvalidOperationException]::new('injected lifetime invocation failure')
    function Invoke-Lifetime { throw $primary }
    $failure = $null
    try { . $lifetimeBoundary } catch { $failure = $_ }
    Assert ($null -ne $failure -and [object]::ReferenceEquals($failure.Exception, $primary) -and
        [object]::ReferenceEquals($lifetimeDiagnostic, $before)) 'Неуспешный Lifetime потерял исходную ошибку или диагностику.'
}
foreach ($case in @('commands', 'empty', 'oversized', 'space', 'identity-missing', 'identity-malformed')) {
    & {
        param($case)
        $primary = [InvalidOperationException]::new('injected lifetime guard failure')
        $script:lifetimeDiagnostic = [ordered]@{
            expectedStatus = 'removed'; observationAdmitted = $false
            observation = [ordered]@{ schemaVersion = 1; pid = 3187; observedAtUnixMs = $epoch + 40;
                elapsedMs = 40; status = 'failed'; failure = 'detached guard failure';
                events = @(@{ kind = 'removing'; elapsedMs = 26; unixMs = $epoch + 26; data = @{ count = 11 } }) }
        }
        $script:spaceDiagnostic = @{ phase = 'stale-space'; observation = @{ status = 'complete' } }
        if ($case -eq 'space') {
            $Lifetime = $true
            $lifetimeObservationPath = 'fixture.json'
            $process = $processFixture
            $result = @{}
            function Invoke-Lifetime { return New-Observation }
            . $lifetimeBoundary
            Assert ($null -eq $lifetimeDiagnostic) 'Успешный Lifetime сохранил диагностику для следующего этапа [lifetime-diagnostic-release].'
            $script:spaceDiagnostic = @{ phase = 'validation'; captures = @{ Dark = @{ status = 'complete' } } }
        }
        if ($case -eq 'oversized') { $lifetimeDiagnostic.observation.failure = 'я' * (256 * 1024) }
        $commands = [Collections.Generic.List[object]]::new()
        if ($case -ne 'empty') {
            $commands.Add(@{ name = 'prior-command-must-not-appear'; arguments = @('private-prior'); exitCode = 0;
                startedMs = 1; completedMs = 2; timedOut = $false })
            $commands.Add(@{ name = 'lifetime-remove'; arguments = @('private-command-arguments'); exitCode = 12;
                startedMs = 7.25; completedMs = 8.75; timedOut = $true; extra = 'private-extra-field' })
        }
        $output = Join-Path ([IO.Path]::GetTempPath()) ('labui-lifetime-diagnostic-' + [guid]::NewGuid().ToString('N'))
        $null = [IO.Directory]::CreateDirectory($output)
        $failureFile = Join-Path $output 'failure.txt'
        $identityFile = Join-Path $output 'identity.json'
        $identity = @{ pid = 3187; startedAtUnixMs = $epoch; window = '77'; source = 'a' * 40; motionSource = 'b' * 40;
            appSha256 = '1' * 64; consumerSha256 = '2' * 64; uiSha256 = '3' * 64; motionSha256 = '4' * 64 }
        $writer = [IO.StringWriter]::new()
        $previousError = [Console]::Error
        try {
            # В рабочем сценарии identity уже доставлена до ввода и lifetime.
            if ($case -ne 'identity-missing') {
                $identityJson = if ($case -eq 'identity-malformed') { '{broken' } else { $identity | ConvertTo-Json -Compress }
                [IO.File]::WriteAllText($identityFile, $identityJson, [Text.UTF8Encoding]::new($false))
            }
            [Console]::SetError($writer)
            $failure = $null
            try { & $failureBoundary $primary } catch { $failure = $_ }
            Assert ($null -ne $failure -and [object]::ReferenceEquals($failure.Exception, $primary)) 'Диагностика заменила исходное исключение.'
            Assert ([IO.File]::Exists($failureFile) -and [IO.File]::ReadAllText($failureFile).Contains($primary.Message)) 'failure.txt потерял исходную ошибку.'
            $stderr = $writer.ToString()
            Assert ([Text.Encoding]::UTF8.GetByteCount($stderr) -le 256 * 1024) 'Lifetime диагностика превысила общий лимит.'
            if ($case -in @('oversized', 'identity-missing', 'identity-malformed')) {
                Assert ($stderr.StartsWith('LABUI_SPACE_DIAGNOSTIC_ERROR ') -and
                    !$stderr.Contains('LABUI_SPACE_FAILURE_JSON ') -and $primary.Data.Contains('spaceDiagnosticError')) 'Неполная диагностика не сохранила ограниченный вторичный отказ.'
                if ($case -eq 'oversized') {
                    Assert ($primary.Data['spaceDiagnosticError'].Contains('Диагностика Space превысила общий лимит 256 KiB.')) 'Oversized случай отказал до проверки общего размера.'
                } elseif ($case -eq 'identity-missing') {
                    Assert ($primary.Data['spaceDiagnosticError'].Contains($identityFile)) 'Ошибка не связана с отсутствующей identity.'
                } else {
                    Assert ($primary.Data['spaceDiagnosticError'] -match 'JSON') 'Ошибка не связана с повреждённой identity.'
                }
            } else {
                Assert ($stderr.StartsWith('LABUI_SPACE_FAILURE_JSON ')) 'Основной catch не вывел диагностический JSON.'
                $diagnostic = $stderr.Substring('LABUI_SPACE_FAILURE_JSON '.Length) | ConvertFrom-Json
                foreach ($name in $identity.Keys) { Assert ($diagnostic.identity.$name -ceq $identity[$name]) "Отказ потерял executing identity: $name." }
                if ($case -eq 'space') {
                    Assert ($diagnostic.phase -ceq 'validation' -and $diagnostic.captures.Dark.status -ceq 'complete') 'Диагностика Space потеряна после успешного lifetime.'
                } else {
                    Assert ($diagnostic.phase -ceq 'lifetime' -and
                        $diagnostic.lifetime.expectedStatus -ceq 'removed' -and !$diagnostic.lifetime.observationAdmitted) 'Основной catch вывел устаревший Space вместо lifetime.'
                    Assert (($diagnostic.lifetime | ConvertTo-Json -Depth 10 -Compress) -ceq
                        ($lifetimeDiagnostic | ConvertTo-Json -Depth 10 -Compress)) 'Основной catch изменил lifetime snapshot.'
                    Assert (!$stderr.Contains('private-') -and !$stderr.Contains('prior-command-must-not-appear')) 'Диагностика раскрыла аргументы или историю команд.'
                    if ($case -eq 'empty') { Assert ($null -eq $diagnostic.lastCommand) 'Пустой журнал получил выдуманную команду.' }
                    else {
                        Assert ((@($diagnostic.lastCommand.PSObject.Properties.Name | Sort-Object) -join ',') -ceq
                            'completedMs,exitCode,name,startedMs,timedOut') 'Последняя команда содержит лишние либо недостающие поля.'
                        Assert ($diagnostic.lastCommand.name -ceq 'lifetime-remove' -and $diagnostic.lastCommand.exitCode -eq 12 -and
                            $diagnostic.lastCommand.startedMs -eq 7.25 -and $diagnostic.lastCommand.completedMs -eq 8.75 -and
                            $diagnostic.lastCommand.timedOut -eq $true) 'Последняя команда потеряла исходные значения.'
                    }
                }
            }
        } finally {
            [Console]::SetError($previousError)
            $writer.Dispose()
            if ([IO.File]::Exists($failureFile)) { [IO.File]::Delete($failureFile) }
            if ([IO.File]::Exists($identityFile)) { [IO.File]::Delete($identityFile) }
            [IO.Directory]::Delete($output)
        }
    } $case
}

# Ui синхронен, как Finish-Tool: restore после возврата drag, а не после его старта.
foreach ($fault in @('none', 'drag', 'passed-pid', 'count')) {
    & {
        param($fault)
        $state = @{ trace = [Collections.Generic.List[string]]::new(); released = $false; count = 11 }
        function Ui([string]$Name, [string[]]$Arguments) {
            switch ($Name) {
                'lifetime-arm' { Assert (($Arguments -join '|') -eq 'invoke|LabLifetimeArm') 'Неверная команда arm.'; $state.trace.Add('arm') }
                'lifetime-remove' {
                    Assert (($Arguments -join '|') -eq 'drag|LabButtonMedium|LabButtonMedium|--hold-ms|1000') 'Удаление должно пересечь настоящее удержание.'
                    $state.trace.Add('drag-start')
                    if ($fault -eq 'drag') { throw 'injected drag failure' }
                    $state.released = $true
                    $state.trace.Add('drag-return')
                }
                'lifetime-restore' { Assert (($Arguments -join '|') -eq 'invoke|LabLifetimeRestore') 'Неверная команда restore.'; Assert $state.released 'Restore начался до возвращения input-команды.'; $state.trace.Add('restore') }
                'lifetime-activate' { Assert (($Arguments -join '|') -eq 'drag|LabButtonMedium|LabButtonMedium|--hold-ms|1000') 'Повторная активация должна удержать и отпустить кнопку.'; $state.count++; $state.trace.Add('reactivate') }
                'lifetime-complete' { Assert (($Arguments -join '|') -eq 'invoke|LabLifetimeComplete') 'Неверная команда complete.'; $state.trace.Add('complete') }
                default {
                    if ($Arguments[0] -eq 'wait-for') { return }
                    if ($Arguments[0] -eq 'get-property') {
                        $state.trace.Add("count:$($state.count)")
                        return @{ properties = @{ Name = "Действие выполнено: $($state.count)" } }
                    }
                    throw "Неожиданный UI-вызов $Name."
                }
            }
        }
        function Read-LifetimeObservation([string]$Path, $Process, [string]$ExpectedStatus) {
            $state.trace.Add("read:$ExpectedStatus")
            $value = New-Observation
            $value.status = $ExpectedStatus
            if ($ExpectedStatus -eq 'passed') {
                if ($fault -eq 'passed-pid') { $value.pid++ }
                if ($fault -eq 'count') { $state.count++ }
            }
            return $value
        }
        $failure = $null
        try { $result = Invoke-Lifetime 'fixture.json' $processFixture 11 } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Lifecycle sequence неверно обработал $fault : $failure"
        if ($fault -eq 'none') {
            Assert (($state.trace -join ',') -eq 'arm,read:armed,drag-start,drag-return,read:removed,count:11,restore,read:restored,reactivate,complete,read:passed,count:12') 'Сценарий изменил обязательный порядок и readback.'
            Assert ($result.status -ceq 'passed') 'Сценарий не вернул проверенный результат.'
        }
        if ($fault -eq 'drag') { Assert (!$state.trace.Contains('restore')) 'Отказ ввода не остановил возврат кнопки.' }
    } $fault
}

$bind = [scriptblock]::Create($ast.ParamBlock.Extent.Text + "`nreturn [bool]`$Lifetime")
$arguments = @{ ApplicationDirectory = 'fixture'; OutputDirectory = 'fixture-output'; AnimationSettingsPath = 'fixture.cs' }
Assert (!(& $bind @arguments)) 'Lifetime включён по умолчанию.'
Assert (& $bind @arguments -Lifetime) 'Явный Lifetime switch потерян.'
foreach ($case in @(
    @{ enabled = $true; lifetime = $false; admitted = $true },
    @{ enabled = $false; lifetime = $false; admitted = $true },
    @{ enabled = $true; lifetime = $true; admitted = $true },
    @{ enabled = $false; lifetime = $true; admitted = $false }
)) {
    & {
        param($case)
        $before = @{ actions = $env:GITHUB_ACTIONS; runner = $env:RUNNER_ENVIRONMENT }
        $effects = [Collections.Generic.List[string]]::new()
        function New-Item { param($ItemType, $Path) $effects.Add('create-output'); throw 'injected first effect' }
        try {
            $env:GITHUB_ACTIONS = 'true'
            $env:RUNNER_ENVIRONMENT = 'github-hosted'
            $failure = $null
            try {
                & $Harness -ApplicationDirectory 'fixture' -AnimationSettingsPath 'fixture.cs' `
                    -OutputDirectory (Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())) `
                    -AnimationsEnabled $case.enabled -Lifetime:$case.lifetime
            } catch { $failure = $_ }
            Assert ($null -ne $failure) 'Guard fixture выполнил harness.'
            Assert (($effects.Count -gt 0) -eq $case.admitted) 'Lifetime/reduced guard неверно допускает первый эффект.'
        } finally { $env:GITHUB_ACTIONS = $before.actions; $env:RUNNER_ENVIRONMENT = $before.runner }
    } $case
}

'lifetime contract: PASS (raw identity, negative readback, bounded failure diagnostics, input/restore order, default/reduced guard)'
