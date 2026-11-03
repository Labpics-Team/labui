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
    'Read-LifetimeObservation', 'Invoke-Lifetime', 'Assert-Count')) {
    $definition = @($functions | Where-Object { $_.Name -eq $name })
    Assert ($definition.Count -eq 1) "Отсутствует исполняемая граница $name."
}
foreach ($definition in $functions | Where-Object { $_.Name -match 'Lifetime' -or $_.Name -eq 'Assert-Count' }) {
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
foreach ($fault in @('none', 'json', 'failed', 'pid', 'size', 'exited')) {
    & {
        param($fault)
        $value = New-Observation
        if ($fault -eq 'failed') { $value.status = 'failed'; $value.failure = 'injected failure' }
        if ($fault -eq 'pid') { $value.pid++ }
        $payload = if ($fault -eq 'json') { '{broken' } else { $value | ConvertTo-Json -Depth 10 }
        $process = [pscustomobject]@{ Id = 3187; StartTime = $started; HasExited = $fault -eq 'exited' }
        $process | Add-Member ScriptMethod Refresh { }
        function Test-Path { param($LiteralPath) return $true }
        function Get-Item { param($LiteralPath) return @{ Length = $(if ($fault -eq 'size') { 262145 } else { 4096 }) } }
        function Get-Content { param($LiteralPath, [switch]$Raw) return $payload }
        function Start-Sleep { throw 'Неверное наблюдение не должно превращаться в ожидание.' }
        $failure = $null
        try { $result = Read-LifetimeObservation 'fixture.json' $process 'passed' } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -ne 'none')) "Readback неверно обработал $fault : $failure"
        if ($fault -eq 'none') { Assert ($result.pid -eq 3187 -and $result.status -ceq 'passed') 'Readback потерял observation.' }
    } $fault
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

'lifetime contract: PASS (raw identity, negative readback, input/restore order, default/reduced guard)'
