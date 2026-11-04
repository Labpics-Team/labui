param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -Path "$PSScriptRoot/../../../examples/windows/SpaceProtocol.cs"
function Assert([bool]$Value, [string]$Message) { if (!$Value) { throw $Message } }
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput([IO.File]::ReadAllText($Harness), [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
$outer = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] })
Assert ($outer.Count -eq 1) 'Нет однозначного основного блока harness.'
$launcher = [Collections.Generic.List[string]]::new()
$collect = $false; $foundStart = $false
foreach ($statement in $outer[0].Body.Statements) {
    if ($statement -is [Management.Automation.Language.AssignmentStatementAst]) {
        if ($statement.Left.Extent.Text -ceq '$appStart') { $collect = $true }
        if ($collect -and $statement.Left.Extent.Text -ceq '$process') { $foundStart = $true; break }
    }
    if ($collect) { $launcher.Add($statement.Extent.Text) }
}
Assert ($launcher.Count -gt 0 -and $foundStart) 'Нет законченного initializer перед запуском приложения.'
# Создаётся настоящий ProcessStartInfo; Process.Start и последующее ожидание окна не исполняются.
& {
    $ApplicationDirectory = Join-Path ([IO.Path]::GetTempPath()) 'labui-launcher-fixture'
    $app = Join-Path $ApplicationDirectory 'Buttons.exe'
    . ([scriptblock]::Create(($launcher -join "`n")))
    Assert ($appStart -is [Diagnostics.ProcessStartInfo]) 'Initializer не создал ProcessStartInfo.'
    Assert ($appStart.FileName -ceq $app -and $appStart.WorkingDirectory -ceq $ApplicationDirectory) 'Launcher изменил целевой процесс или рабочий каталог.'
    Assert ($appStart.WindowStyle -eq [Diagnostics.ProcessWindowStyle]::Normal) 'Launcher скрывает целевое окно, необходимое для capture/input.'
    Assert (!$appStart.UseShellExecute -and $appStart.CreateNoWindow) 'Launcher изменил прямой запуск без консольного окна.'
    Assert ($appStart.RedirectStandardInput -and $appStart.RedirectStandardOutput -and $appStart.RedirectStandardError) 'Launcher потерял stdio-канал.'
    'Space launcher: PASS (actual ProcessStartInfo, normal window, redirected stdio; process not started)'
}
$command = $ast.Find({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-SpaceCommand'
}, $false)
Assert ($null -ne $command) 'Нет настоящего обработчика ответа Space.'
. ([scriptblock]::Create($command.Extent.Text))
foreach ($fault in @('none', 'reply-id', 'string-id', 'wrong-pid', 'string-pid', 'false', 'string-bool', 'missing', 'partial', 'timeout')) {
    & {
        param($fault)
        $reply = @{ id = 1; ok = $true; value = @{ pid = 3187; status = 'armed' } }
        switch ($fault) {
            'reply-id' { $reply.id = 2 }
            'string-id' { $reply.id = '1' }
            'wrong-pid' { $reply.value.pid = 11 }
            'string-pid' { $reply.value.pid = '3187' }
            'false' { $reply.ok = $false }
            'string-bool' { $reply.ok = 'true' }
        }
        $line = ($reply | ConvertTo-Json -Depth 5 -Compress) + "`n"
        if ($fault -eq 'missing') { $line = '' }
        if ($fault -eq 'partial') { $line = $line.TrimEnd() }
        $process = [pscustomobject]@{ Id = 3187; StandardInput = [IO.StringWriter]::new(); StandardOutput = [IO.StringReader]::new($line) }
        $spaceChannel = @{ id = 0; stdoutReader = $process.StandardOutput; cancellation = [Threading.CancellationTokenSource]::new() }
        $spaceChannel.read = [LabUI.Buttons.SpaceProtocol]::ReadLineAsync($spaceChannel.stdoutReader, 128 * 1024, $spaceChannel.cancellation.Token)
        if ($fault -eq 'timeout') { $spaceChannel.read = [Threading.Tasks.TaskCompletionSource[string]]::new().Task }
        $failed = $false
        try { $value = Invoke-SpaceCommand 'arm Light' 20 } catch { $failed = $true }
        Assert ($failed -eq ($fault -ne 'none')) "Неверное принятие ответа Space: $fault."
        Assert ($process.StandardInput.ToString().TrimEnd() -ceq 'arm Light') 'Команда изменена.'
        if ($fault -eq 'none') { Assert ($value.status -ceq 'armed' -and $spaceChannel.id -eq 1) 'Полезный ответ потерян.' }
        $process.StandardInput.Dispose(); $process.StandardOutput.Dispose(); $spaceChannel.cancellation.Dispose()
    } $fault
}
'Space harness: PASS (actual bounded reader, request identity, PID, typed reply, EOF and timeout)'

# Метки каждого poll сохраняются и при отказе; pending read не выдаётся за полученный ответ.
foreach ($fault in @('none', 'rejected', 'timeout')) {
    & {
        param($fault)
        $reply = @{ id = 1; ok = $true; value = @{ pid = 3187; status = 'waiting'; elapsedMs = 12.5;
            observationCount = 3; operation = 9; nativeRequestId = 11; position = 0.25; origin = 'Animation'; reason = $null }; transport = @{
            clockFrequency = [Diagnostics.Stopwatch]::Frequency; readStartedTicks = '1001';
            commandReadTicks = '1002'; dispatchCompletedTicks = '1003' } }
        if ($fault -ceq 'rejected') { $reply = @{ id = 1; ok = $false; error = 'fixture rejection' } }
        $line = ($reply | ConvertTo-Json -Depth 5 -Compress) + "`n"
        $process = [pscustomobject]@{ Id = 3187; StandardInput = [IO.StringWriter]::new(); StandardOutput = [IO.StringReader]::new($line) }
        $spaceChannel = @{ id = 0; stdoutReader = $process.StandardOutput; cancellation = [Threading.CancellationTokenSource]::new() }
        $spaceChannel.read = [LabUI.Buttons.SpaceProtocol]::ReadLineAsync($spaceChannel.stdoutReader, 128 * 1024, $spaceChannel.cancellation.Token)
        if ($fault -ceq 'timeout') { $spaceChannel.read = [Threading.Tasks.TaskCompletionSource[string]]::new().Task }
        $spaceDiagnostic = @{ polls = [Collections.Generic.List[object]]::new() }
        $failure = $null
        try { $value = Invoke-SpaceCommand 'ready 1' 20 } catch { $failure = $_ }
        Assert (($null -ne $failure) -eq ($fault -cne 'none')) "Диагностика изменила исход poll: $fault."
        Assert ($spaceDiagnostic.polls.Count -eq 1) 'Poll не сохранён однозначно.'
        $poll = $spaceDiagnostic.polls[0]
        Assert ($poll.id -eq 1 -and $poll.command -ceq 'ready 1' -and
            [long]$poll.commandStartedTicks -le [long]$poll.commandWrittenTicks) 'Неверная identity или время отправки poll.'
        if ($fault -ceq 'timeout') {
            Assert ($null -eq $poll.responseReadTicks -and $null -eq $poll.responseParsedTicks -and $null -eq $poll.transport) 'Timeout создал выдуманный ответ.'
        } else {
            Assert ([long]$poll.commandWrittenTicks -le [long]$poll.responseReadTicks -and
                [long]$poll.responseReadTicks -le [long]$poll.nextReaderStartedTicks -and
                [long]$poll.nextReaderStartedTicks -le [long]$poll.responseParsedTicks) 'Этапы чтения poll поменялись местами.'
        }
        if ($fault -ceq 'none') {
            Assert ($value.status -ceq 'waiting' -and $poll.status -ceq 'waiting' -and
                $poll.transport.dispatchCompletedTicks -ceq '1003' -and $poll.operation -eq 9 -and
                $poll.nativeRequestId -eq 11 -and $poll.observationCount -eq 3 -and $poll.position -eq 0.25 -and
                $poll.origin -ceq 'Animation' -and $null -eq $poll.reason) 'Диагностика потеряла этап приложения или request.'
        }
        if ($fault -ceq 'rejected') { Assert ($failure.Exception.Message -like '*Space отклонил ready 1*') 'Диагностика скрыла primary error.' }
        $process.StandardInput.Dispose(); $process.StandardOutput.Dispose(); $spaceChannel.cancellation.Dispose()
    } $fault
}
'Space poll timing: PASS (actual observer, stage order, rejected reply and pending timeout)'

$readyFunction = $ast.Find({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-SpaceReady'
}, $false)
Assert ($null -ne $readyFunction) 'Нет настоящего ожидания готовности Space.'
. ([scriptblock]::Create($readyFunction.Extent.Text))
# Меняется только ответ дочернего канала. Polling, остаток срока и проверки identity исполняются из harness.
$script:readyCalls = [Collections.Generic.List[object]]::new()
$script:replyTheme = 'Light'
function Invoke-SpaceCommand([string]$Command, [int]$Timeout = 5000) {
    if ($Command.StartsWith('arm ')) {
        return @{ status = 'armed'; pid = 3187; theme = $script:replyTheme; automationId = 'LabButtonMedium';
            focused = $true; channel = $(if ($script:replyTheme -eq 'Light') { 1 } else { 2 });
            clockOriginTicks = '9007199254740993'; clockFrequency = 10000000 }
    }
    if ($Command -ceq 'complete') { return @{ status = 'complete'; pid = 3187 } }
    $script:readyCalls.Add(@{ command = $Command; timeout = $Timeout })
    $step = [int]$Command.Substring(6)
    $reply = [pscustomobject]@{ schemaVersion = 1; status = 'ready'; pid = 3187;
        processStartedAtUnixMs = 1700000000000L; theme = $script:replyTheme;
        channel = $(if ($script:replyTheme -eq 'Light') { 1 } else { 2 }); step = $step;
        automationId = 'LabButtonMedium'; animationsEnabled = $AnimationsEnabled;
        clockOriginTicks = '9007199254740993'; clockFrequency = 10000000;
        operation = $(if ($AnimationsEnabled) { 10 + $step } else { 0 }); nativeRequestId = 20 + $step;
        origin = $(if ($AnimationsEnabled) { 'Animation' } else { 'Snap' }); reason = $null }
    switch ($script:readyFault) {
        'waiting' { if ($script:readyCalls.Count -eq 1) { $reply.status = 'waiting'; $reply.operation = $null; $reply.nativeRequestId = $null; $reply.origin = $null } }
        'pid' { $reply.pid = 12 }
        'pid-type' { $reply.pid = '3187' }
        'process-generation' { $reply.processStartedAtUnixMs++ }
        'process-generation-type' { $reply.processStartedAtUnixMs = '1700000000000' }
        'theme' { $reply.theme = 'Dark' }
        'channel' { $reply.channel = 2 }
        'channel-type' { $reply.channel = '1' }
        'channel-fraction' { $reply.channel = 1.5 }
        'channel-float' { $reply.channel = [double]1 }
        'channel-bool' { $reply.channel = $true }
        'channel-null' { $reply.channel = $null }
        'step' { $reply.step = 2 }
        'step-type' { $reply.step = '1' }
        'step-fraction' { $reply.step = 1.5 }
        'step-float' { $reply.step = [double]1 }
        'step-bool' { $reply.step = $true }
        'step-null' { $reply.step = $null }
        'schema' { $reply.schemaVersion = 2 }
        'schema-type' { $reply.schemaVersion = '1' }
        'schema-fraction' { $reply.schemaVersion = 1.5 }
        'schema-float' { $reply.schemaVersion = [double]1 }
        'schema-bool' { $reply.schemaVersion = $true }
        'schema-null' { $reply.schemaVersion = $null }
        'target' { $reply.automationId = 'LabButtonSmall' }
        'mode' { $reply.animationsEnabled = !$AnimationsEnabled }
        'clock-origin' { $reply.clockOriginTicks = '9007199254740994' }
        'clock-frequency' { $reply.clockFrequency = 1000 }
        'request-type' { $reply.nativeRequestId = '21' }
        'request-zero' { $reply.nativeRequestId = 0 }
        'operation-type' { $reply.operation = '11' }
        'operation-zero' { $reply.operation = 0 }
        'origin' { $reply.origin = 'Initial' }
        'status' { $reply.status = 'other' }
        'failed' { $reply.status = 'failed'; $reply.reason = 'channel-lost' }
        'prior-request' { if ($step -eq 2) { $reply.nativeRequestId = 21 } }
        'prior-operation' { if ($step -eq 2) { $reply.operation = 11 } }
        'late' { [Threading.Thread]::Sleep(50) }
    }
    # Граница JSON сохраняет те же типы чисел, что и настоящий ответ stdio.
    return ($reply | ConvertTo-Json -Depth 5 -Compress | ConvertFrom-Json)
}
foreach ($fault in @('none', 'waiting', 'pid', 'pid-type', 'process-generation', 'process-generation-type',
    'theme', 'channel', 'channel-type', 'channel-fraction', 'channel-float', 'channel-bool', 'channel-null',
    'step', 'step-type', 'step-fraction', 'step-float', 'step-bool', 'step-null',
    'schema', 'schema-type', 'schema-fraction', 'schema-float', 'schema-bool', 'schema-null',
    'target', 'mode', 'clock-origin', 'clock-frequency',
    'request-type', 'request-zero', 'operation-type', 'operation-zero', 'origin', 'status', 'failed',
    'prior-request', 'prior-operation', 'late')) {
    & {
        param($fault)
        $script:readyFault = $fault; $script:readyCalls.Clear()
        $process = [pscustomobject]@{ Id = 3187 }
        $started = [DateTimeOffset]::FromUnixTimeMilliseconds(1700000000000).UtcDateTime
        $AnimationsEnabled = $true
        $armed = @{ channel = 1; clockOriginTicks = '9007199254740993'; clockFrequency = 10000000 }
        $state = @{ nextStep = 1; previous = $null }
        $spaceDiagnostic = @{ readiness = @{} }
        $budget = if ($fault -eq 'late') { 30 } else { 1000 }
        $failure = $null; $output = @()
        try {
            $output += @(Wait-SpaceReady 1 $budget 'Light' $armed $state)
            if ($fault -in @('none', 'waiting', 'prior-request', 'prior-operation')) {
                $output += @(Wait-SpaceReady 2 800 'Light' $armed $state)
            }
        } catch { $failure = $_ }
        $healthy = $fault -in @('none', 'waiting')
        Assert (($null -eq $failure) -eq $healthy) "Неверное принятие ready: $fault."
        Assert ($output.Count -eq 0) 'Ready загрязняет success pipeline.'
        Assert ($spaceDiagnostic.readiness.Count -ge 1 -and $spaceDiagnostic.readiness.Count -le 2) 'Последний ready-reply потерян или накоплен без предела.'
        $null = $spaceDiagnostic | ConvertTo-Json -Depth 12 -Compress -WarningAction Stop -ErrorAction Stop
        if ($healthy) {
            Assert ($state.nextStep -eq 3 -and $state.previous.nativeRequestId -eq 22) 'Оба readiness шага не завершились.'
        }
        if ($fault -eq 'waiting') {
            Assert ($script:readyCalls.Count -eq 3 -and $script:readyCalls[0].command -ceq 'ready 1' -and
                $script:readyCalls[1].command -ceq 'ready 1' -and $script:readyCalls[2].command -ceq 'ready 2') 'Polling изменил число точек ожидания.'
            Assert ($script:readyCalls[1].timeout -gt 0 -and $script:readyCalls[1].timeout -lt $script:readyCalls[0].timeout -and
                $script:readyCalls[0].timeout -le 1000 -and $script:readyCalls[2].timeout -le 800) 'Очередной poll сбросил остаток срока.'
        }
        if ($fault -eq 'late') { Assert ($failure.Exception.Message.Contains('остатка бюджета')) 'Поздний ready принят после истечения срока.' }
        if ($fault -eq 'failed') { Assert ($spaceDiagnostic.readiness['1'].reason -ceq 'channel-lost') 'Причина отказа readiness потеряна.' }
    } $fault
}
& {
    $script:readyFault = 'none'; $script:readyCalls.Clear()
    $process = [pscustomobject]@{ Id = 3187 }
    $started = [DateTimeOffset]::FromUnixTimeMilliseconds(1700000000000).UtcDateTime
    $AnimationsEnabled = $false
    $armed = @{ channel = 1; clockOriginTicks = '9007199254740993'; clockFrequency = 10000000 }
    $state = @{ nextStep = 1; previous = $null }; $spaceDiagnostic = @{ readiness = @{} }
    Wait-SpaceReady 1 1000 'Light' $armed $state
    Wait-SpaceReady 2 900 'Light' $armed $state
    Assert ($state.previous.operation -eq 0 -and $state.previous.origin -ceq 'Snap') 'Reduced motion ошибочно требует анимацию.'
    $repeated = $false
    try { Wait-SpaceReady 2 800 'Light' $armed $state } catch { $repeated = $true }
    Assert ($repeated -and $script:readyCalls.Count -eq 2) 'Повтор шага отправил новую команду.'
}
'Space ready polling: PASS (bounded polling, process/channel/step/request identity, reduced motion, late reply)'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
public static class SpaceInput {
    public static readonly object Receipt = new();
    public static readonly List<int> Steps = new();
    public static object Run(int processId, long window, Action<int, int> ready) {
        Steps.Clear();
        try {
            Steps.Add(1); ready(1, 950);
            Steps.Add(2); ready(2, 800);
            return Receipt;
        } catch (Exception error) {
            error.Data["spaceInputReceipt"] = Receipt;
            throw;
        }
    }
}
'@
$gestureFunction = $ast.Find({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-SpaceGesture'
}, $false)
. ([scriptblock]::Create($gestureFunction.Extent.Text))
# Подменена только граница отправителя. Настоящий delegate проходит оба шага и переносит отказ вместе с receipt.
foreach ($theme in @('Light', 'Dark')) {
    foreach ($fault in @('none', 'failed')) {
        & {
            param($theme, $fault)
            $script:replyTheme = $theme; $script:readyFault = $fault; $script:readyCalls.Clear()
            $process = [pscustomobject]@{ Id = 3187 }; $window = '100'
            $started = [DateTimeOffset]::FromUnixTimeMilliseconds(1700000000000).UtcDateTime
            $AnimationsEnabled = $true
            $clock = [Diagnostics.Stopwatch]::StartNew(); $clockOriginTicks = '100'; $clockOriginUpperTicks = '101'
            $failure = $null; $output = @()
            try { $output = @(Invoke-SpaceGesture $theme) } catch { $failure = $_ }
            Assert ([object]::ReferenceEquals($spaceDiagnostic.injection, [SpaceInput]::Receipt)) 'Delegate потерял частичный либо завершённый receipt.'
            Assert ($spaceDiagnostic.window.inputCompletedMs -ge $spaceDiagnostic.window.inputStartedMs) 'Окно ввода не закрыто после callback.'
            $diagnosticJson = $spaceDiagnostic | ConvertTo-Json -Depth 12 -Compress -WarningAction Stop -ErrorAction Stop
            Assert ($diagnosticJson.Contains('readiness')) 'Диагностика не сериализовала ready-ответы.'
            if ($fault -eq 'none') {
                Assert ($null -eq $failure -and $output.Count -eq 1 -and $output[0].observation.status -ceq 'complete') 'Два ready нарушили полезный gesture.'
                Assert (([SpaceInput]::Steps -join ',') -ceq '1,2' -and $spaceDiagnostic.readiness.Count -eq 2) 'Gesture потерял одну из двух точек ожидания.'
                Assert ($script:readyCalls[0].timeout -le 950 -and $script:readyCalls[1].timeout -le 800) 'Delegate не передал оставшийся sender-бюджет.'
                Assert ($spaceDiagnostic.readiness['2'].theme -ceq $theme -and
                    $spaceDiagnostic.readiness['2'].channel -eq $(if ($theme -eq 'Light') { 1 } else { 2 })) 'Следующая тема использовала предыдущую identity.'
            } else {
                Assert ($null -ne $failure -and $failure.Exception.Message.Contains('channel-lost') -and $output.Count -eq 0) 'Callback заменил исходную ошибку или принял failed.'
                Assert (([SpaceInput]::Steps -join ',') -ceq '1' -and $spaceDiagnostic.readiness['1'].reason -ceq 'channel-lost') 'После отказа callback продолжился либо потерял диагностический ответ.'
            }
        } $theme $fault
    }
}
'Space ready delegate: PASS (two steps, both themes, remaining budget, partial receipt, preserved failure)'
