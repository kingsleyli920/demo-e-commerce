import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

test.describe('P0-8 后台守卫', () => {
  test('买家访问 /admin 与 /admin/products 均 403', async ({ page }) => {
    for (const path of ['/admin', '/admin/products', '/admin/orders']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(403);
      await expect(page.getByTestId('forbidden-code')).toHaveText('403');
    }
  });

  test.describe('未登录', () => {
    test.use({ storageState: STORAGE_STATE.anonymous });
    test('未登录访问 /admin 302 到登录页', async ({ page }) => {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
      await page.goto('/admin/orders');
      await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Forders/);
    });
  });
});
