<!-- Тест-фикстура: использует обёртки как потребитель (слот-контент + пропы + событие). -->
<script lang="ts">
  import { Button, Checkbox, Input } from '../../src/index.js';

  let { onCheckedChange }: { onCheckedChange?: (event: CustomEvent) => void } = $props();
</script>

<Button type="accent" size="l" disabled={false} loading={true}>Сохранить</Button>
<Input label="Имя" value="Даниил" />
<Checkbox {onCheckedChange} />
