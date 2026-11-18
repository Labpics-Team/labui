<!-- Тест-фикстура: использует обёртки как потребитель (слот-контент + пропы + событие). -->
<script lang="ts">
  import { Button, Checkbox, Input, Tooltip } from '../../src/index.js';

  let { onCheckedChange }: { onCheckedChange?: (event: CustomEvent) => void } = $props();
  let arrow = $state(false);
  export function setArrow(value: boolean) { arrow = value; }
</script>

<Button type="accent" size="l" disabled={false} loading={true}>Сохранить</Button>
<Input label="Имя" value="Даниил" />
<Checkbox {onCheckedChange} />
<Tooltip {arrow} content="Explicit boolean">Trigger</Tooltip>
<Tooltip content="Default boolean">Trigger</Tooltip>
