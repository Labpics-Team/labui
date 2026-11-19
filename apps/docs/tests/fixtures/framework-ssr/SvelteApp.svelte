<script>
import {Tabs,Textarea,Accordion,Tooltip} from '@labpics/ui-svelte';
import {serverFieldValue, normalizedServerFieldValue, externalFieldValue} from './field-values.mjs';
let caption=$state('Draft'), selected=$state('draft'), events=$state(0), clicks=$state(0);
let fieldValue=$state(serverFieldValue),locked=$state(false);
let items=$derived([{value:'draft',label:caption},{value:'history',label:'History'}]);
</script>
{#snippet draft()}
  <textarea id="editor" aria-label="Draft text">Server draft</textarea><button id="save" onclick={()=>clicks++}>Save</button><strong id="caption">{caption}</strong>
{/snippet}
{#snippet history()}
  <p id="history">Saved versions</p>
{/snippet}
{#snippet one()}Body{/snippet}
<main>
  <Tabs {items} slots={{draft,history}} value={selected} label={null} size="l" variant="tinted" aria-label="Files" id="tabs" class="my-tabs active" onValueChange={(e)=>{selected=e.detail.value;events++}}>
    <small id="footer">Svelte default slot</small>
  </Tabs>
  <button id="rename" onclick={()=>caption='Renamed'}>Rename</button>
  <output id="events">{events}</output><output id="clicks">{clicks}</output>
  <Textarea id="field" label="Message" value={fieldValue} readonly={locked} />
  <button id="lock-field" onclick={()=>locked=true}>Lock field</button>
  <button id="normalize-field" onclick={()=>fieldValue=normalizedServerFieldValue}>Normalize field</button>
  <button id="set-field" onclick={()=>fieldValue=externalFieldValue}>Set field</button>
  <Accordion id="accordion" items={[{value:'one',label:'One'}]} value={['one']} collapsible={false} slots={{one}} />
  <Tabs id="null-tabs" {items} value={null} defaultValue="draft" />
  <Tooltip id="tooltip" content="Help" arrow={false}>Trigger</Tooltip>
  <Tooltip id="default-tooltip" content="Default">Default trigger</Tooltip>
</main>

