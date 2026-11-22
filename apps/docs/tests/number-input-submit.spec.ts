import { expect, test } from '@playwright/test';

for (const renderer of ['lit', 'react']) {
  test(`${renderer}: controlled Number rejects DOM edits and empty error retains invalidity`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const input = form.getByRole('spinbutton');
    await expect(input).toBeVisible();
    await page.evaluate((renderer) => {
      if (renderer === 'lit') window.inputExtensions.number.value = '5';
      else window.inputExtensions.updateReact({ number: { value: '5' } });
    }, renderer);
    await expect(input).toHaveValue('5');
    await form.evaluate((el) =>
      el.addEventListener('submit', (event) => {
        event.preventDefault();
        (el as HTMLFormElement).dataset.quantity = String(
          new FormData(el as HTMLFormElement).get('quantity'),
        );
      }),
    );
    await input.fill('123');
    await expect(input).toHaveValue('5');
    await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
    await expect(form).toHaveAttribute('data-quantity', '5');
    await page.evaluate((renderer) => {
      if (renderer === 'lit') {
        window.inputExtensions.number.invalid = true;
        window.inputExtensions.number.error = '';
      } else
        window.inputExtensions.updateReact({ number: { value: '5', invalid: true, error: '' } });
    }, renderer);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(await form.evaluate((el) => (el as HTMLFormElement).checkValidity())).toBe(false);
  });

  test(`${renderer}: Number commits bounds before Enter and validates direct submission`, async ({
    page,
  }) => {
    await page.goto('/_fixtures/input-extensions.html');
    const form = page.locator(renderer === 'lit' ? '#lit' : '#react-form');
    const input = form.getByRole('spinbutton');
    await expect(input).toBeVisible();
    await form.evaluate((element) => {
      const form = element as HTMLFormElement;
      const submitter = document.createElement('button');
      submitter.type = 'submit';
      submitter.name = 'action';
      submitter.value = 'save';
      submitter.textContent = 'Save';
      form.append(submitter);
      form.dataset.submissions = '0';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        form.dataset.submissions = String(Number(form.dataset.submissions) + 1);
        form.dataset.quantity = String(new FormData(form, event.submitter).get('quantity'));
        form.dataset.action = String(new FormData(form, event.submitter).get('action'));
      });
    });
    await page.evaluate((renderer) => {
      const form = document.querySelector<HTMLFormElement>(
        renderer === 'lit' ? '#lit' : '#react-form',
      );
      if (!form) throw new Error('Missing form fixture');
      if (renderer === 'lit') {
        window.inputExtensions.number.addEventListener('value-commit', (event) => {
          form.dataset.commit = (event as CustomEvent).detail.value;
        });
      } else {
        window.inputExtensions.updateReact({
          number: {
            onValueCommit: (value) => {
              form.dataset.commit = value;
            },
          },
        });
      }
    }, renderer);
    await input.fill('123');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(await form.evaluate((el) => (el as HTMLFormElement).checkValidity())).toBe(false);
    await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
    await expect(form).toHaveAttribute('data-submissions', '0');
    await input.press('Enter');
    await expect(input).toHaveValue('10');
    await expect(form).toHaveAttribute('data-commit', '10');
    await expect(form).toHaveAttribute('data-submissions', '1');
    await expect(form).toHaveAttribute('data-quantity', '10');
    await expect(form).toHaveAttribute('data-action', 'save');
    await expect(input).toBeFocused();
    await input.fill('-5');
    await input.press('Enter');
    await expect(form).toHaveAttribute('data-quantity', '0');
    await input.fill('-');
    expect(await form.evaluate((el) => (el as HTMLFormElement).checkValidity())).toBe(false);
    await input.fill('5');
    expect(await form.evaluate((el) => (el as HTMLFormElement).checkValidity())).toBe(true);
    await form.evaluate((el) =>
      el.addEventListener('keydown', (event) => event.preventDefault(), { once: true }),
    );
    await input.press('Enter');
    await expect(form).toHaveAttribute('data-submissions', '2');
    await input.press('Enter');
    await expect(form).toHaveAttribute('data-submissions', '3');
  });
}
