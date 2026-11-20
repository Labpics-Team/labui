<script>
  import { Alert, Badge, Button, Card } from '@labpics/ui-svelte';
  let shown = $state(true);
  let label = $state('Initial < & " text');
</script>
<button data-update onclick={() => label = 'Updated < & " text'}>Update</button>
<button data-toggle onclick={() => shown = !shown}>Toggle</button>
{#if shown}
  <Alert heading="Custom SVG">
    {#snippet icon()}<svg data-icon width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>{/snippet}
  </Alert>
  <Alert heading="Nested custom element">
    {#snippet icon()}<demo-symbol data-nested>{@html '<template shadowrootmode="open"><style>:host{display:block}svg{display:block;width:100%;height:100%}</style><svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></template>'}</demo-symbol>{/snippet}
  </Alert>
{/if}
{#snippet pressureIcon()}<svg data-pressure width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>{/snippet}
<Button style="width:60px" slots={{icon: pressureIcon}}>Long button label</Button>
<Badge>Painted dot{#snippet dot()}<span data-dot></span>{/snippet}</Badge>
{#snippet headerDraft()}<input data-header-draft/>{/snippet}
<Card slots={{header: shown ? headerDraft : undefined}}>
  <span data-default>Default {label}</span>
  {#snippet footer()}<span data-first style="display:inline-block;width:17px">A</span>{label}<input data-draft/><span data-last>B</span>{/snippet}
</Card>
