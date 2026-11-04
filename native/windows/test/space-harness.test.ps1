param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -Path "$PSScriptRoot/../../../examples/windows/SpaceProtocol.cs"
function Assert([bool]$Value, [string]$Message) { if (!$Value) { throw $Message } }
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput([IO.File]::ReadAllText($Harness), [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
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
        $spaceChannel = @{ id = 0; read = [LabUI.Buttons.SpaceProtocol]::ReadLineAsync($process.StandardOutput, 128 * 1024) }
        if ($fault -eq 'timeout') { $spaceChannel.read = [Threading.Tasks.TaskCompletionSource[string]]::new().Task }
        $failed = $false
        try { $value = Invoke-SpaceCommand 'arm Light' 20 } catch { $failed = $true }
        Assert ($failed -eq ($fault -ne 'none')) "Неверное принятие ответа Space: $fault."
        Assert ($process.StandardInput.ToString().TrimEnd() -ceq 'arm Light') 'Команда изменена.'
        if ($fault -eq 'none') { Assert ($value.status -ceq 'armed' -and $spaceChannel.id -eq 1) 'Полезный ответ потерян.' }
        $process.StandardInput.Dispose(); $process.StandardOutput.Dispose()
    } $fault
}
'Space harness: PASS (actual bounded reader, request identity, PID, typed reply, EOF and timeout)'
