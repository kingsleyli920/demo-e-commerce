import { expect, test } from '@playwright/test';
import { STORAGE_STATE } from '../../playwright.config';

// seed 固定商品：
// 1019 Beats Flex 颈挂式：颜色(黑/蓝/灰/黄)×版本(标准版/礼盒装)；黄×标准版下架；灰×礼盒装不存在；灰×标准版库存 3
// 1093 厨乐榨汁机：颜色(象牙白/复古红)×版本(标准版/升级版)；复古红×升级版 上架但库存 0（已售罄）
const BEATS = '/p/1019';
const JUICER = '/p/1093';

test.describe('P0-3 商品详情与 SKU', () => {
  test.describe('匿名访客', () => {
    test.use({ storageState: STORAGE_STATE.anonymous });

    test('详情页渲染图集/标题/面包屑/描述；未选满规格时按钮禁用且显示价格区间', async ({
      page,
    }) => {
      await page.goto(BEATS);
      await expect(page.getByTestId('pdp-title')).toContainText('Beats Flex');
      await expect(page.getByTestId('pdp-breadcrumb')).toContainText('耳机音频');
      await expect(page.getByTestId('gallery-main')).toBeVisible();
      await expect(page.getByTestId('pdp-description')).toBeVisible();
      await expect(page.getByTestId('sku-price-range')).toBeVisible();
      await expect(page.getByTestId('spec-prompt')).toHaveText('请选择规格');
      await expect(page.getByTestId('add-to-cart')).toBeDisabled();
      await expect(page.getByTestId('buy-now')).toBeDisabled();
      // 只选一个维度仍禁用
      await page.getByTestId('option-颜色-黑色').click();
      await expect(page.getByTestId('add-to-cart')).toBeDisabled();
    });

    test('选满规格后显示 SKU 价格；切换规格价格变化；低库存提示', async ({ page }) => {
      await page.goto(BEATS);
      await page.getByTestId('option-颜色-黑色').click();
      await page.getByTestId('option-版本-标准版').click();
      await expect(page.getByTestId('sku-price')).toHaveText('¥299.00');
      await expect(page.getByTestId('add-to-cart')).toBeEnabled();
      await page.getByTestId('option-版本-礼盒装').click();
      await expect(page.getByTestId('sku-price')).toHaveText('¥349.00');
      // 灰色×标准版 库存 3 → 仅剩 3 件
      await page.getByTestId('option-版本-标准版').click();
      await page.getByTestId('option-颜色-灰色').click();
      await expect(page.getByTestId('stock-hint')).toHaveText('仅剩 3 件');
    });

    test('不存在/下架的规格组合置灰不可选', async ({ page }) => {
      await page.goto(BEATS);
      // 黄色唯一 SKU（标准版）已下架 → 未选时黄色即禁用
      await expect(page.getByTestId('option-颜色-黄色')).toBeDisabled();
      // 选礼盒装 → 灰色（组合不存在）置灰
      await page.getByTestId('option-版本-礼盒装').click();
      await expect(page.getByTestId('option-颜色-灰色')).toBeDisabled();
      await expect(page.getByTestId('option-颜色-黑色')).toBeEnabled();
      // 换回标准版 → 灰色恢复可选
      await page.getByTestId('option-版本-标准版').click();
      await expect(page.getByTestId('option-颜色-灰色')).toBeEnabled();
    });

    test('售罄 SKU：按钮禁用并显示「已售罄」', async ({ page }) => {
      await page.goto(JUICER);
      await page.getByTestId('option-颜色-复古红').click();
      await page.getByTestId('option-版本-升级版').click();
      await expect(page.getByTestId('stock-hint')).toHaveText('已售罄');
      await expect(page.getByTestId('add-to-cart')).toBeDisabled();
      await expect(page.getByTestId('add-to-cart')).toHaveText('已售罄');
      await expect(page.getByTestId('buy-now')).toBeDisabled();
    });

    test('未登录加购 → 跳登录（带 next 回跳），登录后回到该商品', async ({ page }) => {
      await page.goto(BEATS);
      await page.getByTestId('option-颜色-黑色').click();
      await page.getByTestId('option-版本-标准版').click();
      await page.getByTestId('add-to-cart').click();
      await expect(page).toHaveURL(/\/login\?next=%2Fp%2F1019/);
      await page.getByTestId('demo-login-buyer').click();
      await expect(page).toHaveURL(/\/p\/1019$/);
      await expect(page.getByTestId('pdp-title')).toContainText('Beats Flex');
    });
  });

  test('登录买家：加购成功 toast 且角标增加；数量步进受限', async ({ page }) => {
    await page.goto(BEATS);
    const badge = page.getByTestId('header-cart-badge');
    const before = (await badge.isVisible()) ? Number(await badge.textContent()) : 0;
    await page.getByTestId('option-颜色-黑色').click();
    await page.getByTestId('option-版本-标准版').click();
    // 数量步进
    await page.getByTestId('qty-plus').click();
    await expect(page.getByTestId('qty-value')).toHaveText('2');
    await page.getByTestId('qty-minus').click();
    await expect(page.getByTestId('qty-value')).toHaveText('1');
    await page.getByTestId('qty-minus').isDisabled();
    await page.getByTestId('add-to-cart').click();
    await expect(page.locator('[data-sonner-toast]')).toContainText('已加入购物车');
    await expect(page.getByTestId('header-cart-badge')).toHaveText(String(before + 1));
  });
});
