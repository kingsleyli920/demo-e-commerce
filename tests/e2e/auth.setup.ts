import { execSync } from 'node:child_process';
import { expect, test as setup } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import { loginViaUi } from './fixtures';

setup('重置 seed 数据', async () => {
  // E2E 对 DATABASE_URL（开发库）运行完整 seed，保证每次用例数据一致
  execSync('pnpm db:seed', { stdio: 'inherit' });
});

setup('登录买家并保存会话', async ({ page }) => {
  await loginViaUi(page, 'buyer');
  await expect(page.getByTestId('header-user-name')).toHaveText('演示买家');
  await page.context().storageState({ path: STORAGE_STATE.buyer });
});

setup('登录管理员并保存会话', async ({ page }) => {
  await loginViaUi(page, 'admin');
  await expect(page.getByTestId('admin-user-name')).toHaveText('演示管理员');
  await page.context().storageState({ path: STORAGE_STATE.admin });
});
