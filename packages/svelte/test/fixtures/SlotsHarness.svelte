<script lang="ts">
  import { Button, Tooltip } from '../../src/index.js';
</script>
{#snippet rich()}<span>Rich named content</span>{/snippet}
<Button id="fixed-slot">
  Save
  {#snippet description()}<span>Fixed description</span>{/snippet}
</Button>
<Button id="override-slot" slots={{ description: rich }}>
  Save
  {#snippet description()}<span>Replaced description</span>{/snippet}
</Button>
<Tooltip id="collision-slot" slots={{ content: rich }}>Trigger</Tooltip>
