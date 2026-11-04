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
