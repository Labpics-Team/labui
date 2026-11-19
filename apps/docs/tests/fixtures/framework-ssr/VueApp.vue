<script setup>
import { Accordion } from '@labpics/ui-vue/accordion';
import { Tabs } from '@labpics/ui-vue/tabs';
import { Textarea } from '@labpics/ui-vue/textarea';
import { Tooltip } from '@labpics/ui-vue/tooltip';
import { computed, ref } from 'vue';
import Editor from './VueEditor.vue';
import {
  externalFieldValue,
  normalizedServerFieldValue,
  serverFieldValue,
} from './field-values.mjs';
const caption = ref('Draft');
const selected = ref('draft');
const events = ref(0);
const clicks = ref(0);
const fieldValue = ref(serverFieldValue);
const locked = ref(false);
const items = computed(() => [
  { value: 'draft', label: caption.value },
  { value: 'history', label: 'History' },
]);
const changed = (e) => {
  selected.value = e.detail.value;
  events.value++;
};
</script>
<template>
<main>
  <Tabs id="tabs" :items="items" :value="selected" :label="null" aria-label="Files"
    :class="['my-tabs',{active:true}]" :style="{'max-width':'600px'}" size="l" variant="tinted" @value-change="changed">
    <template #draft><Editor :caption="caption" @save="clicks++" /></template>
    <template #history><p id="history">Saved versions</p></template>
    <small id="footer">Vue default slot</small>
  </Tabs>
  <button id="rename" @click="caption='Renamed'">Rename</button>
  <output id="events">{{events}}</output><output id="clicks">{{clicks}}</output>
  <Textarea id="field" label="Message" :value="fieldValue" :readonly="locked" />
  <button id="lock-field" @click="locked=true">Lock field</button>
  <button id="normalize-field" @click="fieldValue=normalizedServerFieldValue">Normalize field</button>
  <button id="set-field" @click="fieldValue=externalFieldValue">Set field</button>
  <Accordion id="accordion" :items="[{value:'one',label:'One'}]" :value="['one']" :collapsible="false">
    <template #one>Body</template>
  </Accordion>
  <Tabs id="null-tabs" :items="items" :value="null" default-value="draft" />
  <Tooltip id="tooltip" content="Help" :arrow="false">Trigger</Tooltip>
  <Tooltip id="default-tooltip" content="Default">Default trigger</Tooltip>
</main>
</template>
