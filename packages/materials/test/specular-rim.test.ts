import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';

// Механические параметры и источники цвета. Рендерное равенство старого и
// наследуемого контекста отдельно проверяется в Chromium/WebKit по пикселям.
const css = readMaterialCss();

function blockBody(header: RegExp): string {
  const start = css.search(header);
  expect(start, `блок ${header} присутствует`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

const surface = blockBody(/\.lab-material\s*\{/);
const ring = blockBody(/\.lab-material::before\s*\{/);
const reset = blockBody(/:where\(\[data-material\]\)\s*\{/);

describe('локальный specular rim и наследуемый физический контекст', () => {
  it('рим остаётся вне заливки поверхности', () => {
    const background = surface.match(/background:\s*([^;]+);/)?.[1] ?? '';
    expect(background).toContain('var(--_noise, none)');
    expect(background).toContain('linear-gradient(var(--_tint), var(--_tint))');
    expect(background).toContain('var(--_base-paint, var(--_base))');
    expect(background).not.toContain('--_rim');
  });

  it('ринг сохраняет 1px внутреннюю маску, скругление и отсутствие hit-test', () => {
    expect(ring).toContain('background: var(--_rim, none)');
    expect(ring).toContain('border-radius: inherit');
    expect(ring).toContain('padding: 1px');
    expect(ring).toContain('mask-composite: exclude');
    expect(ring).toContain('-webkit-mask-composite: xor');
    expect(ring).toContain('pointer-events: none');
  });

  it('без контекста рим невидим, глобальный root-default не требуется', () => {
    expect(ring).toContain('opacity: var(--_material-active, 0)');
    expect(css).not.toMatch(/:root\s*\{/);
  });

  it.each(['glass', 'acrylic'])('%s включает рим через физическую долю live', (mode) => {
    const body = blockBody(new RegExp(`\\[data-material="${mode}"\\]\\s*\\{\\s*--_material-mode:`));
    expect(body).toContain('--_material-live: 1');
    expect(body).not.toContain('--_rim:');
  });

  it('любой новый явный контекст сначала выключает рим, включая unknown/empty', () => {
    expect(reset).toContain('--_material-live: 0');
    expect(reset).toContain('--_material-mode: solid');
  });

  it('тема наследует доли рима и сбрасывается у ближайшего явного theme', () => {
    const light = blockBody(/\[data-theme\]\s*\{/);
    const dark = blockBody(/\[data-theme="dark"\]\s*\{/);
    expect(light).toContain('--_rim-top: 50%');
    expect(light).toContain('--_rim-bottom: 5%');
    expect(light).toContain('--_rim-bottom-dark: 0%');
    expect(dark).toContain('--_rim-top: 12%');
    expect(dark).toContain('--_rim-bottom: 4%');
    expect(dark).toContain('--_rim-bottom-dark: 100%');
    expect(css).toContain(':host([data-theme])');
    expect(css).toContain(':host([data-theme="dark"])');
  });

  it('цвета рима разрешаются на поверхности из её semantic static-токенов', () => {
    const rim = surface.match(/--_rim:\s*([^;]+);/)?.[1] ?? '';
    expect(rim).toContain('var(--lab-bg-static-light)');
    expect(rim).toContain('var(--lab-bg-static-dark)');
    expect(rim).toContain('var(--_rim-top, 50%)');
    expect(rim).toContain('var(--_rim-bottom, 5%)');
    expect(rim).not.toMatch(/#[0-9a-f]{3,8}\b|(?<![-\w])rgba?\(|oklch\(|hsla?\(/i);
  });
});
