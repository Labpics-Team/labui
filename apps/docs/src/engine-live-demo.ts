/*
 * Live engine demo — рантайм-провайдер.
 *
 * Живой WASM-движок в браузере: паспорт labui загружается конфигом,
 * watchTheme держит переменные поверхности в синхроне с её ФАКТИЧЕСКИМ фоном
 * (закон системы: роль решается от фона, а не от имени темы). Переключение
 * конфига на «acme» доказывает канал кастомизации: тот же словарь ролей,
 * чужие якоря бренда — компоненты перекрашиваются без единой правки.
 *
 * `labcolors-engine` — npm-алиас настоящего @labpics/colors (имя в workspace
 * пока занято стаб-пакетом CSS-контракта; алиас умрёт вместе со стабом).
 */
import '@labpics/ui-core/badge';
import '@labpics/ui-core/button';
// Паспорт labui — тот же JSON, что питает golden-сверку пакета @labui/colors.
import passport from '@labui/colors/labui.config.json';
import init, { LabColors, watchTheme } from 'labcolors-engine';
import wasmUrl from 'labcolors-engine/pkg/labcolors_bg.wasm?url';

/** Обязательный узел демо: отсутствие — честная ошибка, не молчаливый null. */
function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`engine-live.html: нет узла ${selector}`);
  return el;
}
const surface = mustFind<HTMLElement>('#live-surface');
const bgInput = mustFind<HTMLInputElement>('#live-bg');
const themeSelect = mustFind<HTMLSelectElement>('#live-theme');
const configSelect = mustFind<HTMLSelectElement>('#live-config');
const status = mustFind<HTMLOutputElement>('#live-status');

// Acme — «клиент студии»: тот же словарь ролей, свои якоря идентичности.
// Бренд уезжает в фиолетовый; всё остальное (нейтраль, палитра, сентименты,
// роли) — наследие паспорта: кастомизация = замена ИЗМЕРЕННЫХ якорей, не
// переписывание семантики.
function acmeConfig(): unknown {
  const acme = structuredClone(passport) as {
    brand: { light: string; dark: string; light_ic: string; dark_ic: string };
  };
  acme.brand = {
    light: '#7C3AED',
    dark: '#8B5CF6',
    light_ic: '#5B21B6',
    dark_ic: '#A78BFA',
  };
  return acme;
}

// Без top-level await: цель сборки docs — es2020.
async function main(): Promise<void> {
  // Дефолт фона — светлая опора паспорта, не хардкод разметки.
  bgInput.value = (passport as { neutral: { anchors: { light: string } } }).neutral.anchors.light.toLowerCase();
  await init({ module_or_path: wasmUrl });
  const colors = new LabColors();
  colors.loadConfig(JSON.stringify(passport));

  const watcher = watchTheme(surface, {
    colors,
    theme: themeSelect.value as 'light' | 'dark',
    // Фон демо-поверхности задаёт пользователь — он и есть истина резолва.
    background: () => bgInput.value,
  });

  function repaint(): void {
    surface.style.background = bgInput.value;
    const applied = watcher.refresh(true);
    status.value = applied
      ? `фон ${watcher.background()} · тема ${themeSelect.value} · конфиг ${configSelect.value}`
      : 'фон не изменился';
  }

  bgInput.addEventListener('input', repaint);
  themeSelect.addEventListener('change', () => {
    // Select несёт только light|dark (см. engine-live.html) — сужение честное.
    watcher.setTheme(themeSelect.value as 'light' | 'dark');
    repaint();
  });
  configSelect.addEventListener('change', () => {
    const config = configSelect.value === 'acme' ? acmeConfig() : passport;
    colors.loadConfig(JSON.stringify(config));
    repaint();
  });

  repaint();
}

main().catch((err) => {
  // Честная ошибка вместо вечной «загрузки…»: e2e-boot-гейт увидит текст.
  status.value = `ошибка движка: ${err instanceof Error ? err.message : String(err)}`;
});
