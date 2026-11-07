import { mount } from 'svelte';
import SvelteSlots from './SvelteSlots.svelte';

const target = document.querySelector<HTMLElement>('#svelte-slots');
if (!target) throw new Error('Не найден контейнер Svelte');
mount(SvelteSlots, { target });
