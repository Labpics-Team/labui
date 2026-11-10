import { type Locator, type Page, expect } from '@playwright/test';

/** Сравниваем установившуюся тему, а не два разных кадра её первого перехода. */
export async function waitForThemePaint(page: Page, ...targets: Locator[]): Promise<void> {
  await Promise.all(targets.map((target) => expect(target).toBeVisible()));
  await expect(page.locator('html')).toHaveAttribute('data-lab-colors-state', 'ready');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const roots: (Document | ShadowRoot)[] = [document];
        let active = 0;
        for (const root of roots) {
          for (const element of root.querySelectorAll('*')) {
            if (element.shadowRoot) roots.push(element.shadowRoot);
          }
          // Document.getAnimations() не включает переходы внутри shadow trees.
          for (const animation of root.getAnimations()) {
            const end = animation.effect?.getComputedTiming().endTime;
            if (
              typeof end === 'number' &&
              Number.isFinite(end) &&
              (animation.pending || animation.playState === 'running')
            )
              active++;
          }
        }
        return active;
      }),
    )
    .toBe(0);
}
