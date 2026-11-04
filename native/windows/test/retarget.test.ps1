param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}

$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput(
    [IO.File]::ReadAllText($Harness), [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
$capture = $ast.Find({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Capture-Interaction'
}, $false)
$count = $ast.Find({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-Count'
}, $false)
Assert ($null -ne $capture -and $null -ne $count) 'Не найден настоящий capture или readback счётчика.'
$steps = $capture.Find({ param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$steps'
}, $true)
$loop = $capture.Find({ param($node)
    $node -is [Management.Automation.Language.ForEachStatementAst] -and $node.Variable.VariablePath.UserPath -eq 'step'
}, $true)
Assert ($null -ne $steps -and $null -ne $loop) 'Не найден исполняемый сценарий записи.'
$scenario = [scriptblock]::Create($steps.Extent.Text + "`n" + $loop.Extent.Text)
. ([scriptblock]::Create($count.Extent.Text))

# Исполняется настоящий цикл и Assert-Count. UI, ввод и запись файлов заменены.
foreach ($fault in @('none', 'cancel-drag', 'pointer-out', 'space-failure')) {
    & {
        param($fault)
        $Count = 3
        $Theme = 'Light'
        $space = $null
        $name = 'interaction-Test'
        $output = [IO.Path]::GetTempPath()
        $gestures = [Collections.Generic.List[object]]::new()
        $captureWindow = @{ gestures = $gestures }
        $clock = [Diagnostics.Stopwatch]::StartNew()
        $recording = @{ startedMs = 0 }
        $inputBudgetMs = 60000
        $script:activationCount = 3
        $script:lastGesture = ''
        $script:observed = [Collections.Generic.List[string]]::new()
        $script:performed = [Collections.Generic.List[string]]::new()

        function Invoke-SpaceGesture([string]$Theme) {
            Assert ($Theme -eq 'Light') 'Space потерял тему.'
            $script:lastGesture = 'rapid-space'
            $script:performed.Add($script:lastGesture)
            if ($fault -eq 'space-failure') { throw 'injected Space failure' }
            $script:activationCount += 2
            return @{ observation = @{ status = 'complete' } }
        }

        function Ui([string]$Name, [string[]]$Arguments) {
            switch ($Arguments[0]) {
                'wait-for' { return }
                'get-property' {
                    Assert ($Arguments[1] -eq 'LabActionResult') 'Readback должен читать счётчик действий.'
                    $script:observed.Add("${script:lastGesture}:$script:activationCount")
                    return @{ properties = @{ Name = "Действие выполнено: $script:activationCount" } }
                }
                'screenshot' { return }
                'hover' {
                    $script:lastGesture = if ($Arguments[1] -eq 'LabButtonMedium') { 'hover' } else { 'pointer-out' }
                }
                'drag' {
                    Assert ($Arguments[1] -eq 'LabButtonMedium') 'Drag должен начинаться на кнопке.'
                    if ($Arguments[2] -eq 'LabButtonMedium') {
                        $script:lastGesture = 'pressed'
                        $script:activationCount++
                    } else {
                        Assert (($Arguments -join '|') -eq 'drag|LabButtonMedium|LabActionResult|--hold-ms|50') 'Неверная команда отменённого нажатия.'
                        $script:lastGesture = 'cancel-drag'
                    }
                }
                default { throw "Неизвестная операция тестовой границы: $($Arguments[0])" }
            }
            $script:performed.Add($script:lastGesture)
            if ($script:lastGesture -eq $fault) { $script:activationCount++ }
        }

        function Set-Content {
            param([Parameter(Position = 0)][string]$Path, [string]$Encoding,
                [Parameter(ValueFromPipeline = $true)]$InputObject)
            process { }
        }

        $failure = $null
        try { . $scenario } catch { $failure = $_ }
        if ($fault -eq 'none') {
            Assert ($null -eq $failure) "Здоровый сценарий не прошёл: $failure"
            Assert ($script:activationCount -eq 6) 'Нарушено число click и Space активаций.'
            Assert (($script:performed -join ',') -eq 'hover,pressed,rapid-space,cancel-drag,pointer-out') 'Сценарий не прошёл все пять жестов в нужном порядке.'
            Assert (($script:observed -join ',') -eq 'pressed:4,rapid-space:6,cancel-drag:6,pointer-out:6') 'Readback не подтвердил каждый переход и конечный счётчик.'
            Assert ($space.observation.status -eq 'complete') 'Цикл потерял полное наблюдение Space.'
        } elseif ($fault -eq 'space-failure') {
            Assert ($null -ne $failure -and $failure.Exception.Message -eq 'injected Space failure') 'Ошибка Space потеряна.'
            Assert (($script:performed -join ',') -eq 'hover,pressed,rapid-space') 'После отказа Space начался другой жест.'
        } else {
            Assert ($null -ne $failure -and $failure.Exception.Message -match 'ровно 6 действий') 'Лишняя активация не отвергнута настоящим Assert-Count.'
            Assert ($script:observed[-1] -eq "${fault}:7") 'Отказ не связан с наблюдаемым неверным счётчиком.'
            if ($fault -eq 'cancel-drag') {
                Assert (!$script:performed.Contains('pointer-out')) 'После неверного счётчика отмены начался следующий жест.'
            }
        }
    } $fault
}

'retarget contract: PASS (cancelled activation, final count, unchanged click and Space)'
