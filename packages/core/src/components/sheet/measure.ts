import { type SheetGeometry, sheetGeometry } from './positions.js';

/** DOM измеряет только содержимое и rem-пресеты; вычисление позиций остаётся чистым. */
export function measureSheetGeometry(positioner: HTMLElement): SheetGeometry {
  const view = positioner.ownerDocument.defaultView;
  if (!view) throw new Error('LabSheet: измерение требует окно документа');
  const surface = positioner.querySelector<HTMLElement>('.lab-sheet-surface');
  const content = positioner.querySelector<HTMLElement>('.lab-sheet-panel-content');
  const body = positioner.querySelector<HTMLElement>('.lab-sheet-body');
  if (!surface || !content || !body) throw new Error('LabSheet: отсутствует содержимое панели');
  const measure = (selector: string): number => {
    const element = positioner.querySelector<HTMLElement>(selector);
    return element ? Number.parseFloat(view.getComputedStyle(element).height) : 0;
  };
  const gap = measure('.lab-sheet-gap');
  const bodyHeight = body.getBoundingClientRect().height;
  const headingHeight =
    positioner.querySelector('.lab-sheet-panel-heading')?.getBoundingClientRect().height ?? 0;
  const natural = bodyHeight + headingHeight;
  const bodyGap = bodyHeight > 0 && headingHeight > 0 ? gap : 0;
  const panelGap = natural > 0 ? 'var(--_sheet-gap)' : '0px';
  const contentGap = bodyGap > 0 ? 'var(--_sheet-gap)' : '0px';
  if (surface.style.getPropertyValue('--_sheet-panel-gap') !== panelGap)
    surface.style.setProperty('--_sheet-panel-gap', panelGap);
  if (content.style.getPropertyValue('--_sheet-body-gap') !== contentGap)
    content.style.setProperty('--_sheet-body-gap', contentGap);
  return sheetGeometry(
    positioner.getBoundingClientRect().height || view.innerHeight,
    measure('.lab-sheet-overlap'),
    {
      full: measure('.lab-sheet-preset-full'),
      'two-thirds': measure('.lab-sheet-preset-two-thirds'),
      'one-third': measure('.lab-sheet-preset-one-third'),
      flex:
        measure('.lab-sheet-handle') +
        Number.parseFloat(view.getComputedStyle(surface).paddingBottom) +
        (natural > 0 ? gap + natural + bodyGap : 0),
    },
  );
}
