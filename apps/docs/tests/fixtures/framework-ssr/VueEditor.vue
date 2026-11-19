<script setup>
defineProps(['caption']);
defineEmits(['save']);
</script>
<template>
<textarea id="editor" aria-label="Draft text">Server draft</textarea>
<button id="save" @click="$emit('save')">Save</button>
<strong id="caption">{{ caption }}</strong>
</template>
