import { test, expect } from '@playwright/test';

test.describe('Kiosk Mode', () => {
  test('adds kiosk-mode class when ?kiosk param present', async ({ page }) => {
    await page.goto('/wall?kiosk');
    const hasClass = await page.evaluate(() =>
      document.documentElement.classList.contains('kiosk-mode'),
    );
    expect(hasClass).toBe(true);
  });

  test('does not add kiosk-mode class without param', async ({ page }) => {
    await page.goto('/wall');
    const hasClass = await page.evaluate(() =>
      document.documentElement.classList.contains('kiosk-mode'),
    );
    expect(hasClass).toBe(false);
  });

  test('kiosk mode hides cursor via CSS', async ({ page }) => {
    await page.goto('/wall?kiosk');
    const cursor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).cursor,
    );
    expect(cursor).toBe('none');
  });

  test('kiosk mode prevents text selection', async ({ page }) => {
    await page.goto('/input?kiosk');
    const userSelect = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return getComputedStyle(h1).userSelect;
    });
    expect(userSelect).toBe('none');
  });

  test('context menu is blocked in kiosk mode', async ({ page }) => {
    await page.goto('/wall?kiosk');
    const prevented = await page.evaluate(() => {
      let wasDefault = true;
      const handler = (e) => { wasDefault = !e.defaultPrevented; };
      document.addEventListener('contextmenu', handler);
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      document.removeEventListener('contextmenu', handler);
      return !wasDefault;
    });
    expect(prevented).toBe(true);
  });
});
