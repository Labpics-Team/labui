<script lang="ts">
  import Chip from '../../src/generated/Chip.svelte';
  import type { LabChip } from '@labpics/ui-core/chip';
  let {onSelectedChange}: {onSelectedChange?: (event:CustomEvent) => void} = $props();
  let loading = $state(false);
  let name = $state<string | undefined>('filter');
  let active = $state<boolean | undefined>(true);
  let size = $state<LabChip['size'] | undefined>();
  let mode = $state<LabChip['mode'] | undefined>();
  let value = $state<string | undefined>();
  export function setPending(value:boolean) { loading=value; }
  export function withdraw() { name=undefined; active=undefined; }
  export function variant(nextSize:LabChip['size'] | undefined,nextMode:LabChip['mode'] | undefined,nextValue:string | undefined) { size=nextSize;mode=nextMode;value=nextValue; }
</script>
<Chip defaultSelected {loading} {name} {active} {size} {mode} {value} {onSelectedChange}>Svelte filter</Chip>
