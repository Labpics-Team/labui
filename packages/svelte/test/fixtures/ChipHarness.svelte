<script lang="ts">
  import Chip from '../../src/generated/Chip.svelte';
  let {onSelectedChange}: {onSelectedChange?: (event:CustomEvent) => void} = $props();
  let loading = $state(false);
  let name = $state<string | undefined>('filter');
  let active = $state<boolean | undefined>(true);
  export function setPending(value:boolean) { loading=value; }
  export function withdraw() { name=undefined; active=undefined; }
</script>
<Chip defaultSelected {loading} {name} {active} {onSelectedChange}>Svelte filter</Chip>
