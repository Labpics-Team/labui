import type { MotionConfig } from './model.js';

/**
 * Lab UI semantic motion contract.
 *
 * LabUI выбирает характер движения. LabMotion исполняет физическую модель;
 * чужие дизайн-системы не задают нормативный стиль LabUI.
 */
export const defaultMotionConfig: MotionConfig = {
  springs: [
    {
      name: 'toggle',
      response: 320,
      bounce: 0.22,
      category: 'spatial',
      fallbackEasing: 'standard',
      provenance: {
        class: 'e',
        source:
          'LabUI: короткий ход Switch 12–20px; быстрый отклик, один деликатный перелёт и сохранение скорости при повторном вводе. Калибровка проверяется на реальных Lit и React Switch.',
      },
      description: 'переключение — короткое перемещение с мягким успокоением',
    },
    {
      name: 'smooth',
      primitive: 'smooth',
      category: 'effects',
      fallbackEasing: 'decelerate',
      description: 'effects spring — opacity/colour, interruptible, no bounce',
    },
    {
      name: 'expressive',
      primitive: 'expressive',
      category: 'spatial',
      fallbackEasing: 'emphasized',
      description: 'spatial spring — the single restrained overshoot, for emphasis',
    },
  ],

  semantics: [
    {
      name: 'entrance',
      duration: 'base',
      easing: 'decelerate',
      reduced: { duration: 'fast', easing: 'linear' },
      provenance: {
        class: 'e',
        source: 'LabUI: появление замедляется к месту покоя; сохранённый контракт роли.',
      },
      description: 'element appears — decelerate, settles into place',
    },
    {
      name: 'exit',
      duration: 'fast',
      easing: 'accelerate',
      reduced: { duration: 'fast', easing: 'linear' },
      provenance: {
        class: 'e',
        source:
          'LabUI: исчезновение быстрее появления, чтобы завершённое действие освобождало место.',
      },
      description: 'element leaves — accelerate, quicker than entrance',
    },
    {
      name: 'transition',
      duration: 'fast',
      easing: 'standard',
      reduced: { duration: 'instant', easing: 'linear' },
      provenance: {
        class: 'e',
        source:
          'LabUI: краткая обратная связь состояния. Сохранённая базовая скорость 100ms; runtime Switch использует её как масштаб времени собственной пружины toggle.',
      },
      description: 'in-place state change / move — standard easing',
    },
    {
      name: 'emphasis',
      duration: 'slow',
      easing: 'emphasized',
      spring: 'expressive',
      reduced: { duration: 'instant', easing: 'linear' },
      provenance: {
        class: 'e',
        source: 'LabUI: сохранённая отдельная роль привлечения внимания с выраженным движением.',
      },
      description: 'attention moment — the restrained overshoot lives here',
    },
  ],
};
