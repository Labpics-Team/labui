<script setup>
import { Select } from '@labpics/ui-vue/select';
import { ref } from 'vue';
import { initialItems, renamedItems } from './client-mount-data.mjs';
const items = ref(initialItems);
const value = ref(['a']);
const initial = ref(['b']);
const lastChange = ref('');
</script>
<template>
    <Select id="uncontrolled" label="Uncontrolled" :items="items" :multiple="true"
      :defaultValue="initial" placeholder="Choose" @value-change="lastChange=$event.detail.value.join(',')" />
    <Select id="controlled" label="Controlled" :items="items" :multiple="true"
      :value="value" :defaultValue="initial" placeholder="Choose" />
    <Select id="released" label="Explicit null" :items="items" :multiple="true"
      :value="null" :defaultValue="initial" placeholder="Choose" />
    <output id="client-events">{{lastChange}}</output>
    <output id="client-control">{{value===undefined?'omitted':'set'}}</output>
    <button id="rename-choice" @click="items=renamedItems">Rename C</button>
    <button id="select-c" @click="value=['c']">Select C</button>
    <button id="withdraw-controlled" @click="value=undefined">Withdraw binding</button>
    <button id="clear-controlled" @click="value=[]">Clear controlled</button>
    <button id="change-default" @click="initial=['a']">Change default</button>
</template>
