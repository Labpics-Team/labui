/**
 * Клиентская гидрация (happy-dom): SSR-строка вставляется в DOM, регистрация элемента
 * подключается (как это делает client-<script> в .astro) — элемент определён и апгрейдится.
 * Это клиентская половина рецепта Astro (серверную покрывает render-astro.test).
 */
import { describe, expect, it } from 'vitest';
import '@labpics/ui-core/button';
import { renderButton } from '../src/ssr.js';

describe('Astro client-гидрация', () => {
  it('DSD-строка попадает в DOM, элемент lab-button зарегистрирован', () => {
    const host = document.createElement('div');
    host.innerHTML = renderButton({ type: 'accent' }, { default: 'Сохранить' });
    document.body.appendChild(host);
    // Элемент присутствует в light DOM.
    const el = host.querySelector('lab-button');
    expect(el).toBeTruthy();
    // Регистрация подключена (client-<script> в .astro импортит ту же регистрацию).
    expect(customElements.get('lab-button')).toBeTruthy();
    // Апгрейд: инстанс — экземпляр зарегистрированного класса.
    const ctor = customElements.get('lab-button');
    expect(ctor && el instanceof ctor).toBe(true);
  });
});
