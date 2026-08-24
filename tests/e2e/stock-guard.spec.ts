import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import { cancelPendingOrderByNo, getSkuRow, setSkuStock } from './db-helper';

// seed 固定：1018 AirPods Max 银色×标准版（10183，库存 12，¥3,899）
// 后台把库存改为 1（M4 起走后台 UI），买家 A 下单成功后买家 B（管理员账号当第二买家）下单提示库存不足
test.describe('P0-4 库存护栏（改库存为 1，两人抢购只成一单）', () => {
  let orderNo = '';

  test.afterAll(async () => {
    if (orderNo) await cancelPendingOrderByNo(orderNo);
    await setSkuStock(10183, 12);
  });

  test('买家 A 下单成功', async ({ page }) => {
    await setSkuStock(10183, 1);
    await page.goto('/p/1018');
    await page.getByTestId('option-颜色-银色').click();
    await page.getByTestId('option-版本-标准版').click();
    await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 1 件');
    await page.getByTestId('buy-now').click();
    await page.getByTestId('submit-order').click();
    await expect(page).toHaveURL(/\/pay\/ORD\d{18}/);
    orderNo = ((await page.getByTestId('pay-order-no').textContent()) ?? '').trim();
    const sku = await getSkuRow(10183);
    expect(sku).toMatchObject({ stock: 1, lockedStock: 1 });
  });

  test.describe('买家 B（第二账号）', () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test('同 SKU 下单提示库存不足', async ({ page }) => {
      await page.goto('/p/1018');
      await page.getByTestId('option-颜色-银色').click();
      await page.getByTestId('option-版本-标准版').click();
      // 详情页已显示售罄（可售 = 1 - 1 = 0），按钮禁用即为「不可下单」
      await expect(page.getByTestId('stock-hint')).toHaveText('已售罄');
      await expect(page.getByTestId('add-to-cart')).toBeDisabled();
      await expect(page.getByTestId('buy-now')).toBeDisabled();
      // 绕过 UI 直接访问结算链接 → 服务端拒绝
      await page.goto('/checkout?sku=10183&qty=1');
      await expect(page.getByTestId('checkout-error')).toContainText('库存不足');
    });
  });
});
