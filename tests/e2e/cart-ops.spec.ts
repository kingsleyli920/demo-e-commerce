import { expect, test } from '@playwright/test';
import { clearCartByEmail, setSkuStatus } from './db-helper';

// seed 固定：1018 AirPods Max 颜色×版本；黑色×标准版(10181, 库存 30)、天蓝色×标准版(10184, 库存 2)
// 1019 Beats Flex 礼盒装×蓝色(10196, 库存 12) 用于「后台下架 → 购物车失效」
const PRODUCT = '/p/1018';

test.describe('P0-5 购物车操作', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await clearCartByEmail('demo@shop.local');
  });

  test.afterAll(async () => {
    await setSkuStatus(10196, 'on');
    await clearCartByEmail('demo@shop.local');
  });

  test('两次加购同 SKU 数量合并为 2', async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByTestId('option-颜色-黑色').click();
    await page.getByTestId('option-版本-标准版').click();
    await page.getByTestId('add-to-cart').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已加入购物车');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('header-cart-badge')).toHaveText('2');
    await page.goto('/cart');
    await expect(page.getByTestId('cart-row')).toHaveCount(1);
    await expect(page.getByTestId('cart-qty-value')).toHaveText('2');
  });

  test('改数量到超库存被钳制并提示', async ({ page }) => {
    // 天蓝色×标准版 库存 2
    await page.goto(PRODUCT);
    await page.getByTestId('option-颜色-天蓝色').click();
    await page.getByTestId('option-版本-标准版').click();
    await page.getByTestId('qty-plus').click(); // 数量 2
    await page.getByTestId('add-to-cart').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已加入购物车');
    await page.goto('/cart');
    const row = page.getByTestId('cart-row').filter({ has: page.locator('[data-sku-id="10184"]') });
    const qtyRow = page.locator('[data-testid="cart-row"][data-sku-id="10184"]');
    await expect(qtyRow.getByTestId('cart-qty-value')).toHaveText('2');
    await qtyRow.getByTestId('cart-qty-plus').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已按可售库存调整');
    await expect(qtyRow.getByTestId('cart-qty-value')).toHaveText('2');
    void row;
  });

  test('取消勾选后合计变化；全选恢复', async ({ page }) => {
    await page.goto('/cart');
    const totalBefore = await page.getByTestId('cart-total').textContent();
    const blackRow = page.locator('[data-testid="cart-row"][data-sku-id="10181"]');
    await blackRow.getByTestId('cart-row-checkbox').click();
    await expect(page.getByTestId('cart-total')).not.toHaveText(totalBefore ?? '');
    // 全选
    await page.getByTestId('cart-select-all').click();
    await expect(page.getByTestId('cart-total')).toHaveText(totalBefore ?? '');
  });

  test('删除行', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByTestId('cart-row')).toHaveCount(2);
    await page
      .locator('[data-testid="cart-row"][data-sku-id="10184"]')
      .getByTestId('cart-row-remove')
      .click();
    await expect(page.getByTestId('cart-row')).toHaveCount(1);
  });

  test('后台下架 SKU 后：购物车显示失效、不可勾选、不计合计', async ({ page }) => {
    // 加购 1019 礼盒装×蓝色（10196）
    await page.goto('/p/1019');
    await page.getByTestId('option-颜色-蓝色').click();
    await page.getByTestId('option-版本-礼盒装').click();
    await page.getByTestId('add-to-cart').click();
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('已加入购物车');
    // 后台下架（M4 起走后台 UI）
    await setSkuStatus(10196, 'off');
    await page.goto('/cart');
    await expect(page.getByTestId('cart-invalid-section')).toBeVisible();
    const invalidRow = page.locator('[data-testid="cart-invalid-row"][data-sku-id="10196"]');
    await expect(invalidRow.getByTestId('invalid-badge')).toHaveText('已下架');
    await expect(invalidRow.getByTestId('cart-row-checkbox')).toBeDisabled();
    // 合计只含有效勾选项（10181 黑色×标准版 ×2 = ¥7,798.00）
    await expect(page.getByTestId('cart-total')).toHaveText('¥7,798.00');
    // 失效项可删除
    await invalidRow.getByTestId('cart-row-remove').click();
    await expect(page.getByTestId('cart-invalid-section')).toBeHidden();
  });
});
