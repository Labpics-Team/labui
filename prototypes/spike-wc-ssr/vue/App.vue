<script setup lang="ts">
// Vue 3 SSR fixture for the WC-SSR falsifier.
//
// Two paths are rendered side by side:
//  (1) NATIVE path: <lab-button> written as a Vue custom element. Vue SSR emits
//      the tag SHALLOWLY — no Lit SSR runs, so no declarative shadow DOM (this
//      mirrors the Next 15 shallow-SSR result in proto-A).
//  (2) LIT-SSR path: a string produced by @lit-labs/ssr (declarative shadow DOM)
//      injected via v-html. This is the controlled path that yields first-paint
//      shadow content with no FOUC.
//
// The probe inspects the built HTML for which path carried the DSD through.
defineProps<{ litSsrHtml: string }>();
</script>

<template>
  <section data-path="native">
    <h2>Vue native custom-element path</h2>
    <lab-button type="accent" kind="fill" data-testid="vue-native-accent">Accent fill</lab-button>
  </section>
  <section data-path="lit-ssr" v-html="litSsrHtml" />
</template>
