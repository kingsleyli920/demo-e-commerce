import { expect, type Page } from '@playwright/test';

export type DemoRole = 'buyer' | 'admin';

/** 通过登录页「一键演示登录」按钮登录（真实 UI 路径） */
export async function loginViaUi(page: Page, role: DemoRole, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByTestId(role === 'buyer' ? 'demo-login-buyer' : 'demo-login-admin').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export async function logoutViaUi(page: Page) {
  await page.getByTestId('header-user-menu').click();
  await page.getByTestId('header-logout').click();
  await expect(page.getByTestId('header-login-link')).toBeVisible();
}

/** 金额文本 "¥1,234.50" → 分 */
export function parsePriceText(text: string): number {
  const n = Number(text.replace(/[^\d.]/g, ''));
  return Math.round(n * 100);
}
