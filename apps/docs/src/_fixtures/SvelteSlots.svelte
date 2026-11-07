<script lang="ts">
  import { Badge, Button } from '@labpics/ui-svelte';

  let showIcon = $state(true);
</script>

<label>
  <input type="checkbox" bind:checked={showIcon} data-testid="svelte-show-icon" />
  Показывать иконку
</label>

<div class="row">
  <Badge data-testid="svelte-badge">
    {#snippet leading()}
      {#if showIcon}
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M0 0h24v24H0Z" />
        </svg>
      {/if}
    {/snippet}
    Метка
  </Badge>
  <Badge data-testid="svelte-bare">Метка</Badge>
  <Button data-testid="svelte-button" size="s">
    {#snippet end()}
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M0 0h24v24H0Z" />
      </svg>
    {/snippet}
    Действие
  </Button>
</div>
