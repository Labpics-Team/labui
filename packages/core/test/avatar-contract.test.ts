import { describe, expect, it } from 'vitest';
import {
  avatarColor,
  avatarInitials,
  avatarName,
  avatarStatus,
} from '../src/components/avatar/contract.js';

describe('Avatar meaning', () => {
  it('keeps full graphemes in names and explicit letter marks', () => {
    expect(avatarInitials('Даниил Иванов')).toBe('ДИ');
    expect(avatarInitials('A\u0301 Д')).toBe('A\u0301Д');
    expect(avatarInitials('👩🏽‍💻 Д')).toBe('👩🏽‍💻Д');
    expect(avatarInitials('Даниил', '')).toBe('');
    expect(avatarInitials('Даниил', 'ёжз')).toBe('ЁЖ');
  });
  it('keeps legacy aliases and ignores unsupported values without inventing presence', () => {
    expect(avatarColor('red')).toBe('red');
    expect(avatarColor('danger')).toBe('red');
    expect(avatarColor('constructor')).toBe('blue');
    expect(avatarStatus('toString')).toBe('none');
    expect(avatarName('Даниил', 'online')).toBe('Даниил, В сети');
    expect(avatarName('Даниил', 'online', 'Available')).toBe('Даниил, Available');
    expect(avatarName('', 'none')).toBe('Аватар');
  });
});
