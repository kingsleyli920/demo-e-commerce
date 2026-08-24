import { expect, test } from '@playwright/test';
import { clearCartByEmail, deleteAddressesByEmail, getSkuRow } from './db-helper';

// seed 固定：1020 Beats Flex 运动蓝牙耳机 灰色×标准版（10203，库存 2，¥259）
// 流程覆盖：无地址 → 新增地址（回跳结算）→ 提交订单 → 支付页倒计时 → 模拟支付成功 → 订单详情待发货 → 详情页库存减少
const PRODUCT = '/p/1020';

test.describe('P0-6 结算与支付主路径', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await clearCartByEmail('demo@shop.local');
    await deleteAddressesByEmail('demo@shop.local');
  });

  test('无地址 → 提示新增 → 新增后回到结算 → 提交 → 支付成功 → 待发货，库存减少', async ({
    page,
  }) => {
    const before = await getSkuRow(10203);
    expect(before.stock).toBe(2);

    // 详情页确认低库存提示
    await page.goto(PRODUCT);
    await page.getByTestId('option-颜色-灰色').click();
    await page.getByTestId('option-版本-标准版').click();
    await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 2 件');
    await page.getByTestId('buy-now').click();
    await expect(page).toHaveURL(/\/checkout\?sku=10203&qty=1/);

    // 无地址提示 → 新增
    await expect(page.getByTestId('checkout-no-address')).toBeVisible();
    await page.getByTestId('go-add-address').click();
    await expect(page).toHaveURL(/\/account\/addresses\?next=/);
    await page.getByTestId('address-add').click();
    await page.getByTestId('address-receiver').fill('端到端买家');
    await page.getByTestId('address-phone').fill('13900001234');
    await page.getByTestId('address-detail').fill('测试大道 88 号 501 室');
    await page.getByTestId('address-save').click();
    // 保存后回跳结算页
    await expect(page).toHaveURL(/\/checkout\?sku=10203&qty=1/);
    await expect(page.getByTestId('checkout-form')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('¥259.00');
    await expect(page.getByTestId('checkout-freight')).toContainText('免运费');
    await expect(page.getByTestId('checkout-pay-amount')).toHaveText('¥259.00');

    // 提交订单 → 收银台
    await page.getByTestId('submit-order').click();
    await expect(page).toHaveURL(/\/pay\/ORD\d{18}/);
    await expect(page.getByTestId('pay-amount')).toHaveText('¥259.00');
    await expect(page.getByTestId('pay-countdown')).toContainText(':');
    const orderNo = (await page.getByTestId('pay-order-no').textContent()) ?? '';

    // 模拟支付成功 → 订单详情待发货
    await page.getByTestId('pay-success').click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderNo}`));
    await expect(page.getByTestId('order-detail-status')).toHaveText('待发货');
    await expect(page.getByTestId('order-detail-pay-amount')).toHaveText('¥259.00');

    // 库存扣减：详情页显示仅剩 1 件
    await page.goto(PRODUCT);
    await page.getByTestId('option-颜色-灰色').click();
    await page.getByTestId('option-版本-标准版').click();
    await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 1 件');
    const after = await getSkuRow(10203);
    expect(after).toMatchObject({ stock: 1, lockedStock: 0 });
  });
});
