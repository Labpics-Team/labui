import { describe, expect, it } from 'vitest';
import {
  closestSheetPosition,
  parseSheetPosition,
  sheetGeometry,
} from '../src/components/sheet/positions.js';

const heights = { full: 776, 'two-thirds': 540, 'one-third': 270, flex: 40 };

describe('позиции Sheet', () => {
  it('сохраняют измеренный viewport и фиксированные пресеты эталона', () => {
    expect(sheetGeometry(812, 32, heights).tops).toEqual({
      full: 36,
      'two-thirds': 272,
      half: 390,
      'one-third': 542,
      flex: 772,
    });
  });

  it('смена окна не превращает фиксированные высоты в viewport fractions', () => {
    expect(sheetGeometry(1000, 32, heights).tops).toEqual({
      full: 224,
      'two-thirds': 460,
      half: 484,
      'one-third': 730,
      flex: 960,
    });
  });

  it('ограничивают все высоты окном и сохраняют выбранный совпавший пресет', () => {
    const geometry = sheetGeometry(200, 32, heights);
    expect(Object.values(geometry.tops).every((top) => top >= 0 && top <= 200)).toBe(true);
    expect(closestSheetPosition(geometry, 0, 'two-thirds')).toBe('two-thirds');
    expect(closestSheetPosition(geometry, 195, 'half')).toBe('closed');
  });

  it('Flex зависит от содержимого, а Half — от масштабированного overlap', () => {
    const geometry = sheetGeometry(812, 64, { ...heights, flex: 120 });
    expect(geometry.tops.flex).toBe(692);
    expect(geometry.tops.half).toBe(374);
  });

  it('отклоняют неизвестный position и неконечную геометрию', () => {
    expect(() => parseSheetPosition('50%')).toThrow(TypeError);
    expect(() => sheetGeometry(Number.NaN, 32, heights)).toThrow(TypeError);
  });
});
