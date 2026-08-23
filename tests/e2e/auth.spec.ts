import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import { loginViaUi, logoutViaUi } from './fixtures';

test.describe('P0-1 账号', () => {
  test.describe('未登录访客', () => {
    test.use({ storageState: STORAGE_STATE.anonymous });

    test('一键演示登录成功并显示昵称', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByTestId('login-form')).toBeVisible();
      await page.getByTestId('demo-login-buyer').click();
      await page.waitForURL('/');
      await expect(page.getByTestId('header-user-name')).toHaveText('演示买家');
    });

    test('邮箱密码登录成功；错误密码提示', async ({ page }) => {
      await page.goto('/login');
      await page.getByTestId('login-email').fill('demo@shop.local');
      await page.getByTestId('login-password').fill('wrong-password');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-error')).toContainText('邮箱或密码错误');
      await page.getByTestId('login-password').fill('Demo123456');
      await page.getByTestId('login-submit').click();
      await page.waitForURL('/');
      await expect(page.getByTestId('header-user-name')).toHaveText('演示买家');
    });

    test('未登录访问受保护页被重定向到登录页并带 next', async ({ page }) => {
      for (const path of ['/cart', '/checkout', '/orders', '/account/addresses']) {
        await page.goto(path);
        await expect(page).toHaveURL(
          new RegExp(
            `/login\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          ),
        );
      }
    });

    test('登录后回到 next 指定页面', async ({ page }) => {
      await loginViaUi(page, 'buyer', '/orders');
      await expect(page).toHaveURL(/\/orders$/);
    });
  });

  test('退出后访问 /orders 被重定向', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('header-user-name')).toHaveText('演示买家');
    await logoutViaUi(page);
    await expect(page).toHaveURL('/');
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
  });

  test('买家访问 /admin 看到 403', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(403);
    await expect(page.getByTestId('forbidden-code')).toHaveText('403');
  });

  test.describe('管理员', () => {
    test.use({ storageState: STORAGE_STATE.admin });
    test('管理员可访问 /admin', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.getByTestId('admin-title')).toBeVisible();
      await expect(page.getByTestId('admin-user-name')).toHaveText('演示管理员');
    });
  });
});
