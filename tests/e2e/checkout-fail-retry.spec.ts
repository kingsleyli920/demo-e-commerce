import { expect, test } from '@playwright/test';

// seed 固定：1016 AirPods 第二代 有线充电盒版×官方标配（10161，库存 160，¥849）
test.describe('P0-6 支付失败与重试', () => {
  test('支付失败 → 订单仍待付款 → 从订单列表「去支付」→ 成功', async ({ page }) => {
    await page.goto('/p/1016');
    await page.getByTestId('option-版本-有线充电盒版').click();
    await page.getByTestId('option-套餐-官方标配').click();
    await page.getByTestId('buy-now').click();
    await expect(page).toHaveURL(/\/checkout\?sku=10161&qty=1/);
    await page.getByTestId('submit-order').click();
    await expect(page).toHaveURL(/\/pay\/ORD\d{18}/);
    const orderNo = (await page.getByTestId('pay-order-no').textContent()) ?? '';

    // 模拟支付失败：停留在收银台可重试
    await page.getByTestId('pay-fail').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('支付失败');
    await expect(page).toHaveURL(new RegExp(`/pay/${orderNo}`));
    await expect(page.getByTestId('pay-success')).toBeEnabled();

    // 从订单列表待付款 Tab 进入「去支付」
    await page.goto('/orders?tab=PENDING_PAYMENT');
    const card = page.locator(`[data-testid="order-card"][data-order-no="${orderNo}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId('order-card-status')).toHaveText('待付款');
    await card.getByTestId('order-go-pay').click();
    await expect(page).toHaveURL(new RegExp(`/pay/${orderNo}`));
    await page.getByTestId('pay-success').click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderNo}`));
    await expect(page.getByTestId('order-detail-status')).toHaveText('待发货');
  });
});
