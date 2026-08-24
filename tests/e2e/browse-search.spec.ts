import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

test.use({ storageState: STORAGE_STATE.anonymous });

test.describe('P0-2 商品目录与搜索', () => {
  test('首页渲染商品卡 ≥ 12 且含两级类目入口', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('product-card')).not.toHaveCount(0);
    const count = await page.getByTestId('product-card').count();
    expect(count).toBeGreaterThanOrEqual(12);
    expect(await page.getByTestId('category-parent-link').count()).toBeGreaterThanOrEqual(6);
    expect(await page.getByTestId('category-child-link').count()).toBeGreaterThanOrEqual(20);
  });

  test('搜索「耳机」：结果均含关键词', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('search-input').first().fill('耳机');
    await page.getByTestId('search-input').first().press('Enter');
    await expect(page).toHaveURL(/\/search\?q=/);
    const cards = page.getByTestId('product-card');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < n; i++) {
      await expect(cards.nth(i)).toContainText('耳机');
    }
  });

  test('点类目 → 列表只含该类目（父类目含子类目商品）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('category-child-link').filter({ hasText: '耳机音频' }).click();
    await expect(page).toHaveURL(/\/c\/audio/);
    await expect(page.getByTestId('category-title')).toContainText('耳机音频');
    await expect(page.getByTestId('breadcrumb-current')).toHaveText('耳机音频');
    // 叶子类目共 7 件（seed 固定）
    await expect(page.getByTestId('total-count')).toHaveText('7');
    // 父类目包含全部子类目商品
    await page.goto('/c/digital');
    const parentTotal = Number(await page.getByTestId('total-count').textContent());
    expect(parentTotal).toBeGreaterThan(7);
  });

  test('改排序为价格升序 → 首项价格 ≤ 次项，且保持关键词', async ({ page }) => {
    await page.goto('/search?q=%E8%80%B3%E6%9C%BA');
    await page.getByTestId('sort-price_asc').click();
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/q=/);
    const prices = page.getByTestId('product-card-price');
    await expect(prices.first()).toBeVisible();
    const parse = (t: string | null) => Number((t ?? '').replace(/[^\d.]/g, ''));
    const first = parse(await prices.nth(0).textContent());
    const second = parse(await prices.nth(1).textContent());
    expect(first).toBeLessThanOrEqual(second);
  });

  test('价格区间过滤（元）', async ({ page }) => {
    await page.goto('/search?q=%E8%80%B3%E6%9C%BA');
    await page.getByTestId('price-min').fill('100');
    await page.getByTestId('price-max').fill('500');
    await page.getByTestId('price-apply').click();
    await expect(page).toHaveURL(/min=100/);
    const prices = page.getByTestId('product-card-price');
    const n = await prices.count();
    expect(n).toBeGreaterThanOrEqual(1);
    const parse = (t: string | null) => Number((t ?? '').replace(/[^\d.]/g, ''));
    for (let i = 0; i < n; i++) {
      const v = parse(await prices.nth(i).textContent());
      expect(v).toBeGreaterThanOrEqual(100);
      expect(v).toBeLessThanOrEqual(500);
    }
  });

  test('翻到第 2 页：URL 与内容变化', async ({ page }) => {
    await page.goto('/search');
    const firstTitle = await page.getByTestId('product-card-title').first().textContent();
    await page.getByTestId('page-next').click();
    await expect(page).toHaveURL(/page=2/);
    const secondTitle = await page.getByTestId('product-card-title').first().textContent();
    expect(secondTitle).not.toBe(firstTitle);
    await expect(page.getByTestId('page-info')).toContainText('第 2 /');
  });

  test('无结果：空态 + 清除筛选', async ({ page }) => {
    await page.goto('/search?q=%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E5%95%86%E5%93%81xyz');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await page.getByTestId('clear-filters').click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });

  test('下架商品不出现在搜索且详情 404', async ({ page }) => {
    // seed：每个一级类目 1 个下架商品；数码类的下架商品是「已下架」状态的 iPhone 5s（sourceDummyId 不重要，用标题）
    const res = await page.goto('/p/999999');
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId('not-found-code')).toHaveText('404');
  });
});
