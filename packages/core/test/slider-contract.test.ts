import { describe, expect, it } from 'vitest';
import {
  SliderState,
  circularSliderFraction,
  linearSliderPosition,
  replaceSliderValue,
  sliderArc,
  sliderBounds,
  sliderValues,
} from '../src/components/slider/contract.js';

describe('authored Slider values', () => {
  it('retains uncontrolled values through mount lifetime and resets to its initial default', () => {
    const state = new SliderState();
    expect(state.values({ defaultValue: [30] })).toEqual([30]);
    state.accept({}, [72]);
    expect(state.values({ defaultValue: [10] })).toEqual([72]);
    state.reset({});
    expect(state.values({})).toEqual([30]);
  });
  it('never accepts an unacknowledged controlled request and can release control', () => {
    const state = new SliderState();
    const input = { value: [40], defaultValue: [20] };
    state.values(input);
    state.accept(input, [50]);
    state.reset(input);
    expect(state.values(input)).toEqual([40]);
    expect(state.values({ value: null })).toEqual([20]);
  });
  it('quantizes negative fractional domains at the global minimum and retains thumb identity', () => {
    const input = { min: -0.7, max: 1.3, step: 0.2 };
    expect(sliderValues(input, [-0.31, 0.91])).toEqual([-0.3, 0.9]);
    expect(replaceSliderValue([-0.3, 0.9], 0, 1.1, input)).toEqual([0.9, 0.9]);
    expect(replaceSliderValue([-0.3, 0.9], 1, -0.5, input)).toEqual([-0.3, -0.3]);
    expect(sliderValues({ min: 1e15, max: 1e15 + 4, step: 1 }, [1e15 + 1])).toEqual([1e15 + 1]);
    expect(sliderValues({ min: 0, max: 100, step: 30 }, [100])).toEqual([90]);
    expect(sliderValues({ min: 0, max: 0.3, step: 0.1 }, [0.3])).toEqual([0.3]);
  });
  it('clamps at the circular seam instead of wrapping to the other endpoint', () => {
    expect(circularSliderFraction(1, -100, 0.99)).toBeGreaterThan(0.99);
    expect(circularSliderFraction(1, -100, 1)).toBe(1);
    expect(circularSliderFraction(-1, -100, 0)).toBe(0);
    expect(circularSliderFraction(0, 0, 0.5)).toBeUndefined();
  });
  it('preserves the authored trailing-edge geometry and distinguishes full and empty arcs', () => {
    expect([0, 0.5, 1].map((fraction) => linearSliderPosition(fraction, 628))).toEqual([
      6, 308, 622,
    ]);
    expect(sliderArc(0, 0)).toBe('');
    expect(sliderArc(0, 1).match(/A/g)).toHaveLength(2);
  });
  it('rejects ambiguous or non-finite domains rather than producing broken CSS', () => {
    expect(() => sliderBounds({ min: 2, max: 1 })).toThrow(RangeError);
    expect(() => sliderValues({}, [Number.NaN])).toThrow(RangeError);
    expect(() => sliderValues({}, [80, 20])).toThrow(RangeError);
    expect(() => sliderValues({ variant: 'large' }, [0, 50])).toThrow(RangeError);
  });
});
