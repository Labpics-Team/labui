import { expect, test } from '@playwright/test';
import { waitForThemePaint } from './helpers/theme-paint.js';

test('theme paint waits for a late target and nested shadow transition beside an infinite animation', async ({
  page,
}) => {
  await page.goto('/button.html');
  await waitForThemePaint(page, page.getByTestId('react-accent-fill'));
  await page.evaluate(() => {
    setTimeout(() => {
      const host = document.createElement('div');
      const outer = host.attachShadow({ mode: 'open' });
      const nestedHost = document.createElement('div');
      outer.append(nestedHost);
      const inner = nestedHost.attachShadow({ mode: 'open' });
      const target = document.createElement('span');
      target.dataset.testid = 'late-theme-paint';
      target.textContent = 'Theme paint';
      target.style.cssText = 'color: rgb(1, 2, 3); transition: color 400ms linear 200ms';
      inner.append(target);
      document.body.append(host);
      // Layout establishes the initial paint before the real delayed CSS transition.
      getComputedStyle(target).color;
      target.style.color = 'rgb(201, 202, 203)';
      host.animate([{ opacity: 1 }, { opacity: 0.9 }], {
        duration: 1000,
        iterations: Number.POSITIVE_INFINITY,
      });
    }, 50);
  });

  const target = page.getByTestId('late-theme-paint');
  await waitForThemePaint(page, target);
  expect(await target.evaluate((element) => getComputedStyle(element).color)).toBe(
    'rgb(201, 202, 203)',
  );
  expect(
    await page.evaluate(() =>
      document
        .getAnimations()
        .some(
          (animation) =>
            animation.effect?.getComputedTiming().endTime === Number.POSITIVE_INFINITY &&
            animation.playState === 'running',
        ),
    ),
  ).toBe(true);
});
