import { expect, test } from '@playwright/test';
import { getSkuRow, setSkuPrice, shipOrderByNo } from './db-helper';

// seed 固定：1016 AirPods 第二代 无线充电盒版×官方标配（10163，库存 38，¥1,049）
test.describe('P0-7 订单生命周期', () => {
  test.describe.configure({ mode: 'serial' });

  async function buyNow(page: import('@playwright/test').Page): Promise<string> {
    await page.goto('/p/1016');
    await page.getByTestId('option-版本-无线充电盒版').click();
    await page.getByTestId('option-套餐-官方标配').click();
    await page.getByTestId('buy-now').click();
    await page.getByTestId('submit-order').click();
    await expect(page).toHaveURL(/\/pay\/ORD\d{18}/);
    return ((await page.getByTestId('pay-order-no').textContent()) ?? '').trim();
  }

  test('待付款取消 → 已取消 Tab（库存释放）', async ({ page }) => {
    const before = await getSkuRow(10163);
    const orderNo = await buyNow(page);
    await page.goto('/orders');
    const card = page.locator(`[data-testid="order-card"][data-order-no="${orderNo}"]`);
    await card.getByTestId('order-cancel').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已取消');
    await page.goto('/orders?tab=CANCELLED');
    await expect(
      page.locator(`[data-testid="order-card"][data-order-no="${orderNo}"]`),
    ).toBeVisible();
    const after = await getSkuRow(10163);
    expect(after.lockedStock).toBe(before.lockedStock);
  });

  test('已支付 → 管理员发货 → 待收货 → 确认收货 → 已完成', async ({ page }) => {
    const orderNo = await buyNow(page);
    await page.getByTestId('pay-success').click();
    await expect(page.getByTestId('order-detail-status')).toHaveText('待发货');

    // 管理员发货（M3 用服务等价操作模拟，M4 admin-flow 走后台 UI）
    await shipOrderByNo(orderNo, '顺丰速运', 'SF-LIFECYCLE');
    await page.reload();
    await expect(page.getByTestId('order-detail-status')).toHaveText('待收货');
    await expect(page.getByTestId('order-detail-shipping')).toContainText('顺丰速运');

    // 确认收货
    await page.getByTestId('order-confirm-receipt').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已确认收货');
    await expect(page.getByTestId('order-detail-status')).toHaveText('已完成');
    await page.goto('/orders?tab=COMPLETED');
    await expect(
      page.locator(`[data-testid="order-card"][data-order-no="${orderNo}"]`),
    ).toBeVisible();
  });

  test('商品改价后旧订单金额不变（快照）', async ({ page }) => {
    await buyNow(page);
    await page.getByTestId('pay-success').click();
    await expect(page.getByTestId('order-detail-pay-amount')).toHaveText('¥1,049.00');
    const { price } = await getSkuRow(10163);
    try {
      await setSkuPrice(10163, 999900);
      await page.reload();
      await expect(page.getByTestId('order-detail-pay-amount')).toHaveText('¥1,049.00');
      await expect(page.getByTestId('order-item-price').first()).toHaveText('¥1,049.00');
    } finally {
      await setSkuPrice(10163, price);
    }
  });
});
