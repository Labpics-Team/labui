import { type LabuiColorsAttachment, attachLabuiColors } from '@labui/colors/runtime';

/** Canvas — авторский вход LabUI; его цвет не зависит от отзыва outputs Core. */
export function bootColors(): LabuiColorsAttachment {
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.hidden = true;
  status.textContent = 'Цветовая тема недоступна.';
  // Состояние отказа читается и при отсутствии опубликованных цветовых ролей.
  status.style.color = 'CanvasText';
  status.style.backgroundColor = 'Canvas';
  document.body.prepend(status);
  return attachLabuiColors({
    scope: document.documentElement,
    backdrop: document.body,
    canvas: 'authored',
    onState(state) {
      status.hidden =
        state.state === 'ready' ||
        state.reason === 'loading' ||
        state.state === 'cancelled' ||
        state.state === 'disposed';
    },
  });
}
