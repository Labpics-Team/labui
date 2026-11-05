import assert from 'node:assert/strict';
import { POLICY_CASES, POLICY_SCHEMA } from './sheet-policy.mjs';

const size = (width, height) => ({ width, height });
const viewport = (width, height) => ({
  loaded: true,
  visibility: 'visible',
  actualWidth: width,
  actualHeight: height,
  viewportWidth: width,
  viewportHeight: height,
  extentWidth: width,
  extentHeight: height,
  scrollableWidth: 0,
  scrollableHeight: 0,
  sizesContentToTemplatedParent: true,
});
const root = (kind, height, measureHeight = height) => ({
  kind,
  loaded: true,
  heightIsAuto: true,
  lastMeasure: size(343, measureHeight),
  unboundedWidth: false,
  unboundedHeight: false,
  actual: size(343, height),
  desired: size(200, 58),
  layoutSlot: { x: 0, y: 0, width: 343, height },
});
const selector = (index) => {
  const itemACalls = [1, 1, 1, 2, 2][index];
  const itemBCalls = [0, 1, 2, 2, 2][index];
  const calls = itemACalls + itemBCalls;
  return {
    calls,
    ownerCalls: calls,
    otherCalls: 0,
    itemACalls,
    itemBCalls,
    otherItemCalls: 0,
    singleArgumentCalls: 0,
    sameSelector: true,
    rootMatchesContent: true,
    generatedRootChanged: index === 0 ? null : index !== 4,
  };
};
const replacement = (mutated) => ({
  sheetTemplatesDiffer: true,
  viewportsDiffer: true,
  contentPresentersDiffer: true,
  scrollPresentersDiffer: true,
  retiredViewportLoaded: false,
  retiredContentPresenterLoaded: false,
  retiredContentCleared: true,
  retiredContentTemplateCleared: true,
  retiredTemplateChanged: mutated,
  retiredScrollPresentersDiffer: mutated,
  activeContentPreserved: true,
  retiredSizesContentToTemplatedParent: !mutated,
});

// Инертные JSON-контроли: естественная высота 58 выбрана для теста, native execution не заявляется.
export function policyWitness(entry = POLICY_CASES[0]) {
  const scenario = typeof entry === 'string' ? entry : entry?.scenario;
  assert.ok(
    ['selector-retirement', 'flex-recovery'].includes(scenario),
    'sheet policy fixture: сценарий',
  );
  const steps =
    scenario === 'selector-retirement'
      ? ['initial-a', 'content-b', 'sheet-template', 'content-a', 'retired-viewport-template'].map(
          (phase, index) => ({
            phase,
            contentIsNull: false,
            contentIsUiElement: false,
            bodyHeight: 422,
            viewport: viewport(343, 358),
            root: root(['a', 'b', 'b', 'a', 'a'][index], 358),
            selector: selector(index),
            replacement: index < 2 ? null : replacement(index === 4),
          }),
        )
      : [
          {
            phase: 'empty',
            contentIsNull: true,
            contentIsUiElement: false,
            bodyHeight: 40,
            viewport: { ...viewport(0, 0), loaded: false, visibility: 'collapsed' },
            root: null,
            selector: null,
            replacement: null,
          },
          {
            phase: 'recovered',
            contentIsNull: false,
            contentIsUiElement: true,
            bodyHeight: 122,
            viewport: viewport(343, 58),
            root: root('auto', 58, 748),
            selector: null,
            replacement: null,
          },
        ];
  return {
    schema: POLICY_SCHEMA,
    scenario,
    status: 'complete',
    phase: steps.at(-1).phase,
    failure: null,
    steps,
  };
}
