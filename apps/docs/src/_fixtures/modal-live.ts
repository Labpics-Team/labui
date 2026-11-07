import '@labpics/ui-core/dialog';
import '@labpics/ui-core/alert-dialog';
import type { LabSheet } from '@labpics/ui-core/sheet';
import { Sheet } from '@labpics/ui-vue/sheet';
import { createApp, h, nextTick, ref } from 'vue';

const hasContent = ref(true);
const target = document.getElementById('vue-sheet');
if (!target) throw new Error('Не найден контейнер Vue Sheet');
createApp({
  setup: () => () =>
    h(
      Sheet,
      { id: 'vue', 'data-testid': 'vue', position: 'flex', 'aria-label': 'Параметры Vue' },
      {
        default: () => 'Открыть Vue Sheet',
        content: () =>
          hasContent.value
            ? h('div', { id: 'vue-content', style: 'height:100px' }, 'Параметры Vue')
            : null,
      },
    ),
}).mount(target);

declare global {
  interface Window {
    modalLiveFixture: { setVueContent(value: boolean): Promise<void> };
  }
}

window.modalLiveFixture = {
  async setVueContent(value) {
    hasContent.value = value;
    await nextTick();
  },
};

async function ready(): Promise<void> {
  await Promise.all(
    [...document.querySelectorAll<LabSheet>('lab-sheet, lab-dialog, lab-alert-dialog')].map(
      (element) => element.updateComplete,
    ),
  );
  document.documentElement.setAttribute('data-modal-live-ready', 'true');
}
void ready();
