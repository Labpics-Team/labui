<script lang="ts">
  import Switch from '../../src/generated/Switch.svelte';
  import Checkbox from '../../src/generated/Checkbox.svelte';

  let { checked, indeterminate, onCheckedChange }: {
    checked?: boolean;
    indeterminate?: boolean;
    onCheckedChange?: (event: CustomEvent<{ checked: boolean }>) => void;
  } = $props();
  let current = $state(checked);
  let size = $state<'s' | 'm' | 'l'>('m');

  export function setChecked(value: boolean | undefined) { current = value; }
  export function setSize(value: 's' | 'm' | 'l') { size = value; }
</script>

<Switch data-case="omitted" defaultChecked={true} />
<Switch data-case="supplied" checked={current} defaultChecked={true} {size} {onCheckedChange} />
<Checkbox data-case="omitted" defaultIndeterminate={true} />
<Checkbox data-case="supplied" {indeterminate} defaultIndeterminate={true} />
