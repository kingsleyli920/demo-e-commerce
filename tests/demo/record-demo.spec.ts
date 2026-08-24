/**
 * 3–5 分钟关键流程录屏（docs/plan/01 §2）：单窗口全程叙事，产出单一 video.webm。
 * 覆盖：产品闭环主路径 + 库存护栏演示（A 锁定库存后 B 账号购买被拒；50 并发测试数据见结尾速览页）
 * + 提交历史 / AI_WORKFLOW 速览（约 30 秒）。
 * 运行：pnpm demo:record；产物：test-results/demo-video/*.webm → docs/screenshots/demo-p0-key-flows.webm
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

async function login(page: Page, role: 'buyer' | 'admin') {
  await page.goto('/login');
  await pause(page, 1500);
  await page.getByTestId(role === 'buyer' ? 'demo-login-buyer' : 'demo-login-admin').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function logout(page: Page) {
  await page.goto('/');
  await page.getByTestId('header-user-menu').click();
  await pause(page, 600);
  await page.getByTestId('header-logout').click();
  await expect(page.getByTestId('header-login-link')).toBeVisible();
}

test('P0 关键流程演示录屏', async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  execSync('pnpm db:seed', { stdio: 'ignore' });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'test-results/demo-video', size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();

  // 1) 一键演示登录（买家）→ 首页
  await login(page, 'buyer');
  await expect(page.getByTestId('header-user-name')).toHaveText('演示买家');
  await page.screenshot({ path: `${SHOTS}/01-home.png` });
  await pause(page, 6000);
  await page.mouse.wheel(0, 500);
  await pause(page, 4000);
  await page.mouse.wheel(0, -500);

  // 2) 搜索「耳机」→ 价格升序
  await page.getByTestId('search-input').first().fill('耳机');
  await pause(page, 800);
  await page.getByTestId('search-input').first().press('Enter');
  await page.waitForURL(/\/search/);
  await pause(page, 5000);
  await page.getByTestId('sort-price_asc').click();
  await pause(page, 5000);
  await page.screenshot({ path: `${SHOTS}/02-search.png` });

  // 3) 详情：图集 / 选「黑色 / 标准版」/ 库存提示
  await page.goto('/p/1019');
  await pause(page, 6500);
  await page.getByTestId('option-颜色-黑色').click();
  await pause(page, 1200);
  await page.getByTestId('option-版本-标准版').click();
  await expect(page.getByTestId('sku-price')).toHaveText('¥299.00');
  await pause(page, 1500);
  // 展示置灰与低库存
  await page.getByTestId('option-颜色-灰色').click();
  await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 3 件');
  await pause(page, 3500);
  await page.getByTestId('option-颜色-黑色').click();
  await page.screenshot({ path: `${SHOTS}/03-pdp.png` });
  await pause(page, 1500);

  // 4) 加购 → 购物车：数量 / 全选 / 合计
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('[data-sonner-toast]').first()).toContainText('已加入购物车');
  await pause(page, 1800);
  await page.getByTestId('header-cart-link').click();
  await page.waitForURL(/\/cart/);
  await pause(page, 3500);
  await page.getByTestId('cart-qty-plus').first().click();
  await pause(page, 3000);
  await page.screenshot({ path: `${SHOTS}/04-cart.png` });
  await pause(page, 1500);

  // 5) 结算 → 提交订单 → 收银台倒计时 → 支付成功 → 待发货
  await page.getByTestId('go-checkout').click();
  await page.waitForURL(/\/checkout/);
  await pause(page, 6000);
  await page.screenshot({ path: `${SHOTS}/05-checkout.png` });
  await page.getByTestId('submit-order').click();
  await page.waitForURL(/\/pay\//);
  await pause(page, 6000);
  await page.screenshot({ path: `${SHOTS}/06-pay.png` });
  const orderNo = ((await page.getByTestId('pay-order-no').textContent()) ?? '').trim();
  await page.getByTestId('pay-success').click();
  await page.waitForURL(new RegExp(`/orders/${orderNo}`));
  await expect(page.getByTestId('order-detail-status')).toHaveText('待发货');
  await page.screenshot({ path: `${SHOTS}/07-order-paid.png` });
  await pause(page, 5500);

  // 6) 切管理员：统计卡 → 商品管理 → 煎锅 24cm×单锅库存改 1 → 前台「仅剩 1 件」
  await logout(page);
  await login(page, 'admin');
  await page.goto('/admin');
  await pause(page, 6000);
  await page.screenshot({ path: `${SHOTS}/08-admin-dashboard.png` });
  await page.goto('/admin/products');
  await pause(page, 1500);
  await page.getByTestId('admin-product-search').fill('煎锅');
  await page.getByTestId('admin-product-search-btn').click();
  await pause(page, 1500);
  await page.getByTestId('admin-product-link').first().click();
  await page.waitForURL(/\/admin\/products\/1101/);
  await pause(page, 1500);
  const row = page.locator('[data-testid="admin-sku-row"][data-sku-id="11011"]');
  await row.getByTestId('sku-stock-input').fill('1');
  await pause(page, 800);
  await row.getByTestId('sku-save').click();
  await expect(page.locator('[data-sonner-toast]').first()).toContainText('SKU 已更新');
  await page.screenshot({ path: `${SHOTS}/09-admin-sku-edit.png` });
  await pause(page, 3500);

  // 7) 库存护栏：买家 A 抢到最后 1 件（锁定），第二账号 B 随后购买被服务端拒绝
  await logout(page);
  await login(page, 'buyer');
  await page.goto('/p/1101');
  await pause(page, 1500);
  await page.getByTestId('option-尺寸-24cm').click();
  await page.getByTestId('option-规格-单锅').click();
  await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 1 件');
  await pause(page, 3500);
  await page.getByTestId('buy-now').click();
  await page.waitForURL(/\/checkout\?sku=11011/);
  await pause(page, 1500);
  await page.getByTestId('submit-order').click();
  await page.waitForURL(/\/pay\//);
  await pause(page, 2500); // A 下单成功，库存已锁定（未支付）
  await logout(page);
  await login(page, 'admin'); // 管理员账号作为第二买家 B
  await page.goto('/p/1101');
  await page.getByTestId('option-尺寸-24cm').click();
  await page.getByTestId('option-规格-单锅').click();
  await expect(page.getByTestId('stock-hint')).toHaveText('已售罄');
  await pause(page, 2000);
  await page.goto('/checkout?sku=11011&qty=1'); // 绕过 UI 直接结算 → 服务端拒绝
  await expect(page.getByTestId('checkout-error')).toContainText('库存不足');
  await page.screenshot({ path: `${SHOTS}/10-stock-guard.png` });
  await pause(page, 5000);

  // 8) 后台发货 → 买家确认收货 → 已完成
  await page.goto(`/admin/orders/${orderNo}`);
  await pause(page, 2000);
  await page.getByTestId('ship-tracking-no').fill('SF-DEMO-0001');
  await pause(page, 800);
  await page.getByTestId('ship-submit').click();
  await expect(page.getByTestId('admin-order-detail-status')).toHaveText('待收货');
  await pause(page, 2500);
  await logout(page);
  await login(page, 'buyer');
  await page.goto(`/orders/${orderNo}`);
  await expect(page.getByTestId('order-detail-status')).toHaveText('待收货');
  await pause(page, 2500);
  await page.getByTestId('order-confirm-receipt').click();
  await expect(page.getByTestId('order-detail-status')).toHaveText('已完成');
  await page.screenshot({ path: `${SHOTS}/11-order-completed.png` });
  await pause(page, 4500);
  await page.goto('/orders');
  await pause(page, 5000);

  // 9) 提交历史 / AI_WORKFLOW 速览（≈30 秒；含 50 并发不超卖测试结果）
  const demoHtml = path.resolve(__dirname, '../../scripts/demo/workflow-overview.html');
  await page.goto(`file://${demoHtml}`);
  await pause(page, 16_000);
  await page.mouse.wheel(0, 600);
  await pause(page, 14_000);
  await page.mouse.wheel(0, 600);
  await pause(page, 14_000);
  await page.screenshot({ path: `${SHOTS}/12-workflow.png` });
  await pause(page, 2000);

  await ctx.close();
});
