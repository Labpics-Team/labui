import { describe, expect, it } from 'vitest';
import { buildMotion } from '../src/motion/build.js';
import { defaultMotionConfig } from '../src/motion/config.js';
import { generateMotion } from '../src/motion/generate/index.js';

describe('характер переключения LabUI', () => {
  it('имеет собственную калибровку короткого пространственного движения', () => {
    const toggle = buildMotion(defaultMotionConfig).springs.find(
      (spring) => spring.name === 'toggle',
    );
    expect(toggle).toBeDefined();
    expect(toggle?.durationS).toBe(0.32);
    expect(toggle?.bounce).toBe(0.22);
    expect(toggle?.provenanceDuration.class).toBe('e');
  });

  it('передаёт runtime ту же физику, которую сериализует в CSS', () => {
    const toggle = buildMotion(defaultMotionConfig).springs.find(
      (spring) => spring.name === 'toggle',
    );
    expect(toggle).toBeDefined();
    const output = generateMotion(defaultMotionConfig).ts;
    expect(output).toContain('export const motionSpringRuntime =');
    expect(output).toContain(`response: ${(toggle?.durationS ?? 0) * 1000}`);
    expect(output).toContain(`bounce: ${toggle?.bounce}`);
  });
});
