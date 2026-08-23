import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import { clearCartByEmail } from './db-helper';

// M4 冒烟：首页 → 搜索 → 详情选规格 → 加购 → 购物车 → 结算 → 支付 → 待发货 → 后台发货 → 确认收货 → 已完成
// seed 固定：1019 Beats Flex 颈挂式 黑色×标准版（10191，库存 210，¥299）
let orderNo = '';

test.describe.configure({ mode: 'serial' });

test.describe('full-journey 全链路冒烟', () => {
  test.beforeAll(async () => {
    await clearCartByEmail('demo@shop.local');
  });

  test('买家：首页 → 搜索 → 详情 → 加购 → 购物车结算 → 支付成功', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('featured-products')).toBeVisible();
    await page.getByTestId('search-input').first().fill('耳机');
    await page.getByTestId('search-input').first().press('Enter');
    await page.getByTestId('product-card').filter({ hasText: 'Beats Flex 颈挂式' }).first().click();
    await expect(page).toHaveURL(/\/p\/1019/);
    await page.getByTestId('option-颜色-黑色').click();
    await page.getByTestId('option-版本-标准版').click();
    await page.getByTestId('add-to-cart').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已加入购物车');
    await page.getByTestId('header-cart-link').click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator('[data-testid="cart-row"][data-sku-id="10191"]')).toBeVisible();
    await page.getByTestId('go-checkout').click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByTestId('checkout-total')).toHaveText('¥299.00');
    await page.getByTestId('submit-order').click();
    await expect(page).toHaveURL(/\/pay\/ORD\d{18}/);
    orderNo = ((await page.getByTestId('pay-order-no').textContent()) ?? '').trim();
    await page.getByTestId('pay-success').click();
    await expect(page.getByTestId('order-detail-status')).toHaveText('待发货');
    // 购物车已清空该条目
    await page.goto('/cart');
    await expect(page.locator('[data-testid="cart-row"][data-sku-id="10191"]')).toBeHidden();
  });

  test.describe('管理员发货', () => {
    test.use({ storageState: STORAGE_STATE.admin });
    test('后台发货', async ({ page }) => {
      await page.goto(`/admin/orders/${orderNo}`);
      await page.getByTestId('ship-submit').click();
      await expect(page.getByTestId('admin-order-detail-status')).toHaveText('待收货');
    });
  });

  test('买家：确认收货 → 已完成', async ({ page }) => {
    await page.goto(`/orders/${orderNo}`);
    await expect(page.getByTestId('order-detail-status')).toHaveText('待收货');
    await page.getByTestId('order-confirm-receipt').click();
    await expect(page.getByTestId('order-detail-status')).toHaveText('已完成');
    await page.goto('/orders?tab=COMPLETED');
    await expect(
      page.locator(`[data-testid="order-card"][data-order-no="${orderNo}"]`),
    ).toBeVisible();
  });
});
