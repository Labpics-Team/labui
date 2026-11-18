import { describe, expect, it } from 'vitest';
import { progressState, progressValueConverter } from '../src/components/progress/contract.js';

describe('measured progress', () => {
  it('preserves the value range and clamps only to its limits', () => {
    expect(progressState(30, 10, 50)).toMatchObject({ value: 30, fraction: 0.5, text: '50%' });
    expect(progressState(5, 10, 50)).toMatchObject({ value: 10, fraction: 0 });
    expect(progressState(60, 10, 50)).toMatchObject({ value: 50, fraction: 1, status: 'complete' });
    expect(progressState(25.25)).toMatchObject({ value: 25.25, fraction: 0.2525, text: '25%' });
  });
  it('keeps zero determinate and unknown inputs without a fabricated percentage', () => {
    expect(progressState(0)).toMatchObject({ value: 0, text: '0%', status: 'loading' });
    for (const value of [
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ])
      expect(progressState(value)).toMatchObject({
        value: null,
        text: '',
        status: 'indeterminate',
      });
    for (const [min, max] of [
      [10, 10],
      [20, 10],
      [Number.NaN, 100],
      [0, Number.POSITIVE_INFINITY],
    ])
      expect(progressState(20, min, max)).toMatchObject({ value: null, text: '' });
  });
  it('does not overflow a finite range whose span exceeds the floating point maximum', () => {
    expect(progressState(0, -Number.MAX_VALUE, Number.MAX_VALUE)).toMatchObject({
      value: 0,
      fraction: 0.5,
      text: '50%',
    });
    expect(progressState(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE).fraction).toBe(1);
    expect(progressState(1 + Number.EPSILON, 1, 1 + Number.EPSILON * 2).fraction).toBe(0.5);
  });
  it('parses reflected values without turning omission into zero', () => {
    for (const value of [null, '', 'null', 'Infinity', 'bad'])
      expect(progressValueConverter.fromAttribute(value)).toBeNull();
    expect(progressValueConverter.fromAttribute('0')).toBe(0);
    expect(progressValueConverter.fromAttribute(progressValueConverter.toAttribute(25.25))).toBe(
      25.25,
    );
  });
});
