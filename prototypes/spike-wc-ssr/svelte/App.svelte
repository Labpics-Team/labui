<script lang="ts">
// Svelte 5 SSR fixture for the WC-SSR falsifier.
//  (1) NATIVE path: <lab-button> as an unknown element — Svelte SSR emits the
//      tag shallowly, no Lit SSR runs (mirrors Next 15 shallow result).
//  (2) LIT-SSR path: @lit-labs/ssr declarative-shadow-DOM string via {@html}.
const { litSsrHtml }: { litSsrHtml: string } = $props();
</script>

<section data-path="native">
  <h2>Svelte native custom-element path</h2>
  <lab-button type="accent" kind="fill" data-testid="svelte-native-accent">Accent fill</lab-button>
</section>
<section data-path="lit-ssr">{@html litSsrHtml}</section>
