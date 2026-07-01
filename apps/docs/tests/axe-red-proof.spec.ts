/**
 * RED-at-birth proof: доказательство того, что axe-ассерт «кусается».
 *
 * Цель: убедиться, что `assertAxeAA` реально обнаруживает нарушения, а не
 * пропускает их молча. Посеянное нарушение → ассерт ОБНАРУЖИВАЕТ его.
 *
 * Метод (RED-proof через canary):
 *   1. Навигируем на известно-чистую страницу (/).
 *   2. Программно инжектируем нарушение WCAG 1.1.1 (SC A): <img> без alt.
 *   3. Запускаем axe — он ДОЛЖЕН найти violation с id="image-alt".
 *   4. Тест PASSES, если violations.length > 0 (детектор живой).
 *   5. Если violations.length === 0 — тест FAILS (детектор сломан или отключён).
 *
 * Это НЕ тест на accessibility компонента — это тест на работоспособность
 * axe-детектора (Mutation-класс Д по Фаулеру: «тест на тест»).
 *
 * Аналогично: `assertLabelContrast` проверяется встроенным посевом нарушения
 * (контраст 1:1 — белый текст на белом фоне), что гарантирует, что формула
 * WCAG contrast ratio возвращает реальное нарушение.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { assertLabelContrast } from './support/axe.js';

// ---------------------------------------------------------------------------
// Proof 1: axe обнаруживает посеянное структурное нарушение (image-alt)
// ---------------------------------------------------------------------------

test('axe-red-proof: посеянное нарушение image-alt обнаружено (детектор работает)', async ({
  page,
}) => {
  await page.goto('/');

  // Инжектируем посеянное нарушение WCAG 1.1.1 Level A:
  // <img> без атрибута alt — axe правило "image-alt" должно его поймать.
  // Используем data URI 1×1 GIF (настоящий img, не placeholder), чтобы
  // браузер считал изображение загруженным и axe точно его оценил.
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    // Намеренно НЕ устанавливаем alt — это и есть посеянное нарушение.
    img.setAttribute('data-axe-seed', 'red-proof');
    document.body.appendChild(img);
  });

  // Запускаем axe на всём документе (wcag2a достаточно для image-alt).
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Ищем именно image-alt (наше посеянное нарушение).
  const imageAltViolation = results.violations.find((v) => v.id === 'image-alt');

  expect(
    imageAltViolation,
    [
      'axe-red-proof FAIL: нарушение image-alt НЕ обнаружено.',
      'Это означает, что axe-детектор не работает или был отключён.',
      'Посеянный элемент: <img src="data:..." data-axe-seed="red-proof"> без alt.',
      `Все найденные violations: [${results.violations.map((v) => v.id).join(', ')}]`,
    ].join('\n'),
  ).toBeDefined();

  // Дополнительная гарантия: violations.length > 0 (не пустой список).
  expect(
    results.violations.length,
    'axe-red-proof FAIL: violations пустой, детектор слеп',
  ).toBeGreaterThan(0);

  // Проверяем, что нарушение найдено в нашем посеянном элементе.
  const seedNode = imageAltViolation?.nodes.find((n) =>
    n.html.includes('data-axe-seed="red-proof"'),
  );
  expect(
    seedNode,
    'axe-red-proof FAIL: нарушение найдено, но не на посеянном элементе',
  ).toBeDefined();
});

// ---------------------------------------------------------------------------
// Proof 2: assertLabelContrast обнаруживает нарушение контраста
// ---------------------------------------------------------------------------

test('axe-red-proof: assertLabelContrast обнаруживает контраст 1:1 (белый/белый)', async ({
  page,
}) => {
  await page.goto('/');

  // Инжектируем элемент с нарушением: белый текст на белом фоне (1:1).
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.setAttribute('data-axe-seed', 'contrast-red-proof');
    div.style.color = 'rgb(255, 255, 255)'; /* белый текст */
    div.style.backgroundColor = 'rgb(255, 255, 255)'; /* белый фон */
    div.textContent = 'Invisible';
    document.body.appendChild(div);
  });

  const seedEl = page.locator('[data-axe-seed="contrast-red-proof"]');
  await seedEl.waitFor();

  // assertLabelContrast ДОЛЖЕН упасть (expect throws) — отлавливаем через
  // try/catch и проверяем, что ошибка действительно была брошена.
  let threw = false;
  try {
    await assertLabelContrast(seedEl, seedEl);
  } catch {
    threw = true;
  }

  expect(
    threw,
    [
      'axe-red-proof FAIL: assertLabelContrast НЕ обнаружила нарушение контраста 1:1.',
      'Белый текст на белом фоне (1:1) должен приводить к ошибке assertion.',
      'Если этот тест зелёный — assertLabelContrast сломана или не кусается.',
    ].join('\n'),
  ).toBe(true);
});
