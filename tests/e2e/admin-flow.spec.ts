import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';
import { setSkuStock, setSkuStatus, getSkuRow } from './db-helper';

// seed 固定：1101 小厨星煎锅 尺寸×规格；SKU 11011（24cm×单锅，库存 200）
// 1016 AirPods 第二代 有线充电盒版×耳机+硅胶保护套（10162，库存 45，¥889）用于发货流程
let orderNo = '';

test.describe.configure({ mode: 'serial' });

test.describe('P0-8 后台流程（管理员 UI 操作 → 前台生效）', () => {
  test.afterAll(async () => {
    // 恢复 fixture
    await setSkuStock(11011, 200);
    await setSkuStatus(11011, 'on');
  });

  test('买家先创建一笔已支付订单', async ({ page }) => {
    await page.goto('/p/1016');
    await page.getByTestId('option-版本-有线充电盒版').click();
    await page.getByTestId('option-套餐-耳机+硅胶保护套').click();
    await page.getByTestId('buy-now').click();
    await page.getByTestId('submit-order').click();
    await expect(page).toHaveURL(/\/pay\/ORD\d{18}/);
    orderNo = ((await page.getByTestId('pay-order-no').textContent()) ?? '').trim();
    await page.getByTestId('pay-success').click();
    await expect(page.getByTestId('order-detail-status')).toHaveText('待发货');
  });

  test.describe('管理员操作', () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test('搜索商品 → 改 SKU 库存为 1 → 前台详情显示「仅剩 1 件」', async ({ page }) => {
      await page.goto('/admin/products');
      await page.getByTestId('admin-product-search').fill('煎锅');
      await page.getByTestId('admin-product-search-btn').click();
      await expect(page.getByTestId('admin-product-total')).toHaveText('1');
      await page.getByTestId('admin-product-link').first().click();
      await expect(page).toHaveURL(/\/admin\/products\/1101/);
      const row = page.locator('[data-testid="admin-sku-row"][data-sku-id="11011"]');
      await row.getByTestId('sku-stock-input').fill('1');
      await row.getByTestId('sku-save').click();
      await expect(page.locator('[data-sonner-toast]').first()).toContainText('SKU 已更新');
      // 前台详情
      await page.goto('/p/1101');
      await page.getByTestId('option-尺寸-24cm').click();
      await page.getByTestId('option-规格-单锅').click();
      await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 1 件');
    });

    test('下架商品 → 前台 404 → 重新上架恢复', async ({ page }) => {
      await page.goto('/admin/products/1101');
      await page.getByTestId('product-status-toggle').click();
      await expect(page.locator('[data-sonner-toast]').first()).toContainText('已下架');
      await expect(page.getByTestId('admin-product-detail-status')).toHaveText('已下架');
      const res = await page.goto('/p/1101');
      expect(res?.status()).toBe(404);
      // 前台搜索也不出现
      await page.goto('/search?q=%E7%85%8E%E9%94%85');
      await expect(page.getByTestId('empty-state')).toBeVisible();
      // 恢复上架
      await page.goto('/admin/products/1101');
      await page.getByTestId('product-status-toggle').click();
      await expect(page.getByTestId('admin-product-detail-status')).toHaveText('在售');
      const ok = await page.goto('/p/1101');
      expect(ok?.status()).toBe(200);
    });

    test('订单列表筛选 PAID → 详情 → 模拟发货（填承运商/单号）', async ({ page }) => {
      await page.goto('/admin/orders?status=PAID');
      const row = page.locator(`[data-testid="admin-order-row"][data-order-no="${orderNo}"]`);
      await expect(row).toBeVisible();
      await row.getByTestId('admin-order-detail-link').click();
      await expect(page).toHaveURL(new RegExp(`/admin/orders/${orderNo}`));
      await page.getByTestId('ship-tracking-no').fill('SF-ADMIN-FLOW-001');
      await page.getByTestId('ship-submit').click();
      await expect(page.locator('[data-sonner-toast]').first()).toContainText('已发货');
      await expect(page.getByTestId('admin-order-detail-status')).toHaveText('待收货');
      await expect(page.getByTestId('admin-order-shipping')).toContainText('SF-ADMIN-FLOW-001');
    });

    test('后台统计卡片渲染且数值可读', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.getByTestId('stat-today-orders')).not.toHaveText('');
      await expect(page.getByTestId('stat-paid-gmv')).toContainText('¥');
      await expect(page.getByTestId('stat-pending-shipment')).not.toHaveText('');
      await expect(page.getByTestId('stat-soldout-skus')).not.toHaveText('');
      // 处理超时订单按钮可用
      await page.getByTestId('expire-orders-button').click();
      await expect(page.locator('[data-sonner-toast]').first()).toContainText('已处理');
    });
  });

  test('前台买家看到订单状态变为待收货（物流可见）', async ({ page }) => {
    await page.goto(`/orders/${orderNo}`);
    await expect(page.getByTestId('order-detail-status')).toHaveText('待收货');
    await expect(page.getByTestId('order-detail-shipping')).toContainText('SF-ADMIN-FLOW-001');
  });
});
