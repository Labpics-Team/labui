<script>
  import { Select } from '@labpics/ui-svelte';
  import { initialItems, renamedItems } from './client-mount-data.mjs';
  let items = $state(initialItems), value = $state(['a']), initial = $state(['b']);
  let lastChange = $state('');
</script>
  <Select id="uncontrolled" label="Uncontrolled" {items} multiple={true}
    defaultValue={initial} placeholder="Choose" onValueChange={(e)=>lastChange=e.detail.value.join(',')} />
  <Select id="controlled" label="Controlled" {items} multiple={true}
    {value} defaultValue={initial} placeholder="Choose" />
  <Select id="released" label="Explicit null" {items} multiple={true}
    value={null} defaultValue={initial} placeholder="Choose" />
  <output id="client-events">{lastChange}</output>
  <output id="client-control">{value===undefined?'omitted':'set'}</output>
  <button id="rename-choice" onclick={()=>items=renamedItems}>Rename C</button>
  <button id="select-c" onclick={()=>value=['c']}>Select C</button>
  <button id="withdraw-controlled" onclick={()=>value=undefined}>Withdraw binding</button>
  <button id="clear-controlled" onclick={()=>value=[]}>Clear controlled</button>
  <button id="change-default" onclick={()=>initial=['a']}>Change default</button>
