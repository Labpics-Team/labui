param([string]$Harness = (Join-Path $PSScriptRoot 'smoke.ps1'))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }

$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput(
    [IO.File]::ReadAllText($Harness), [ref]$tokens, [ref]$errors)
Assert ($errors.Count -eq 0) 'Синтаксис harness повреждён.'
# Исполняются настоящие функции; bootstrap, GUI и ввод остаются за границей Ui.
foreach ($name in @('Test-LayoutNumber', 'Assert-LayoutBounds', 'Capture-LowerControls')) {
    $definition = $ast.Find({ param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name
    }, $false)
    Assert ($null -ne $definition) "Не найдена функция $name."
    . ([scriptblock]::Create($definition.Extent.Text))
}

function Invoke-ViewportCase([string]$Start = '0', [string]$Theme = 'Light',
    [string]$Phase = 'before', [string]$Fault = '', $Value = $null, [string]$Target = 'LabThemeLight') {
    $case = @{ position = $Start; reads = 0; stage = ''; target = $Target; trace = [Collections.Generic.List[string]]::new();
        primary = [InvalidOperationException]::new('viewport fixture primary'); failedAt = '' }
    $output = [IO.Path]::GetTempPath()
    $labels = [ordered]@{ LabThemeLight = 'Светлая тема'; LabThemeDark = 'Тёмная тема'; LabToggleEnabled = 'Включить кнопку' }
    function Ui([string]$Name, [string[]]$Arguments) {
        $call = $Arguments -join '|'
        $case.trace.Add($call)
        $operation = $Arguments[0]
        if ($Fault -ceq "throw:$call") {
            $case.failedAt = $call
            throw $case.primary
        }
        switch ($operation) {
            'scroll' {
                Assert ($Start -ceq '0') 'Прокрутка вызвана без overflow.'
                Assert ($call -cin @('scroll|LabButtonViewport|--to|bottom', 'scroll|LabButtonViewport|--to|top')) 'Неверная команда scroll.'
                $case.position = if ($Arguments[3] -ceq 'bottom') { '100' } else { '0' }
            }
            'wait-for' {
                Assert ($Arguments[-2] -ceq '--timeout' -and $Arguments[-1] -ceq '5000') 'Ожидание потеряло конечный budget.'
                # Успешный wait не заменяет следующий readback: он может уже устареть.
            }
            'get-property' {
                $id = $Arguments[1]
                if ($id -ceq 'LabButtonViewport') {
                    Assert ($call -ceq 'get-property|LabButtonViewport|--property|ScrollVerticalPercent') 'Не запрошен процент viewport.'
                    Assert ($case.reads -lt 3) 'Лишняя стадия viewport.'
                    $case.stage = @('before', 'captured', 'restored')[$case.reads++]
                    $state = [pscustomobject]@{ properties = [pscustomobject]@{ ScrollVerticalPercent = $case.position };
                        element = [pscustomobject]@{ x = 10; y = 10; width = 500; height = 300 } }
                    if ($case.stage -ceq $Phase) {
                        switch ($Fault) {
                            'missing-properties' { $state.PSObject.Properties.Remove('properties') }
                            'missing-percent' { $state.properties.PSObject.Properties.Remove('ScrollVerticalPercent') }
                            'percent' { $state.properties.ScrollVerticalPercent = $Value }
                            'viewport-width' { $state.element.width = $Value }
                        }
                    }
                    return $state
                }
                Assert ($labels.Contains($id)) 'Запрошен неизвестный нижний control.'
                $element = [pscustomobject]@{ automationId = $id; name = $labels[$id]; isOffscreen = $false;
                    x = 30; y = 30; width = 150; height = 40 }
                if ($Start -ceq '0' -and $case.stage -cne 'captured') {
                    $element.isOffscreen = $true; $element.y = 600; $element.width = 0; $element.height = 0
                }
                if ($case.stage -ceq $Phase -and $id -ceq $case.target -and $Fault.StartsWith('action:')) {
                    $field = $Fault.Substring(7)
                    if ($field -ceq 'missing-name') { $element.PSObject.Properties.Remove('name') }
                    else { $element.$field = $Value }
                }
                return @{ element = $element }
            }
            'screenshot' {
                Assert ($case.stage -ceq 'captured') 'Снимок сделан вне нижнего viewport.'
                Assert ($call -ceq "screenshot|--output|$(Join-Path $output "page-lower-$Theme.png")") 'Неверный путь нижнего PNG.'
            }
            default { throw "Неизвестная операция Ui: $operation" }
        }
    }

    $failure = $null; $result = $null
    try { $result = Capture-LowerControls $Theme } catch { $failure = $_ }
    if ($Fault) {
        Assert ($null -ne $failure) "Принято повреждённое наблюдение $Phase/$Fault/$Value/$Target."
        Assert ($null -eq $result) 'После отказа опубликован результат capture.'
        if ($Fault.StartsWith('throw:')) {
            Assert ([object]::ReferenceEquals($failure.Exception, $case.primary)) 'Первичная ошибка Ui подменена.'
            Assert ($case.trace[-1] -ceq $case.failedAt) 'После ошибки Ui началась следующая операция.'
        }
    } else {
        Assert ($null -eq $failure) "Здоровый viewport $Start/$Theme не прошёл: $failure"
        Assert ($result.file -ceq "page-lower-$Theme.png") 'Потеряно имя нижнего PNG.'
        Assert ($case.reads -eq 3) 'Нет полного before/captured/restored readback.'
        $expected = [Collections.Generic.List[string]]::new()
        foreach ($stage in @('before', 'captured', 'restored')) {
            $percent = if ($Start -ceq '-1') { '-1' } elseif ($stage -ceq 'captured') { '100' } else { '0' }
            if ($Start -ceq '0' -and $stage -cne 'before') {
                $to = if ($stage -ceq 'captured') { 'bottom' } else { 'top' }
                $expected.Add("scroll|LabButtonViewport|--to|$to")
                $expected.Add("wait-for|LabButtonViewport|--property|ScrollVerticalPercent|--value|$percent|--timeout|5000")
            }
            $expected.Add('get-property|LabButtonViewport|--property|ScrollVerticalPercent')
            Assert ($result[$stage].viewport.scrollVerticalPercent -ceq $percent) 'Процент потерян в result readback.'
            Assert (($result[$stage].actions.automationId -join ',') -ceq ($labels.Keys -join ',')) 'Потеряна нижняя кнопка в readback.'
            foreach ($id in $labels.Keys) {
                if ($stage -ceq 'captured') { $expected.Add("wait-for|$id|--property|IsOffscreen|--value|False|--timeout|5000") }
                $expected.Add("get-property|$id")
                $action = $result[$stage].actions | Where-Object automationId -CEQ $id
                Assert ($action.name -ceq $labels[$id]) 'Подпись потеряна в readback.'
                if ($stage -ceq 'captured') { Assert (!$action.isOffscreen -and $action.width -eq 150 -and $action.height -eq 40) 'Captured bounds потеряны.' }
            }
            if ($stage -ceq 'captured') { $expected.Add("screenshot|--output|$(Join-Path $output "page-lower-$Theme.png")") }
        }
        Assert (($case.trace -join "`n") -ceq ($expected -join "`n")) 'Порядок capture/scroll/wait/readback изменён.'
    }
    "viewport case: start=$Start theme=$Theme phase=$Phase fault=$Fault target=$Target rejected=$($null -ne $failure)"
}

foreach ($theme in @('Light', 'Dark')) {
    Invoke-ViewportCase -Start '0' -Theme $theme
    Invoke-ViewportCase -Start '-1' -Theme $theme
}
foreach ($stage in @('before', 'captured', 'restored')) {
    foreach ($fault in @('missing-properties', 'missing-percent')) { Invoke-ViewportCase -Phase $stage -Fault $fault }
    foreach ($bad in @($null, '', ' ', 'NaN', 'Infinity', '-Infinity', '50', '0.5', '-2', 0, $false)) {
        Invoke-ViewportCase -Phase $stage -Fault 'percent' -Value $bad
    }
    foreach ($bad in @($null, 0, -1, [double]::NaN)) { Invoke-ViewportCase -Phase $stage -Fault 'viewport-width' -Value $bad }
}
Invoke-ViewportCase -Phase before -Fault percent -Value '100'
Invoke-ViewportCase -Phase captured -Fault percent -Value '0'
Invoke-ViewportCase -Phase restored -Fault percent -Value '100'
foreach ($stage in @('captured', 'restored')) {
    Invoke-ViewportCase -Start '-1' -Phase $stage -Fault percent -Value '0'
}
foreach ($id in @('LabThemeLight', 'LabThemeDark', 'LabToggleEnabled')) {
    foreach ($pair in @(@('missing-name', $null), @('name', 'Другая подпись'), @('automationId', 'Other'),
        @('isOffscreen', $true), @('isOffscreen', 'False'), @('x', 9), @('y', 9), @('x', 500), @('y', 300),
        @('width', 0), @('height', 0))) {
        Invoke-ViewportCase -Phase captured -Fault "action:$($pair[0])" -Value $pair[1] -Target $id
    }
}
foreach ($call in @('scroll|LabButtonViewport|--to|bottom',
    'wait-for|LabButtonViewport|--property|ScrollVerticalPercent|--value|100|--timeout|5000',
    'wait-for|LabThemeLight|--property|IsOffscreen|--value|False|--timeout|5000',
    "screenshot|--output|$(Join-Path ([IO.Path]::GetTempPath()) 'page-lower-Light.png')",
    'scroll|LabButtonViewport|--to|top',
    'wait-for|LabButtonViewport|--property|ScrollVerticalPercent|--value|0|--timeout|5000')) {
    Invoke-ViewportCase -Fault "throw:$call"
}
'viewport contract: PASS (overflow, no overflow, mandatory readback, visible labels, primary failure)'
