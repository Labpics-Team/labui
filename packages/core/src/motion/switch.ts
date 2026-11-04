import { scope } from '@labpics/motion';
import { motionSemanticRuntime, motionSpringRuntime } from '@labpics/ui-tokens/motion';

// Частное имя в списке не включает transform и отличает нашу запись от
// authored `none`, в том числе `none !important` после подключения.
const MANAGED_TRANSITION = '--_lab-switch-motion';

export interface SwitchMotion {
  update(checked: boolean): void;
  dispose(): void;
}

/**
 * Один владелец движения двух рендеров. Zag сохраняет состояние и доступность;
 * LabMotion сохраняет скорость при смене цели и владеет единственным scheduler.
 */
export function mountSwitchMotion(
  root: ParentNode,
  track: HTMLElement,
  thumb: HTMLElement,
  initialChecked: boolean,
): SwitchMotion {
  const motion = scope(root);
  const currentView = thumb.ownerDocument.defaultView;
  if (!currentView) throw new Error('Switch motion requires a document with a window');
  const view = currentView;
  const reduce = view.matchMedia('(prefers-reduced-motion: reduce)');
  const originalTransform = thumb.style.getPropertyValue('transform');
  const originalTransformPriority = thumb.style.getPropertyPriority('transform');
  let authoredTransition = thumb.style.getPropertyValue('transition-property');
  let authoredTransitionPriority = thumb.style.getPropertyPriority('transition-property');
  let checked = initialChecked;
  let distance = travel();
  let disposed = false;

  function restoreTransition(): void {
    const current = thumb.style.getPropertyValue('transition-property');
    const priority = thumb.style.getPropertyPriority('transition-property');
    // Восстанавливаем лишь собственную временную запись. Новая запись или
    // удаление свойства потребителем становится текущим CSS-контрактом.
    if (current !== MANAGED_TRANSITION || priority !== 'important') {
      authoredTransition = current;
      authoredTransitionPriority = priority;
    }
    if (authoredTransition) {
      thumb.style.setProperty(
        'transition-property',
        authoredTransition,
        authoredTransitionPriority,
      );
    } else {
      thumb.style.removeProperty('transition-property');
    }
  }

  function travel(): number {
    // CSS-геометрия не включает transform предков или текущую позу бегунка.
    const control = view.getComputedStyle(track);
    const knob = view.getComputedStyle(thumb);
    return (
      Math.max(
        0,
        Number.parseFloat(control.width) -
          Number.parseFloat(control.paddingLeft) -
          Number.parseFloat(control.paddingRight) -
          Number.parseFloat(control.borderLeftWidth) -
          Number.parseFloat(control.borderRightWidth) -
          Number.parseFloat(knob.width),
      ) || 0
    );
  }

  function durationScale(): number {
    // Читаем настоящий CSS cascade: и token override, и transition:none/0.
    // После чтения только runtime имеет право писать transform.
    restoreTransition();
    const style = view.getComputedStyle(thumb);
    const properties = style.transitionProperty.split(',').map((value) => value.trim());
    const durations = style.transitionDuration
      .split(',')
      .map((value) => Number.parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000));
    let index = -1;
    for (let i = 0; i < properties.length; i++) {
      if (properties[i] === 'transform' || properties[i] === 'all') index = i;
    }
    const ms = index < 0 ? 0 : (durations[index % durations.length] ?? 0);
    thumb.style.setProperty('transition-property', MANAGED_TRANSITION, 'important');
    return ms / motionSemanticRuntime.transition.durationMs;
  }

  function move(snap = false): void {
    if (disposed) return;
    const scale = durationScale();
    const spring = motionSpringRuntime.toggle;
    motion.animate(
      thumb,
      { x: checked ? distance : 0 },
      {
        spring: scale > 0 ? { response: spring.response * scale, bounce: spring.bounce } : spring,
        reducedMotion: snap || reduce.matches || scale <= 0 ? 'always' : 'user',
      },
    );
  }

  // Без промежуточного проигрывания SSR-позы и без переноса старого inline state
  // после StrictMode cleanup или переподключения Lit.
  thumb.setAttribute('data-lab-motion', '');
  move(true);
  motion.on(reduce, 'change', () => {
    if (reduce.matches) move(true);
  });
  const resize = new ResizeObserver(() => {
    if (disposed) return;
    const next = travel();
    if (next === distance) return;
    distance = next;
    move();
  });
  resize.observe(track);
  resize.observe(thumb);

  return {
    update(nextChecked): void {
      if (disposed) return;
      const nextDistance = travel();
      if (nextChecked === checked && nextDistance === distance) return;
      checked = nextChecked;
      distance = nextDistance;
      // Scalar target сохраняет скорость; stop() или [from,to] разорвут её.
      move();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      resize.disconnect();
      motion.dispose();
      if (originalTransform) {
        thumb.style.setProperty('transform', originalTransform, originalTransformPriority);
      } else {
        thumb.style.removeProperty('transform');
      }
      restoreTransition();
      thumb.removeAttribute('data-lab-motion');
    },
  };
}
